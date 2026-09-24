import { Matrix4 } from 'three';
import { SHAPE_COMPARISON_CONVENTION } from '../constants/shapeComparison';
import {
    generateBatchPDFReport,
    generateCSVReport,
    generateLongDetailedCSV,
    generatePDFReport,
    generateWideSummaryCSV
} from './reportGenerator';

describe('scientific report surfaces', () => {
    let reportWrite;
    let originalOpen;
    let originalBlob;
    let originalCreateObjectURL;
    let originalAnchorClick;
    let csvContent;

    beforeEach(() => {
        reportWrite = jest.fn();
        originalOpen = window.open;
        window.open = jest.fn(() => ({
            document: {
                write: reportWrite,
                close: jest.fn()
            }
        }));

        csvContent = '';
        originalBlob = global.Blob;
        global.Blob = class TestBlob {
            constructor(parts) {
                csvContent = parts.join('');
            }
        };
        originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = jest.fn(() => 'blob:test');
        originalAnchorClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = jest.fn();
    });

    afterEach(() => {
        window.open = originalOpen;
        global.Blob = originalBlob;
        URL.createObjectURL = originalCreateObjectURL;
        HTMLAnchorElement.prototype.click = originalAnchorClick;
    });

    const singleReportParams = {
        atoms: [{ element: 'Fe', x: 0, y: 0, z: 0 }],
        selectedMetal: 0,
        bestGeometry: { name: 'L-2', shapeMeasure: -0 },
        coordAtoms: [],
        coordRadius: 2,
        geometryResults: [
            { name: 'L-2', shapeMeasure: -0 },
            { name: 'vT-2', shapeMeasure: NaN, status: 'error', error: 'synthetic target failure' },
            { name: 'undefined-value', shapeMeasure: undefined },
            { name: 'out-of-domain', shapeMeasure: 100.0001 },
            { name: 'Unknown', shapeMeasure: -1 }
        ],
        additionalMetrics: null,
        warnings: [],
        fileName: 'test',
        fileFormat: 'xyz',
        structureId: 'structure-1',
        analysisMode: 'default',
        intensiveMetadata: null,
        imgData: 'data:image/png;base64,'
    };

    const structures = [{
        id: 'structure-1',
        atoms: [{ element: 'Fe', x: 0, y: 0, z: 0 }]
    }];
    const batchResults = new Map([[
        0,
        {
            bestGeometry: { name: 'L-2', shapeMeasure: -0 },
            geometryResults: [
                { name: 'L-2', shapeMeasure: -0 },
                { name: 'vT-2', shapeMeasure: NaN, status: 'error', error: 'synthetic target failure' },
                { name: 'undefined-value', shapeMeasure: undefined },
                { name: 'out-of-domain', shapeMeasure: 100.0001 }
            ],
            coordAtoms: [],
            metalIndex: 0,
            coordinationNumber: 2,
            radius: 2,
            analysisMode: 'default'
        }
    ]]);

    test('single HTML report omits synthetic quality, RMSD, and confidence outputs', () => {
        generatePDFReport(singleReportParams);
        const html = reportWrite.mock.calls[0][0];

        expect(html).toContain('0.0000');
        expect(html).toContain('<strong>Source file:</strong> test.xyz');
        expect(html).toContain('<strong>Structure:</strong> structure-1');
        expect(html).toContain('same-CN reference geometries');
        expect(html).not.toContain('analyzes your structure against <strong>');
        expect(html).toContain('N/A');
        expect(html).toContain('synthetic target failure');
        expect(html).not.toContain('-0.0000');
        expect(html).not.toMatch(/Quality Metrics|Overall Quality Score|RMSD|Confidence|Polyhedral Volume|Shape Deviation|Interpretation|Perfect|Excellent|Good|Moderate|Poor/);
    });

    test('sandwich annotation states that centroids are informational only', () => {
        generatePDFReport({
            ...singleReportParams,
            intensiveMetadata: {
                metadata: {},
                ligandGroups: {
                    summary: '2 detected rings',
                    rings: [],
                    hasMultipleLargeRings: true
                }
            }
        });
        const html = reportWrite.mock.calls[0][0];

        expect(html).toContain('does not verify ring parallelism');
        expect(html).toContain('uses the individual coordinating atoms');
        expect(html).not.toContain('treats ring centroids as coordination sites');
        expect(html).not.toContain('Sandwich Structure Detected');
    });

    test('single CSV uses the shared formatter and has no confidence column', () => {
        generateCSVReport({
            geometryResults: singleReportParams.geometryResults,
            fileName: 'test'
        });

        expect(csvContent.split('\n')[0]).toBe('Rank,Geometry,Point Group,CShM,Status,Details,CShM_Full_Precision,Comparison_Convention,Alignment_Parity,Transformation_Matrix,Alignment_Record_JSON,Analysis_Context_JSON');
        expect(csvContent).toContain('0.0000');
        expect(csvContent).toContain('N/A');
        expect(csvContent).toContain('synthetic target failure');
        expect(csvContent).not.toContain('-0.0000');
        expect(csvContent).not.toMatch(/Confidence|confidence/);
    });

    test('batch HTML and CSV exports omit removed metrics and probability-like columns', () => {
        generateBatchPDFReport({
            structures,
            batchResults,
            fileName: 'batch',
            fileFormat: 'xyz'
        });
        const html = reportWrite.mock.calls[0][0];
        expect(html).toContain('<th>Status</th>');
        expect(html).toContain('synthetic target failure');
        expect(html).not.toMatch(/Quality Metrics|Overall Quality Score|RMSD|Confidence|Polyhedral Volume|Shape Deviation|Interpretation|Perfect|Excellent|Good|Moderate|Poor/);
        expect(html).not.toContain('-0.0000');

        generateWideSummaryCSV({ structures, batchResults, fileName: 'batch' });
        expect(csvContent.split('\n')[0]).toContain('Status,Details');
        expect(csvContent.split('\n')[0]).not.toMatch(/Confidence|confidence/);
        expect(csvContent).not.toContain('-0.0000');

        generateLongDetailedCSV({ structures, batchResults, fileName: 'batch' });
        expect(csvContent.split('\n')[0]).toContain('Status,Details');
        expect(csvContent.split('\n')[0]).not.toMatch(/Confidence|confidence/);
        expect(csvContent).toContain('N/A');
        expect(csvContent).toContain('synthetic target failure');
        expect(csvContent).not.toContain('-0.0000');
    });

    test('batch summaries retain a structure when every geometry is unavailable', () => {
        const unavailableResults = new Map([[
            0,
            {
                bestGeometry: null,
                geometryResults: [{
                    name: 'L-2',
                    shapeMeasure: null,
                    status: 'error',
                    error: 'all targets unavailable'
                }],
                coordAtoms: [],
                metalIndex: 0,
                coordinationNumber: 2,
                radius: 2,
                analysisMode: 'intensive'
            }
        ]]);

        generateBatchPDFReport({
            structures,
            batchResults: unavailableResults,
            fileName: 'batch',
            fileFormat: 'xyz'
        });
        const html = reportWrite.mock.calls[0][0];
        expect(html).toMatch(/<td><strong>structure-1<\/strong><\/td>[\s\S]*?<td>N\/A<\/td>[\s\S]*?<td style="font-family: monospace;">N\/A<\/td>/);
        expect(html).toContain('all targets unavailable');

        generateWideSummaryCSV({
            structures,
            batchResults: unavailableResults,
            fileName: 'batch'
        });
        expect(csvContent).toContain(
            '"structure-1","Fe",2,2.000,"N/A","",N/A,"N/A","all targets unavailable","intensive"'
        );
    });

    test('terminal structure failures survive PDF and both CSV shapes with escaped diagnostics', () => {
        const externalStructures = [{
            id: 'complex, "quoted"\nline',
            atoms: [{ element: 'Fe', x: 0, y: 0, z: 0 }]
        }];
        const diagnostic = 'optimizer, said "no"\nretry';
        const failedResults = new Map([[
            0,
            {
                status: 'error',
                error: diagnostic,
                bestGeometry: null,
                geometryResults: [],
                coordAtoms: [],
                metalIndex: 0,
                coordinationNumber: null,
                radius: 2,
                analysisMode: 'intensive'
            }
        ]]);

        generateBatchPDFReport({
            structures: externalStructures,
            batchResults: failedResults,
            fileName: 'batch',
            fileFormat: 'xyz'
        });
        const html = reportWrite.mock.calls[0][0];
        expect(html).toContain('<th>Status</th>');
        expect(html).toContain('<th>Details</th>');
        expect(html).toContain('Error');
        expect(html).toContain('optimizer, said &quot;no&quot;\nretry');
        expect(html).toContain('complex, &quot;quoted&quot;\nline');
        expect(html).toContain('<strong>Structures Processed:</strong> 1 of 1');

        generateWideSummaryCSV({
            structures: externalStructures,
            batchResults: failedResults,
            fileName: 'batch'
        });
        expect(csvContent.split('\n')[0]).toContain('Status,Details');
        expect(csvContent).toContain('"complex, ""quoted""\nline"');
        expect(csvContent).toContain('"optimizer, said ""no""\nretry"');
        expect(csvContent).toContain('"Error"');

        generateLongDetailedCSV({
            structures: externalStructures,
            batchResults: failedResults,
            fileName: 'batch'
        });
        expect(csvContent.split('\n')[0]).toContain('Status,Details');
        expect(csvContent).toContain('"complex, ""quoted""\nline"');
        expect(csvContent).toContain('"N/A"');
        expect(csvContent).toContain('"Error"');
        expect(csvContent).toContain('"optimizer, said ""no""\nretry"');
    });

    test('single and batch HTML reports encode every untrusted text surface', () => {
        const payload = '<svg/onload=alert(1)>';
        generatePDFReport({
            ...singleReportParams,
            atoms: [{ element: payload, x: 0, y: 0, z: 0 }],
            bestGeometry: { name: payload, shapeMeasure: 1 },
            coordAtoms: [{
                atom: { element: payload, x: 1, y: 0, z: 0 },
                distance: 1
            }],
            geometryResults: [{ name: payload, shapeMeasure: 1 }],
            warnings: [payload],
            fileName: payload,
            intensiveMetadata: {
                metadata: {
                    patternDetected: payload,
                    coordinationNumber: payload,
                    bestGeometry: payload,
                    bestCShM: 1
                },
                ligandGroups: {
                    summary: payload,
                    rings: [{ ringSizeLabel: payload, size: payload, distanceToMetal: 1 }],
                    hasMultipleLargeRings: false
                }
            },
            imgData: `data:image/png;base64," onerror="${payload}`
        });
        const singleHtml = reportWrite.mock.calls[0][0];
        const singleDocument = new DOMParser().parseFromString(singleHtml, 'text/html');
        const snapshot = singleDocument.querySelector('img[alt="3D rendering of the coordination complex"]');
        expect(singleHtml).toContain('&lt;svg/onload=alert(1)&gt;');
        expect(singleHtml).not.toContain(payload);
        expect(singleDocument.querySelector('svg')).toBeNull();
        expect(snapshot.getAttribute('src')).toBe('');
        expect(snapshot.hasAttribute('onerror')).toBe(false);
        expect(window.open.mock.results[0].value.opener).toBeNull();

        reportWrite.mockClear();
        const hostileStructures = [{
            id: payload,
            atoms: [{ element: payload, x: 0, y: 0, z: 0 }]
        }];
        const hostileBatchResults = new Map([[0, {
            bestGeometry: { name: payload, shapeMeasure: 1 },
            geometryResults: [{ name: payload, shapeMeasure: 1 }],
            coordAtoms: [{
                atom: { element: payload, x: 1, y: 0, z: 0 },
                distance: 1
            }],
            metalIndex: 0,
            coordinationNumber: 2,
            radius: 2,
            analysisMode: 'intensive',
            ligandGroups: {
                ringCount: 1,
                hasMultipleLargeRings: false,
                summary: payload,
                rings: [{ ringSizeLabel: payload, size: payload, distanceToMetal: 1 }]
            }
        }]]);
        generateBatchPDFReport({
            structures: hostileStructures,
            batchResults: hostileBatchResults,
            fileName: payload,
            fileFormat: payload
        });
        const batchHtml = reportWrite.mock.calls[0][0];
        const batchDocument = new DOMParser().parseFromString(batchHtml, 'text/html');
        expect(batchHtml).toContain('&lt;svg/onload=alert(1)&gt;');
        expect(batchHtml).not.toContain(payload);
        expect(batchHtml).toContain('.unknown</p>');
        expect(batchDocument.querySelector('svg')).toBeNull();
        expect(window.open.mock.results[1].value.opener).toBeNull();
    });

    test('CSV exports neutralize spreadsheet formula prefixes in text fields', () => {
        const formulaStructures = [{
            id: '  =HYPERLINK("https://invalid.example")',
            atoms: [{ element: 'Fe', x: 0, y: 0, z: 0 }]
        }];
        const formulaResults = new Map([[0, {
            status: 'error',
            error: '@SUM(1,1)',
            bestGeometry: null,
            geometryResults: [],
            coordAtoms: [],
            metalIndex: 0,
            coordinationNumber: null,
            radius: 2,
            analysisMode: 'intensive'
        }]]);

        generateWideSummaryCSV({
            structures: formulaStructures,
            batchResults: formulaResults,
            fileName: 'batch'
        });
        expect(csvContent).toContain('"\'  =HYPERLINK(""https://invalid.example"")"');
        expect(csvContent).toContain('"\'@SUM(1,1)"');

        generateCSVReport({
            geometryResults: [{
                name: '+formula-marker',
                shapeMeasure: null,
                status: 'error',
                error: '-formula-detail'
            }],
            fileName: 'single'
        });
        expect(csvContent).toContain('"\'+formula-marker"');
        expect(csvContent).toContain('"\'-formula-detail"');
    });

    test('native reports preserve the selected mirrored overlay separately from the minimum and export exact tuples', () => {
        const matrix = new Matrix4().makeScale(-1, 1, 1);
        const mirrored = { name: 'JATDI-10 selected reference', shapeMeasure: 19.301246399556728,
            comparisonConvention: SHAPE_COMPARISON_CONVENTION, alignmentParity: -1,
            transformationMatrix: matrix, rotationMatrix: matrix,
            properRotationMatrix: new Matrix4(), matching: [[0, 1], [1, 0]],
            alignedCoords: [[-1, 0, 0], [0, 0, 0]], refCoords: [[1, 0, 0], [0, 0, 0]],
            branchScores: { proper: 19.319084613179825, reflected: 19.301246399556728 } };
        const proper = { ...mirrored, name: 'Minimum proper reference', shapeMeasure: 1,
            alignmentParity: 1, transformationMatrix: new Matrix4(), rotationMatrix: new Matrix4() };
        const params = { ...singleReportParams, geometryResults: [proper, mirrored], bestGeometry: proper,
            displayGeometry: mirrored, showIdeal: true,
            atoms: [{ element: 'Fe', x: 0, y: 0, z: 0 }, { element: 'N', x: 1.123456789012345, y: 0, z: 0 }],
            selectedMetal: 0, coordAtoms: [{ idx: 1, atom: { element: 'N', x: 1.123456789012345, y: 0, z: 0 }, distance: 1.123456789012345 }], coordRadius: 2.34567890123456 };
        generatePDFReport(params);
        const doc = new DOMParser().parseFromString(reportWrite.mock.calls.at(-1)[0], 'text/html');
        const caption = [...doc.querySelectorAll('p')].find(p => p.textContent.startsWith('Displayed overlay:')).textContent;
        expect(caption).toContain('JATDI-10 selected reference — Mirrored reference alignment');
        expect(caption).not.toContain('Minimum proper reference');
        const exported = JSON.parse(doc.querySelector('details pre').textContent);
        expect(doc.querySelector('details').hasAttribute('open')).toBe(false);
        expect(doc.querySelector('details').classList.contains('no-print')).toBe(true);
        expect(exported.minimumResult.name).toBe('Minimum proper reference');
        expect(exported.displayedOverlay.name).toBe(mirrored.name);
        expect(exported.displayedOverlay.shapeMeasure).toBe(mirrored.shapeMeasure);
        expect(exported.displayedOverlay.transformationMatrix).toEqual(matrix.toArray());
        expect(exported.displayedOverlay.rotationMatrix).toEqual(matrix.toArray());
        expect(exported.displayedOverlay.matching).toEqual(mirrored.matching);
        expect(exported.context.atoms).toEqual(params.atoms);
        expect(exported.context.selectedDonorIndices).toEqual([1]);
        expect(exported.context.coordRadius).toBe(params.coordRadius);

        const structure = { id: 'mirror-case', atoms: params.atoms };
        const result = { geometryResults: [proper, mirrored], bestGeometry: proper,
            metalIndex: 0, coordAtoms: params.coordAtoms, radius: params.coordRadius,
            coordinationNumber: 1, analysisMode: 'intensive' };
        const batch = { structures: [structure], batchResults: new Map([[0, result]]), fileName: 'mirror', fileFormat: 'xyz' };
        generateBatchPDFReport(batch);
        const batchDoc = new DOMParser().parseFromString(reportWrite.mock.calls.at(-1)[0], 'text/html');
        const batchExport = JSON.parse(batchDoc.querySelector('details pre').textContent);
        expect(batchDoc.body.textContent).toContain('Mirrored reference alignment');
        expect(batchExport.structures[0].results[1].branchScores).toEqual(mirrored.branchScores);
        expect(batchExport.structures[0].results[1].alignmentParity).toBe(-1);

        for (const generate of [() => generateCSVReport({ ...params, fileName: 'mirror' }), () => generateLongDetailedCSV(batch)]) {
            generate();
            expect(csvContent).toContain('19.301246399556728');
            expect(csvContent).toContain(SHAPE_COMPARISON_CONVENTION);
            expect(csvContent).toContain('""alignmentParity"":-1');
            expect(csvContent).toContain('""selectedDonorIndices"":[1]');
            expect(csvContent).toContain('1.123456789012345');
            expect(csvContent).toContain('""transformationMatrix"":' + JSON.stringify(matrix.toArray()));
        }
        generateWideSummaryCSV({ ...batch, batchResults: new Map([[0, { ...result, bestGeometry: mirrored }]]) });
        expect(csvContent).toContain('19.301246399556728');
        expect(csvContent).toContain('""alignmentParity"":-1');
    });
});
