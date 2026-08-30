import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

jest.mock('../services/coordination/intensiveAnalysis', () => ({
    runIntensiveAnalysisAsync: jest.fn()
}));

jest.mock('../services/coordination/metalDetector', () => ({
    detectMetalCenter: jest.fn(() => 0)
}));

jest.mock('../services/coordination/radiusDetector', () => ({
    detectOptimalRadius: jest.fn(() => 2)
}));

jest.mock('../services/coordination/sphereDetector', () => ({
    getCoordinatingAtoms: jest.fn(atoms => atoms.slice(1).map((atom, offset) => ({
        idx: offset + 1,
        atom,
        distance: 1,
        vec: { x: atom.x, y: atom.y, z: atom.z }
    })))
}));

import { runIntensiveAnalysisAsync } from '../services/coordination/intensiveAnalysis';
import { getCoordinatingAtoms } from '../services/coordination/sphereDetector';
import useBatchAnalysis, { normalizeProgressFraction } from './useBatchAnalysis';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function structure(id, metal = 'Fe') {
    return {
        id,
        atoms: [
            { element: metal, x: 0, y: 0, z: 0 },
            { element: 'N', x: 1, y: 0, z: 0 },
            { element: 'N', x: -1, y: 0, z: 0 }
        ]
    };
}

function successfulResult(name, shapeMeasure) {
    return {
        geometryResults: [{ name, shapeMeasure }],
        ligandGroups: { rings: [], monodentate: [1, 2] },
        metadata: { coordinationNumber: 2 }
    };
}

function storedResult(name, shapeMeasure) {
    return {
        geometryResults: [{ name, shapeMeasure }],
        bestGeometry: { name, shapeMeasure },
        ligandGroups: {},
        metadata: { coordinationNumber: 2 },
        metalIndex: 0,
        radius: 2,
        coordAtoms: [],
        coordinationNumber: 2,
        analysisMode: 'intensive'
    };
}

function HookHarness({ structures, capture, onWarning, onError }) {
    const value = useBatchAnalysis({ structures, onWarning, onError });
    useEffect(() => capture(value), [capture, value]);
    return null;
}

