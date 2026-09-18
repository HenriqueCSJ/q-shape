import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import App from './App';
import useFileUpload from './hooks/useFileUpload';
import { useThreeScene } from './hooks/useThreeScene';
import { runIntensiveAnalysisAsync } from './services/coordination/intensiveAnalysis';
import calculateShapeMeasure from './services/shapeAnalysis/shapeCalculator';

jest.mock('./hooks/useFileUpload');
jest.mock('./hooks/useThreeScene', () => ({ useThreeScene: jest.fn() }));
jest.mock('./services/shapeAnalysis/shapeCalculator', () => ({
    __esModule: true, default: jest.fn(() => ({ measure: 17, alignedCoords: [] }))
}));
jest.mock('./services/coordination/intensiveAnalysis', () => ({
    ...jest.requireActual('./services/coordination/intensiveAnalysis'),
    runIntensiveAnalysisAsync: jest.fn()
}));

const structure = (id, distance) => ({
    id,
    atoms: [
        { element: 'Fe', x: 0, y: 0, z: 0 },
        { element: 'N', x: distance, y: 0, z: 0 },
        { element: 'N', x: -distance, y: 0, z: 0 }
    ]
});

function result(measure) {
    return {
        geometryResults: [{ name: 'L-2 (Linear)', shapeMeasure: measure, status: 'available' }],
        metadata: { coordinationNumber: 2, geometryCount: 1, elapsedSeconds: 1.2 },
        ligandGroups: { rings: [], monodentate: [1, 2] }
    };
}

describe('batch rows and selected analysis use the same stored result', () => {
    let root;
    let container;
    let structures;
    let selectedIndex;
    let uploadMetadata;
    let logSpy;
    let errorSpy;

    function uploadState() {
        return {
            structures, atoms: structures[selectedIndex].atoms,
            currentStructure: structures[selectedIndex], selectedStructureIndex: selectedIndex,
            fileName: 'batch', fileFormat: 'XYZ', error: null, uploadMetadata,
            batchMode: true, structureCount: structures.length,
            handleFileUpload: jest.fn(),
            selectStructure: index => {
                selectedIndex = index;
                useFileUpload.mockReturnValue(uploadState());
                root.render(<App />);
            }
        };
    }

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        global.IS_REACT_ACT_ENVIRONMENT = true;
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        structures = [structure('alpha', 2), structure('beta', 2.5)];
        selectedIndex = 0;
        uploadMetadata = { uploadTime: 1, structureMetadata: [{}, {}] };
        useThreeScene.mockReturnValue({ sceneRef: {}, rendererRef: {}, cameraRef: {} });
        calculateShapeMeasure.mockReturnValue({ measure: 17, alignedCoords: [] });
        runIntensiveAnalysisAsync.mockImplementation(async atoms => result(atoms[1].x / 10));
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        useFileUpload.mockReturnValue(uploadState());
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        jest.useRealTimers();
        logSpy.mockRestore();
        errorSpy.mockRestore();
        delete global.IS_REACT_ACT_ENVIRONMENT;
    });

    async function mountAndAnalyze() {
        await act(async () => root.render(<App />));
        await act(async () => jest.runAllTimers());
        const button = [...container.querySelectorAll('button')]
            .find(element => element.textContent.includes('Analyze All Structures'));
        await act(async () => button.click());
    }

    async function select(id) {
        await act(async () => container.querySelector(`button[aria-label="View structure ${id}"]`).click());
        await act(async () => jest.runAllTimers());
    }

    function cardText() {
        return [...container.querySelectorAll('div')]
            .find(element => element.textContent === '🎯 Selected Analysis')?.parentElement.textContent || '';
    }

    test('the real empty upload screen settles without calculation or a render loop', async () => {
        useFileUpload.mockImplementation(jest.requireActual('./hooks/useFileUpload').default);
        await act(async () => root.render(<App />));
        await act(async () => jest.runAllTimers());
        expect(container.textContent).toContain('Load Molecular Structure');
        expect(calculateShapeMeasure).not.toHaveBeenCalled();
        expect(useThreeScene.mock.calls.length).toBeLessThan(10);
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test('switching rows preserves saved CShM, statistics and mode without another calculation', async () => {
        await mountAndAnalyze();
        expect(cardText()).toContain('0.2000');
        expect(cardText()).toContain('Extended Search mode');
        expect(container.textContent).toContain('Saved batch result');
        expect(container.textContent).toContain('1/1 geometries available');
        const calculatorCalls = calculateShapeMeasure.mock.calls.length;

        await select('beta');
        expect(cardText()).toContain('0.2500');
        expect(container.textContent).toContain('Mean: 2.500 Å');
        expect(useThreeScene.mock.calls.at(-1)[0].bestGeometry.shapeMeasure).toBe(0.25);
        await select('alpha');
        expect(cardText()).toContain('0.2000');
        expect(calculateShapeMeasure).toHaveBeenCalledTimes(calculatorCalls);
        expect(runIntensiveAnalysisAsync).toHaveBeenCalledTimes(2);
    });

    test('a saved failure stays visible when selected and does not become a standard success', async () => {
        runIntensiveAnalysisAsync.mockImplementation(async atoms => {
            if (atoms[1].x === 2.5) throw new Error('Synthetic batch failure');
            return result(0.2);
        });
        await mountAndAnalyze();
        const calculatorCalls = calculateShapeMeasure.mock.calls.length;
        await select('beta');
        expect(container.textContent).toContain('Saved batch analysis: Synthetic batch failure');
        expect(cardText()).toBe('');
        expect(useThreeScene.mock.calls.at(-1)[0].bestGeometry).toBeNull();
        expect(calculateShapeMeasure).toHaveBeenCalledTimes(calculatorCalls);
        expect(container.textContent).toContain('1 complete, 0 partial, 1 failed');
    });

    test('editing one radius invalidates only that saved row', async () => {
        await mountAndAnalyze();
        const autoToggle = [...container.querySelectorAll('label')]
            .find(label => label.textContent.trim() === 'Auto').querySelector('input');
        await act(async () => Simulate.change(autoToggle, {
            target: { checked: false }
        }));
        const radiusInput = container.querySelector('[aria-label="Coordination radius value"]');
        await act(async () => Simulate.change(radiusInput, { target: { value: '2.8' } }));
        expect(container.querySelector('button[aria-label="View structure alpha"]')).toBeNull();
        expect(container.querySelector('button[aria-label="View structure beta"]')).not.toBeNull();
        await act(async () => jest.runAllTimers());
        expect(cardText()).toContain('17.0000');
        await select('beta');
        expect(cardText()).toContain('0.2500');
    });
});
