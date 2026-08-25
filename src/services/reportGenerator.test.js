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

        expect(csvContent.split('\n')[0]).toBe('Rank,Geometry,Point Group,CShM,Status,Details');
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
});
