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
});
