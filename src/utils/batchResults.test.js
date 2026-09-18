import {
    BATCH_RESULT_STATUS,
    batchResultDetail,
    batchResultStatusLabel,
    createBatchFailureResult,
    getBatchResultStatus
} from './batchResults';

describe('batch result terminal records', () => {
    test('classifies a retained finite best geometry as available', () => {
        const result = {
            bestGeometry: { name: 'L-2', shapeMeasure: 0.25 },
            geometryResults: [{ name: 'L-2', shapeMeasure: 0.25 }]
        };

        expect(getBatchResultStatus(result)).toBe(BATCH_RESULT_STATUS.AVAILABLE);
        expect(batchResultStatusLabel(result)).toBe('Available');
        expect(batchResultDetail(result)).toBe('1/1 geometries available');
    });

    test('describes a complete run using its actual radius, target count, search and elapsed time', () => {
        const result = {
            radius: 2.75,
            analysisMode: 'intensive',
            geometryResults: [
                { name: 'OC-6', shapeMeasure: 0.25 },
                { name: 'TPR-6', shapeMeasure: 5.5 }
            ],
            metadata: {
                geometryCount: 2,
                analysisComplete: true,
                fullReferenceCensus: true,
                searchProfile: 'exact-permutation',
                elapsedSeconds: 1.24
            }
        };

        expect(batchResultStatusLabel(result)).toBe('Available');
        expect(batchResultDetail(result)).toBe(
            'Radius 2.750 Å · 2/2 geometries available · Exact permutation search · 1.2 s'
        );
    });

    test('marks mixed targets partial and retains diagnostics despite an available best geometry', () => {
        const result = {
            status: 'available',
            bestGeometry: { name: 'A', shapeMeasure: 0.25 },
            geometryResults: [
                { name: 'A', shapeMeasure: 0.25 },
                { name: 'B', status: 'error', error: 'target failed' },
                { name: 'C', status: 'error', error: 'target failed' }
            ]
        };

        expect(getBatchResultStatus(result)).toBe(BATCH_RESULT_STATUS.PARTIAL);
        expect(batchResultStatusLabel(result)).toBe('Partial');
        expect(batchResultDetail(result)).toBe('1/3 geometries available · target failed');
    });

    test('does not call an incomplete returned census fully available', () => {
        const result = {
            geometryResults: [{ name: 'A', shapeMeasure: 0.25 }],
            metadata: { geometryCount: 3, analysisComplete: false }
        };

        expect(batchResultStatusLabel(result)).toBe('Partial');
        expect(batchResultDetail(result)).toContain('1/3 geometries available');
        expect(batchResultDetail(result)).toContain('2 missing result(s)');
    });

    test('respects incomplete metadata even when all returned targets are available', () => {
        const result = {
            geometryResults: [{ name: 'A', shapeMeasure: 0.25 }],
            metadata: { fullReferenceCensus: false }
        };

        expect(batchResultStatusLabel(result)).toBe('Partial');
        expect(batchResultDetail(result)).toContain('Reference census incomplete');
    });

    test('retains run-level diagnostics alongside available geometry details', () => {
        const result = {
            geometryResults: [{ name: 'A', shapeMeasure: 0.25 }],
            metadata: { error: 'one result was lost' }
        };

        expect(batchResultStatusLabel(result)).toBe('Partial');
        expect(batchResultDetail(result)).toBe('1/1 geometries available · one result was lost');
    });

    test('does not invent missing metadata or treat a status flag alone as a usable result', () => {
        expect(batchResultStatusLabel({ status: 'available' })).toBe('N/A');
        expect(batchResultDetail({ status: 'available' })).toBe('No usable geometry result was produced.');
        expect(batchResultDetail({
            bestGeometry: { name: 'A', shapeMeasure: 1 },
            radius: NaN,
            metadata: { elapsedSeconds: Infinity }
        })).toBe('Geometry counts unavailable');
    });

    test('describes extended search as a request without asserting extra solver stages ran', () => {
        expect(batchResultDetail({
            geometryResults: [{ name: 'A', shapeMeasure: 0.25 }],
            analysisMode: 'intensive',
            metadata: { radius: 3.125, searchProfile: 'anchor-plus-extended-bounded' }
        })).toBe('Radius 3.125 Å · 1/1 geometries available · Extended search requested');
    });

    test('retains deduplicated geometry diagnostics when no target is usable', () => {
        const result = {
            geometryResults: [
                { name: 'A', status: 'error', error: 'target failed' },
                { name: 'B', status: 'error', error: 'target failed' },
                { name: 'C', status: 'invalid', error: 'invalid CShM' }
            ]
        };

        expect(getBatchResultStatus(result)).toBe(BATCH_RESULT_STATUS.UNAVAILABLE);
        expect(batchResultStatusLabel(result)).toBe('N/A');
        expect(batchResultDetail(result)).toBe('target failed; invalid CShM');
    });

    test('normalizes a thrown non-Error value into a terminal structure record', () => {
        expect(createBatchFailureResult({ message: 'worker disconnected' }, {
            metalIndex: 2
        })).toMatchObject({
            status: BATCH_RESULT_STATUS.ERROR,
            error: 'worker disconnected',
            bestGeometry: null,
            geometryResults: [],
            metalIndex: 2,
            metadata: { error: 'worker disconnected' }
        });
    });

    test('uses a non-empty fallback when a rejection has no diagnostic', () => {
        const result = createBatchFailureResult(null);
        expect(result.status).toBe(BATCH_RESULT_STATUS.ERROR);
        expect(result.error).toBe('Batch analysis failed without a diagnostic message.');
        expect(batchResultStatusLabel(result)).toBe('Error');
        expect(batchResultDetail(result)).toBe(result.error);
    });
});
