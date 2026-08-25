import {
    formatShapeMeasure,
    isValidShapeMeasure
} from './geometry';

describe('CShM reporting helpers', () => {
    test.each([NaN, Infinity, -Infinity, -0.0001, 100.0001, 101, null, undefined, '0.1'])(
        'rejects invalid value %p',
        (value) => {
            expect(isValidShapeMeasure(value)).toBe(false);
            expect(formatShapeMeasure(value)).toBe('N/A');
        }
    );

    test('normalizes negative zero without displaying a negative sign', () => {
        expect(isValidShapeMeasure(-0)).toBe(true);
        expect(formatShapeMeasure(-0)).toBe('0.0000');
    });

    test('supports an explicit invalid label and validates precision', () => {
        expect(formatShapeMeasure(NaN, 3, '—')).toBe('—');
        expect(formatShapeMeasure(1.23456, 3)).toBe('1.235');
        expect(() => formatShapeMeasure(1, -1)).toThrow(RangeError);
        expect(() => formatShapeMeasure(1, 21)).toThrow(RangeError);
    });
});
