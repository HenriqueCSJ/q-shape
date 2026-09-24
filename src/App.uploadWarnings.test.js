import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import App from './App';
import { useThreeScene } from './hooks/useThreeScene';
import { generatePDFReport } from './services/reportGenerator';
import calculateShapeMeasure from './services/shapeAnalysis/shapeCalculator';

jest.mock('./hooks/useThreeScene', () => ({ useThreeScene: jest.fn() }));
jest.mock('./services/shapeAnalysis/shapeCalculator', () => ({
    __esModule: true, default: jest.fn(() => ({ measure: 0.25, alignedCoords: [] }))
}));
jest.mock('./services/reportGenerator', () => ({
    generatePDFReport: jest.fn(), generateCSVReport: jest.fn(),
    generateBatchPDFReport: jest.fn(), generateLongDetailedCSV: jest.fn()
}));

const cleanXYZ = '3\nComplete\nFe 0 0 0\nN 2 0 0\nN -2 0 0';
const partialXYZ = cleanXYZ + '\nbad_header\nbroken frame';
const cn1XYZ = '2\nOne donor\nFe 0 0 0\nN 2 0 0';

describe('current file import and analysis warnings', () => {
    let root;
    let container;
    let reader;
    let originalFileReader;
    let logSpy;
    let errorSpy;
    let canvasSpy;

    beforeEach(async () => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        calculateShapeMeasure.mockReturnValue({ measure: 0.25, alignedCoords: [] });
        global.IS_REACT_ACT_ENVIRONMENT = true;
        originalFileReader = global.FileReader;
        global.FileReader = class {
            constructor() { reader = this; }
            readAsText() {}
        };
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        canvasSpy = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
            .mockReturnValue('data:image/png;base64,');
        useThreeScene.mockReturnValue({
            sceneRef: { current: {} },
            rendererRef: { current: { setSize: jest.fn(), render: jest.fn() } },
            cameraRef: { current: { aspect: 1, updateProjectionMatrix: jest.fn() } }
        });
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => root.render(<App />));
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        global.FileReader = originalFileReader;
        jest.useRealTimers();
        logSpy.mockRestore();
        errorSpy.mockRestore();
        canvasSpy.mockRestore();
        delete global.IS_REACT_ACT_ENVIRONMENT;
    });

    async function beginUpload(name) {
        await act(async () => Simulate.change(
            container.querySelector('input[type="file"]'),
            { target: { files: [{ name }] } }
        ));
    }

    async function finishUpload(content) {
        await act(async () => reader.onload({ target: { result: content } }));
        await act(async () => jest.runAllTimers());
    }

    async function upload(name, content) {
        await beginUpload(name);
        await finishUpload(content);
    }

    test('a retained valid frame remains usable and visibly discloses a malformed later frame', async () => {
        await upload('partial.xyz', partialXYZ);
        expect(container.textContent).toContain('Stopped parsing');
        expect(container.textContent).toContain('1 frame(s) successfully parsed');
        expect(container.textContent).toContain('Single Structure Mode');
        expect(container.querySelector('#metal-center-select').options.length).toBe(4);
        expect(container.textContent).toContain('0.2500');
        expect(container.textContent).not.toContain('Frame 1 rejected');
    });

    test('a new file selection clears an old analysis warning even when the replacement is rejected', async () => {
        await upload('one-donor.xyz', cn1XYZ);
        expect(container.textContent).toContain('No reference geometries available for coordination number 1');
        await beginUpload('invalid.xyz');
        expect(container.textContent).not.toContain('No reference geometries available for coordination number 1');
        await finishUpload('not_a_number\nTest\nFe 0 0 0');
        expect(container.textContent).toContain('Invalid atom count');
        expect(container.textContent).not.toContain('No reference geometries available for coordination number 1');
        expect(container.querySelector('#metal-center-select')).toBeNull();
    });

    test('a later clean upload removes the prior file import warning', async () => {
        await upload('partial.xyz', partialXYZ);
        expect(container.textContent).toContain('Stopped parsing');
        await upload('clean.xyz', cleanXYZ);
        expect(container.textContent).not.toContain('Stopped parsing');
        expect(container.textContent).toContain('0.2500');
    });

    test('the existing single-result report warning context includes the import disclosure', async () => {
        await upload('partial.xyz', partialXYZ);
        const reportButton = [...container.querySelectorAll('button')]
            .find(button => button.textContent.includes('Generate Report'));
        expect(reportButton.disabled).toBe(false);
        await act(async () => reportButton.click());
        expect(generatePDFReport).toHaveBeenCalledTimes(1);
        expect(generatePDFReport.mock.calls[0][0].warnings.some(warning =>
            warning.includes('Stopped parsing') && warning.includes('1 frame(s) successfully parsed')
        )).toBe(true);
    });

    test('canceling the picker preserves the current file and its analysis warning', async () => {
        await upload('one-donor.xyz', cn1XYZ);
        const before = container.textContent;
        await act(async () => Simulate.change(
            container.querySelector('input[type="file"]'), { target: { files: [] } }
        ));
        expect(container.textContent).toBe(before);
    });

    test('clearing an analysis warning cannot erase a current partial-import notice', async () => {
        await upload('partial-one-donor.xyz', cn1XYZ + '\nbad_header\nbroken frame');
        expect(container.textContent).toContain('Stopped parsing');
        const clear = [...container.querySelectorAll('button')]
            .find(button => button.textContent.trim() === 'Clear');
        await act(async () => clear.click());
        expect(container.textContent).not.toContain('No reference geometries available for coordination number 1');
        expect(container.textContent).toContain('Stopped parsing');
    });

    test('the file notice persists across frame navigation and a current-frame analysis update', async () => {
        await upload('partial-multi.xyz', cleanXYZ + '\n' +
            cleanXYZ.replace('Complete', 'Second') + '\nbad_header\nbroken frame');
        expect(container.textContent).toContain('2 frame(s) successfully parsed');
        await act(async () => Simulate.change(container.querySelector('#batch-structure-select'), {
            target: { value: '1' }
        }));
        await act(async () => jest.runAllTimers());
        expect(container.textContent).toContain('Stopped parsing');
        const auto = [...container.querySelectorAll('label')]
            .find(label => label.textContent.trim() === 'Auto').querySelector('input');
        await act(async () => Simulate.change(auto, { target: { checked: false } }));
        await act(async () => Simulate.change(container.querySelector('[aria-label="Coordination radius value"]'), {
            target: { value: '2.6' }
        }));
        await act(async () => jest.runAllTimers());
        expect(container.textContent).toContain('2 frame(s) successfully parsed');
        expect(container.textContent).toContain('0.2500');
    });
});
