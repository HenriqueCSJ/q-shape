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

    test('a failed rerun removes the previous success from exports', async () => {
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
        expect(latest.batchResults.size).toBe(0);
        expect(latest.getLongFormatResults()).toHaveLength(0);
        expect(onWarning).toHaveBeenCalledWith('Structure sample: optimizer failed');
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
});

test('batch progress accepts both service fractions and percentages', () => {
    expect(normalizeProgressFraction(0.3)).toBe(0.3);
    expect(normalizeProgressFraction(30)).toBe(0.3);
    expect(normalizeProgressFraction(-1)).toBe(0);
    expect(normalizeProgressFraction(250)).toBe(1);
    expect(normalizeProgressFraction(Number.NaN)).toBe(0);
});
