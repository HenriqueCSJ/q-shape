import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import BatchModePanel from './BatchModePanel';
import BatchSummaryTable from './BatchSummaryTable';
import CoordinationSummary from './CoordinationSummary';
import ResultsDisplay from './ResultsDisplay';
import FileUploadSection from './FileUploadSection';
import Visualization3D from './Visualization3D';
import AnalysisControls from './AnalysisControls';
import ManualOverridePanel from './ManualOverridePanel';

describe('CShM UI reporting surfaces', () => {
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

    async function render(element) {
        await act(async () => root.render(element));
        return container.textContent;
    }

    test('results list normalizes -0 and marks non-finite and negative values invalid', async () => {
        const text = await render(
            <ResultsDisplay
                isLoading={false}
                geometryResults={[
                    { name: 'L-2', shapeMeasure: -0 },
                    { name: 'vT-2', shapeMeasure: NaN, status: 'error', error: 'synthetic target failure' },
                    { name: 'out-of-domain', shapeMeasure: 100.0001 },
                    { name: 'invalid-negative', shapeMeasure: -1 }
                ]}
                analysisParams={{ mode: 'default' }}
                progress={null}
                selectedMetal={0}
                onGeometrySelect={jest.fn()}
            />
        );

        expect(text).toContain('0.0000');
        expect(text).toContain('N/A');
        expect(text).toContain('Analysis incomplete');
        expect(text).toContain('synthetic target failure');
        expect(text).not.toContain('-0.0000');
        expect(text).not.toMatch(/Confidence|Interpretation|Perfect|Excellent|Good|Moderate|Poor|\d+%/);
    });

    test('batch summary reports raw CShM without qualitative or confidence columns', async () => {
        const text = await render(
            <BatchSummaryTable
                structures={[{ id: 'one' }, { id: 'two' }]}
                selectedStructureIndex={0}
                onSelectStructure={jest.fn()}
                batchResults={new Map()}
                batchProgress={null}
                getBatchSummary={() => [
                    {
                        id: 'one', index: 0, metalElement: 'Fe', coordinationNumber: 2,
                        bestGeometry: 'L-2', bestCShM: -0
                    },
                    {
                        id: 'two', index: 1, metalElement: 'Fe', coordinationNumber: 2,
                        bestGeometry: 'vT-2', bestCShM: undefined
                    }
                ]}
            />
        );

        expect(text).toContain('0.0000');
        expect(text).toContain('N/A');
        expect(text).not.toContain('-0.0000');
        expect(text).not.toMatch(/Confidence|Interpretation|Perfect|Excellent|Good|Moderate|Poor|\d+%/);
    });

    test('batch selector uses shared CShM formatting', async () => {
        const text = await render(
            <BatchModePanel
                structures={[{ id: 'one' }]}
                selectedStructureIndex={0}
                onSelectStructure={jest.fn()}
                batchResults={new Map([[
                    0,
                    { bestGeometry: { name: 'L-2', shapeMeasure: -0 } }
                ]])}
            />
        );

        expect(text).toContain('CShM: 0.000');
        expect(text).not.toContain('-0.000');
    });

    test('batch navigator supports previous, next, and direct structure selection', async () => {
        const onSelectStructure = jest.fn();
        const structures = [{ id: 'alpha' }, { id: 'beta' }, { id: 'gamma' }];
        const text = await render(
            <BatchModePanel
                structures={structures}
                selectedStructureIndex={1}
                onSelectStructure={onSelectStructure}
                batchResults={new Map()}
            />
        );

        expect(text).toContain('Editing structure 2 of 3: beta');
        expect(text).toContain('Parameter changes below affect only this structure');

        await act(async () => container.querySelector('button[aria-label="Previous structure"]').click());
        expect(onSelectStructure).toHaveBeenLastCalledWith(0);

        await act(async () => container.querySelector('button[aria-label="Next structure"]').click());
        expect(onSelectStructure).toHaveBeenLastCalledWith(2);

        const selector = container.querySelector('#batch-structure-select');
        await act(async () => {
            selector.value = '2';
            selector.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(onSelectStructure).toHaveBeenLastCalledWith(2);
    });

    test('batch radius controls identify individual scope and expose an explicit apply-all action', async () => {
        const onApplyRadiusToAll = jest.fn();
        const text = await render(
            <AnalysisControls
                atoms={[{ element: 'Fe' }]}
                selectedMetal={0}
                onMetalChange={jest.fn()}
                coordRadius={3.25}
                autoRadius={false}
                radiusInput="3.250"
                radiusStep={0.05}
                targetCNInput="6"
                onRadiusInputChange={jest.fn()}
                onRadiusStepChange={jest.fn()}
                onFindRadiusForCN={jest.fn()}
                onIncrementRadius={jest.fn()}
                onDecrementRadius={jest.fn()}
                onCoordRadiusChange={jest.fn()}
                onAutoRadiusChange={jest.fn()}
                onTargetCNInputChange={jest.fn()}
                batchMode={true}
                onApplyMetalToAll={jest.fn()}
                onApplyRadiusToAll={onApplyRadiusToAll}
                currentStructureId="beta"
                selectedStructureIndex={1}
                structureCount={3}
            />
        );

        expect(text).toContain('Individual radius: editing structure 2 of 3 (beta)');
        expect(text).toContain('Changes in this card affect only this structure');
        expect(text).toContain('Apply current radius to all 3');
        expect(text).toContain('Apply metal to all');

        await act(async () => {
            container.querySelector('button[aria-label="Apply current radius to all 3 structures"]').click();
        });
        expect(onApplyRadiusToAll).toHaveBeenCalledWith(3.25);
    });

    test('batch UI keeps and explains a terminal structure failure', async () => {
        const structures = [{ id: 'failed-structure' }];
        const batchResults = new Map([[
            0,
            {
                status: 'error',
                error: 'optimizer failed at iteration 3',
                bestGeometry: null,
                geometryResults: []
            }
        ]]);

        const selectorText = await render(
            <BatchModePanel
                structures={structures}
                selectedStructureIndex={0}
                onSelectStructure={jest.fn()}
                batchResults={batchResults}
            />
        );
        expect(selectorText).toContain('failed-structure — Error: optimizer failed at iteration 3');

        const summaryText = await render(
            <BatchSummaryTable
                structures={structures}
                selectedStructureIndex={0}
                onSelectStructure={jest.fn()}
                batchResults={batchResults}
                batchProgress={null}
                getBatchSummary={() => [{
                    id: 'failed-structure',
                    index: 0,
                    metalElement: 'N/A',
                    coordinationNumber: null,
                    bestGeometry: 'N/A',
                    bestCShM: null,
                    status: 'Error',
                    details: 'optimizer failed at iteration 3'
                }]}
            />
        );
        expect(summaryText).toContain('Status');
        expect(summaryText).toContain('Details');
        expect(summaryText).toContain('Error');
        expect(summaryText).toContain('optimizer failed at iteration 3');
        expect(summaryText).toContain('1 of 1 structures processed');
    });

    test('primary upload, batch, progress, visualization, and radius controls expose accessible names', async () => {
        await render(
            <FileUploadSection
                fileInputRef={{ current: null }}
                onFileUpload={jest.fn()}
            />
        );
        expect(container.querySelector('label[for="structure-file-input"]')).not.toBeNull();
        expect(container.querySelector('#structure-file-input')).not.toBeNull();

        await render(
            <BatchModePanel
                structures={[{ id: 'one' }]}
                selectedStructureIndex={0}
                onSelectStructure={jest.fn()}
                batchResults={new Map()}
            />
        );
        expect(container.querySelector('label[for="batch-structure-select"]')).not.toBeNull();
        expect(container.querySelector('#batch-structure-select')).not.toBeNull();

        await render(
            <BatchSummaryTable
                structures={[{ id: 'one' }]}
                selectedStructureIndex={0}
                onSelectStructure={jest.fn()}
                batchResults={new Map()}
                batchProgress={{ stage: 'analyzing', progress: 25, message: 'Working' }}
                getBatchSummary={() => [{
                    id: 'one', index: 0, metalElement: 'Fe', coordinationNumber: 2,
                    bestGeometry: 'L-2', bestCShM: 0
                }]}
            />
        );
        expect(container.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
        expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');
        expect(container.querySelector('button[aria-label="View structure one"]')).not.toBeNull();

        await render(
            <Visualization3D
                canvasRef={{ current: null }}
                showIdeal={false}
                showLabels={false}
                autoRotate={false}
                onShowIdealChange={jest.fn()}
                onShowLabelsChange={jest.fn()}
                onAutoRotateChange={jest.fn()}
            />
        );
        expect(container.querySelector('canvas[role="img"]')?.getAttribute('aria-label'))
            .toBe('Interactive 3D molecular structure visualization');

        await render(
            <AnalysisControls
                atoms={[{ element: 'Fe' }]}
                selectedMetal={0}
                onMetalChange={jest.fn()}
                coordRadius={3}
                autoRadius={false}
                radiusInput="3.00"
                radiusStep={0.1}
                targetCNInput="6"
                onRadiusInputChange={jest.fn()}
                onRadiusStepChange={jest.fn()}
                onFindRadiusForCN={jest.fn()}
                onIncrementRadius={jest.fn()}
                onDecrementRadius={jest.fn()}
                onCoordRadiusChange={jest.fn()}
                onAutoRadiusChange={jest.fn()}
                onTargetCNInputChange={jest.fn()}
            />
        );
        expect(container.querySelector('button[aria-label="Increase coordination radius"]')).not.toBeNull();
        expect(container.querySelector('button[aria-label="Decrease coordination radius"]')).not.toBeNull();

        await render(
            <ManualOverridePanel
                atoms={[{ element: 'Fe', x: 0, y: 0, z: 0 }]}
                currentMetal={0}
                currentRadius={3}
                currentCN={2}
                onMetalChange={jest.fn()}
                onRadiusChange={jest.fn()}
                onFindRadiusForCN={jest.fn()}
            />
        );
        expect(container.querySelector('button[aria-label="Increase manual coordination radius"]')).not.toBeNull();
        expect(container.querySelector('button[aria-label="Decrease manual coordination radius"]')).not.toBeNull();
    });

    test('coordination summary omits synthetic quality fields and formats invalid intensive CShM', async () => {
        const text = await render(
            <CoordinationSummary
                atoms={[{ element: 'Fe', x: 0, y: 0, z: 0 }]}
                selectedMetal={0}
                coordAtoms={[]}
                additionalMetrics={null}
                progress={null}
                intensiveProgress={null}
                intensiveMetadata={{
                    metadata: { coordinationNumber: 2, bestGeometry: 'L-2', bestCShM: NaN },
                    ligandGroups: { rings: [], monodentate: [], summary: 'No ligand groups' }
                }}
                analysisParams={{ mode: 'default' }}
                isLoading={false}
                isRunningIntensive={false}
                bestGeometry={null}
                geometryResults={[]}
                onIntensiveAnalysis={jest.fn()}
                onGenerateReport={jest.fn()}
                onGenerateCSV={jest.fn()}
            />
        );

        expect(text).toContain('CShM = N/A');
        expect(text).not.toMatch(/Quality Score|Overall Quality|RMSD|Confidence/);
    });
});
