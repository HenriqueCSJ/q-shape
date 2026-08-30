import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CoordinationSummary from './CoordinationSummary';

const baseProps = {
    atoms: [{ element: 'Fe', x: 0, y: 0, z: 0 }],
    selectedMetal: 0,
    coordAtoms: [],
    additionalMetrics: null,
    progress: null,
    intensiveProgress: null,
    intensiveMetadata: null,
    analysisParams: { mode: 'default' },
    isLoading: false,
    bestGeometry: null,
    geometryResults: [],
    selectedGeometryIndex: 0,
    onIntensiveAnalysis: jest.fn(),
    onGenerateReport: jest.fn(),
    onGenerateCSV: jest.fn(),
    batchMode: true,
    batchResults: new Map(),
    onAnalyzeAll: jest.fn(),
    onCancelBatch: jest.fn(),
    structureId: 'sample'
};

describe('coordination action mutual exclusion', () => {
    let container;
    let root;

    beforeEach(() => {
        global.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        delete global.IS_REACT_ACT_ENVIRONMENT;
    });

    async function render(state) {
        await act(async () => {
            root.render(<CoordinationSummary {...baseProps} {...state} />);
        });
        const buttons = [...container.querySelectorAll('button')];
        return {
            intensive: buttons.find(button => button.textContent.includes('Extended Search') ||
                button.textContent.includes('Running extended search...')),
            batch: buttons.find(button => button.textContent.includes('Analyze All Structures') ||
                button.textContent.includes('Cancel'))
        };
    }

    test('only cancellation remains available while a batch run owns the result store', async () => {
        const buttons = await render({ isRunningIntensive: false, isBatchRunning: true });
        expect(buttons.intensive.disabled).toBe(true);
        expect(buttons.batch.disabled).toBe(false);
        expect(buttons.batch.textContent).toContain('Cancel');
    });

    test('batch start is disabled while an individual intensive run is active', async () => {
        const buttons = await render({ isRunningIntensive: true, isBatchRunning: false });
        expect(buttons.intensive.disabled).toBe(true);
        expect(buttons.batch.disabled).toBe(true);
    });

    test('both analysis entry points are available when no analysis is active', async () => {
        const buttons = await render({ isRunningIntensive: false, isBatchRunning: false });
        expect(buttons.intensive.disabled).toBe(false);
        expect(buttons.batch.disabled).toBe(false);
    });

    test('explains when extended search is identical by design', async () => {
        await render({
            coordAtoms: Array.from({ length: 6 }, (_, index) => ({
                idx: index + 1,
                atom: { element: 'N' }
            }))
        });

        expect(container.textContent).toContain('same exact solver');
        expect(container.textContent).toContain('identical CShM values are expected');
    });

    test('shows the selected-analysis card in the restored second grid slot', async () => {
        await render({
            batchMode: false,
            analysisParams: { mode: 'default' },
            geometryResults: [
                { name: 'OC-6 (Octahedral)', shapeMeasure: 0.25, status: 'available' },
                { name: 'TPR-6 (Trigonal Prism)', shapeMeasure: 2.5, status: 'available' },
                { name: 'PPY-6 (Pentagonal Pyramid)', shapeMeasure: 4, status: 'available' }
            ],
            bestGeometry: { name: 'OC-6 (Octahedral)', shapeMeasure: 0.25, status: 'available' },
            additionalMetrics: {
                meanBondLength: 2,
                stdDevBondLength: 0.1,
                minBondLength: 1.9,
                maxBondLength: 2.1,
                angleStats: { count: 15, mean: 108, stdDev: 12.34, min: 60, max: 180 }
            },
            selectedGeometryIndex: 1
        });

        expect(container.textContent).toContain('Selected Analysis');
        expect(container.textContent).toContain('TPR-6 (Trigonal Prism)');
        expect(container.textContent).toContain('2.5000');
        expect(container.textContent).toContain('Rank: 2 of 3');
        expect(container.textContent).toContain('Point group: D3h');
        expect(container.textContent).toContain('ΔCShM to best: 2.2500');
        expect(container.textContent).toContain('Nearest CShM gap: 1.5000');
        expect(container.textContent).toContain('M–L length CV: 5.00%');
        expect(container.textContent).toContain('L–M–L angle SD: 12.34°');
        expect(container.textContent).toContain('not confidence probabilities');
        expect(container.textContent).not.toContain('Quality Score');
        expect(container.textContent).not.toContain('RMSD');
    });
});
