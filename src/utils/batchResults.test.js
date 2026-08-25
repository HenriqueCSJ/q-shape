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
        expect(batchResultDetail(result)).toBe('');
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