describe('batch-analysis async ownership', () => {
    let container;
    let root;
    let latest;
    let capture;
    let onWarning;
    let onError;
    let errorLogSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        getCoordinatingAtoms.mockImplementation(atoms => atoms.slice(1).map((atom, offset) => ({
            idx: offset + 1,
            atom,
            distance: 1,
            vec: { x: atom.x, y: atom.y, z: atom.z }
        })));
        global.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        capture = value => { latest = value; };
        onWarning = jest.fn();
        onError = jest.fn();
        errorLogSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        errorLogSpy.mockRestore();
        delete global.IS_REACT_ACT_ENVIRONMENT;
    });

    async function render(structures) {
        await act(async () => {
            root.render(
                <HookHarness
                    structures={structures}
                    capture={capture}
                    onWarning={onWarning}
                    onError={onError}
                />
            );
        });
    }

    test('an old file cannot write into a newer file or end its active run', async () => {
        const oldWork = deferred();
        const newWork = deferred();
        runIntensiveAnalysisAsync.mockImplementation(atoms =>
            atoms[0].element === 'Fe' ? oldWork.promise : newWork.promise
        );

        await render([structure('old', 'Fe')]);
        let oldRun;
        await act(async () => {
            oldRun = latest.analyzeAllStructures();
            await Promise.resolve();
        });

        await render([structure('new', 'Cu')]);
        let newRun;
        await act(async () => {
            newRun = latest.analyzeAllStructures();
            await Promise.resolve();
        });

        await act(async () => {
            oldWork.resolve(successfulResult('OLD', 1));
            await oldRun;
        });
        expect(latest.batchResults.size).toBe(0);
        expect(latest.isBatchRunning).toBe(true);

        await act(async () => {
            newWork.resolve(successfulResult('NEW', 2));
            await newRun;
        });
        expect(latest.batchResults.get(0)).toMatchObject({
            structureId: 'new',
            bestGeometry: { name: 'NEW', shapeMeasure: 2 }
        });
        expect(latest.isBatchRunning).toBe(false);
    });

    test('changing an override invalidates in-flight work', async () => {
        const oldWork = deferred();
        runIntensiveAnalysisAsync.mockReturnValueOnce(oldWork.promise);
        await render([structure('sample')]);

        let oldRun;
        await act(async () => {
            oldRun = latest.analyzeAllStructures();
            await Promise.resolve();
            latest.setStructureOverride(0, { radius: 4 });
        });

        await act(async () => {
            oldWork.resolve(successfulResult('STALE', 3));
            await oldRun;
        });
        expect(latest.batchResults.size).toBe(0);
        expect(latest.isBatchRunning).toBe(false);
    });

    test('single-structure and batch ownership cannot overwrite each other', async () => {
        const batchWork = deferred();
        runIntensiveAnalysisAsync.mockReturnValueOnce(batchWork.promise);
        await render([structure('sample')]);

        let singleOwnership;
        await act(async () => {
            singleOwnership = latest.beginStructureAnalysis(0);
            latest.setStructureResult(0, storedResult('SINGLE-OLD', 1), singleOwnership);
        });

        let batchRun;
        await act(async () => {
            batchRun = latest.analyzeAllStructures();
            await Promise.resolve();
        });
        expect(latest.setStructureResult(0, storedResult('STALE-SINGLE', 9), singleOwnership))
            .toBe(false);

        await act(async () => {
            batchWork.resolve(successfulResult('BATCH-NEW', 2));
            await batchRun;
        });
        expect(latest.batchResults.get(0).bestGeometry.name).toBe('BATCH-NEW');

        const obsoleteBatchWork = deferred();
        runIntensiveAnalysisAsync.mockReturnValueOnce(obsoleteBatchWork.promise);
        let obsoleteBatchRun;
        await act(async () => {
            obsoleteBatchRun = latest.analyzeAllStructures();
            await Promise.resolve();
        });

        let newSingleOwnership;
        await act(async () => {
            newSingleOwnership = latest.beginStructureAnalysis(0);
            latest.setStructureResult(0, storedResult('SINGLE-NEW', 3), newSingleOwnership);
        });
        await act(async () => {
            obsoleteBatchWork.resolve(successfulResult('STALE-BATCH', 8));
            await obsoleteBatchRun;
        });
        expect(latest.batchResults.get(0).bestGeometry.name).toBe('SINGLE-NEW');
    });

    test('a failed rerun replaces the previous success with an explicit terminal record', async () => {
        runIntensiveAnalysisAsync
            .mockResolvedValueOnce(successfulResult('FIRST', 1))
            .mockRejectedValueOnce(new Error('optimizer failed'));
        await render([structure('sample')]);

        await act(async () => {
            await latest.analyzeAllStructures();
        });
        expect(latest.getLongFormatResults()).toHaveLength(1);

        await act(async () => {
            await latest.analyzeAllStructures();
        });
        expect(latest.batchResults.size).toBe(1);
        expect(latest.batchResults.get(0)).toMatchObject({
            status: 'error',
            error: 'optimizer failed',
            bestGeometry: null,
            geometryResults: []
        });
        expect(latest.isAllAnalyzed).toBe(true);
        expect(latest.getBatchSummary()).toEqual([expect.objectContaining({
            id: 'sample',
            bestGeometry: 'N/A',
            bestCShM: null,
            status: 'Error',
            details: 'optimizer failed'
        })]);
        expect(latest.getLongFormatResults()).toEqual([expect.objectContaining({
            structureId: 'sample',
            geometryRank: null,
            geometryName: 'N/A',
            shapeMeasure: null,
            status: 'Error',
            details: 'optimizer failed'
        })]);
        expect(onWarning).toHaveBeenCalledWith('Structure sample: optimizer failed');
    });

    test('retains explicit unavailable geometry rows while selecting a finite best result', async () => {
        runIntensiveAnalysisAsync.mockResolvedValue({
            geometryResults: [
                { name: 'VALID', shapeMeasure: 0.75, status: 'available', error: null },
                {
                    name: 'FAILED',
                    shapeMeasure: null,
                    status: 'error',
                    error: 'synthetic target failure'
                }
            ],
            ligandGroups: { rings: [], monodentate: [1, 2] },
            metadata: { coordinationNumber: 2, unavailableGeometryCount: 1 }
        });
        await render([structure('sample')]);

        await act(async () => {
            await latest.analyzeAllStructures();
        });

        expect(latest.batchResults.get(0)).toMatchObject({
            bestGeometry: { name: 'VALID', shapeMeasure: 0.75 }
        });
        expect(latest.batchResults.get(0).geometryResults).toHaveLength(2);
        expect(latest.batchResults.get(0).geometryResults[1]).toMatchObject({
            name: 'FAILED',
            status: 'error'
        });
    });

    test('continues a mixed batch and retains both the failed and successful structures', async () => {
        runIntensiveAnalysisAsync
            .mockRejectedValueOnce('worker disconnected')
            .mockResolvedValueOnce(successfulResult('SECOND', 0.5));
        await render([structure('failed'), structure('successful', 'Cu')]);

        let runResults;
        await act(async () => {
            runResults = await latest.analyzeAllStructures();
        });

        expect(runResults).toEqual([
            expect.objectContaining({
                structureIndex: 0,
                success: false,
                error: 'worker disconnected'
            }),
            expect.objectContaining({
                structureIndex: 1,
                success: true
            })
        ]);
        expect(latest.batchResults.size).toBe(2);
        expect(latest.batchResults.get(0)).toMatchObject({
            status: 'error',
            error: 'worker disconnected'
        });
        expect(latest.batchResults.get(1)).toMatchObject({
            status: 'available',
            bestGeometry: { name: 'SECOND', shapeMeasure: 0.5 }
        });
        expect(latest.getBatchSummary()).toEqual([
            expect.objectContaining({ id: 'failed', status: 'Error' }),
            expect.objectContaining({ id: 'successful', status: 'Available' })
        ]);
        expect(latest.getLongFormatResults()).toEqual([
            expect.objectContaining({ structureId: 'failed', status: 'Error' }),
            expect.objectContaining({ structureId: 'successful', status: 'Available' })
        ]);
    });

    test('cancellation remains cancelled after the obsolete promise settles', async () => {
        const work = deferred();
        runIntensiveAnalysisAsync.mockReturnValue(work.promise);
        await render([structure('sample')]);

        let run;
        await act(async () => {
            run = latest.analyzeAllStructures();
            await Promise.resolve();
            latest.cancelBatchAnalysis();
        });
        expect(latest.batchProgress.stage).toBe('cancelled');

        await act(async () => {
            work.resolve(successfulResult('STALE', 4));
            await run;
        });
        expect(latest.batchProgress.stage).toBe('cancelled');
        expect(latest.batchResults.size).toBe(0);
    });

    test('keeps an individual radius local until it is explicitly applied to all structures', async () => {
        await render([structure('alpha'), structure('beta'), structure('gamma')]);
        const autoDetectedRadii = [0, 1, 2].map(index => latest.getRadius(index));

        await act(async () => {
            latest.setStructureOverride(1, { radius: 3.25 });
        });

        expect(latest.getRadius(0)).toBe(autoDetectedRadii[0]);
        expect(latest.getRadius(1)).toBe(3.25);
        expect(latest.getRadius(2)).toBe(autoDetectedRadii[2]);

        await act(async () => {
            latest.applyOverrideToAll({ radius: 4.1 });
        });

        expect([0, 1, 2].map(index => latest.getRadius(index))).toEqual([4.1, 4.1, 4.1]);
    });
});

test('batch progress accepts both service fractions and percentages', () => {
    expect(normalizeProgressFraction(0.3)).toBe(0.3);
    expect(normalizeProgressFraction(30)).toBe(0.3);
    expect(normalizeProgressFraction(-1)).toBe(0);
    expect(normalizeProgressFraction(250)).toBe(1);
    expect(normalizeProgressFraction(Number.NaN)).toBe(0);
});
