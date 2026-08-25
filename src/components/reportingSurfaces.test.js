import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import BatchModePanel from './BatchModePanel';
import BatchSummaryTable from './BatchSummaryTable';
import CoordinationSummary from './CoordinationSummary';
import ResultsDisplay from './ResultsDisplay';

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
