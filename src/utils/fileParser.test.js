/**
 * File Parser Tests
 *
 * Tests for XYZ file parsing and validation.
 * Ensures robust handling of various file formats, edge cases, and errors.
 */

import {
    validateXYZ,
    parseXYZ,
    isMultiFrameXYZ,
    countXYZFrames,
    validateMultiXYZ,
    parseMultiXYZ,
    parseXYZAuto
} from './fileParser';

describe('validateXYZ - Valid Files', () => {
    test('should validate minimal valid file (1 atom)', () => {
        const content = `1
Comment
Fe  0.0  0.0  0.0`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(true);
        expect(result.warnings).toEqual([]);
    });

    test('should validate water molecule', () => {
        const content = `3
Water
O  0.000  0.000  0.000
H  0.757  0.586  0.000
H -0.757  0.586  0.000`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(true);
        expect(result.warnings).toEqual([]);
    });

    test('should validate file with extra whitespace', () => {
        const content = `  2
  Comment line
Fe    0.0    0.0    0.0
N     2.0    0.0    0.0  `;
        const result = validateXYZ(content);
        expect(result.valid).toBe(true);
    });

    test('should validate file with negative coordinates', () => {
        const content = `2
Negative coords
Fe  -1.5  -2.3  -3.7
N    1.5   2.3   3.7`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(true);
    });

    test('should validate file with scientific notation', () => {
        const content = `2
Scientific notation
Fe  1.5e-2  2.3e1  -3.7e0
N   1.0E+1  2.0E-1  3.0E+0`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(true);
    });
});

describe('validateXYZ - Warnings', () => {
    test('should warn about large structures (>1000 atoms)', () => {
        const lines = ['1001', 'Large structure'];
        for (let i = 0; i < 1001; i++) {
            lines.push(`C  ${i}  ${i}  ${i}`);
        }
        const content = lines.join('\n');
        const result = validateXYZ(content);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('1001 atoms');
    });

    test('should warn about very large coordinates', () => {
        const content = `1
Large coords
Fe  5000  0.0  0.0`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('Very large coordinates');
    });

    test('should warn about unknown elements', () => {
        const content = `2
Unknown element
Fe  0.0  0.0  0.0
Xx  1.0  1.0  1.0`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings.some(w => w.includes('Unknown elements'))).toBe(true);
    });

    test('should limit unknown element warnings to first 5', () => {
        const lines = ['10', 'Many unknown elements'];
        for (let i = 0; i < 10; i++) {
            lines.push(`Xx  ${i}  ${i}  ${i}`);
        }
        const content = lines.join('\n');
        const result = validateXYZ(content);
        expect(result.valid).toBe(true);
        const unknownWarning = result.warnings.find(w => w.includes('Unknown elements'));
        expect(unknownWarning).toContain('...');
    });
});

describe('validateXYZ - Errors', () => {
    test('should reject file with too few lines', () => {
        const content = `2
Only one line`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('too short');
    });

    test('should reject file with empty content', () => {
        const content = '';
        const result = validateXYZ(content);
        expect(result.valid).toBe(false);
    });

    test('should reject file with invalid atom count', () => {
        const content = `abc
Comment
Fe  0.0  0.0  0.0`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid atom count');
    });

    test('should reject file with negative atom count', () => {
        const content = `-1
Comment
Fe  0.0  0.0  0.0`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid atom count');
    });

    test('should reject file with zero atoms', () => {
        const content = `0
Comment
Fe  0.0  0.0  0.0`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid atom count');
    });

    test('should reject file with mismatched atom count', () => {
        const content = `5
Comment
Fe  0.0  0.0  0.0
N   1.0  1.0  1.0`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('claims 5 atoms but only has 2');
    });

    test('should reject file with invalid line format', () => {
        const content = `2
Comment
Fe  0.0  0.0  0.0
InvalidLine`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid format');
    });

    test('should reject file with non-numeric coordinates', () => {
        const content = `1
Comment
Fe  abc  0.0  0.0`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('non-numeric coordinates');
    });

    test('should reject file with missing coordinates', () => {
        const content = `1
Comment
Fe  0.0  0.0`;
        const result = validateXYZ(content);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid format');
    });
});

describe('parseXYZ - Successful Parsing', () => {
    test('should parse minimal file', () => {
        const content = `1
Fe atom
Fe  0.0  0.0  0.0`;
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(1);
        expect(atoms[0]).toEqual({ element: 'Fe', x: 0, y: 0, z: 0 });
    });

    test('should parse water molecule', () => {
        const content = `3
Water
O  0.000  0.000  0.000
H  0.757  0.586  0.000
H -0.757  0.586  0.000`;
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(3);
        expect(atoms[0].element).toBe('O');
        expect(atoms[1].element).toBe('H');
        expect(atoms[2].element).toBe('H');
    });

    test('should normalize element symbols', () => {
        const content = `3
Mixed case
fe  0.0  0.0  0.0
FE  1.0  0.0  0.0
Fe  2.0  0.0  0.0`;
        const atoms = parseXYZ(content);
        expect(atoms.every(a => a.element === 'Fe')).toBe(true);
    });

    test('should handle Windows line endings', () => {
        const content = "2\r\nComment\r\nFe  0.0  0.0  0.0\r\nN   1.0  1.0  1.0";
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(2);
    });

    test('should handle Mac line endings', () => {
        const content = "2\rComment\rFe  0.0  0.0  0.0\rN   1.0  1.0  1.0";
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(2);
    });

    test('should parse coordinates with various formats', () => {
        const content = `4
Various formats
Fe   1.5    2.3    3.7
N   -1.5   -2.3   -3.7
C    0.0    0.0    0.0
O    1e-2   2E1   -3.0e0`;
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(4);
        expect(atoms[0]).toEqual({ element: 'Fe', x: 1.5, y: 2.3, z: 3.7 });
        expect(atoms[1]).toEqual({ element: 'N', x: -1.5, y: -2.3, z: -3.7 });
        expect(atoms[2]).toEqual({ element: 'C', x: 0.0, y: 0.0, z: 0.0 });
        expect(atoms[3]).toEqual({ element: 'O', x: 0.01, y: 20, z: -3.0 });
    });

    test('should skip invalid atoms with warning', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const content = `3
Skip invalid
Fe  0.0  0.0  0.0
N   abc  def  ghi
C   1.0  1.0  1.0`;

        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(2);
        expect(atoms[0].element).toBe('Fe');
        expect(atoms[1].element).toBe('C');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping atom'));

        consoleSpy.mockRestore();
    });

    test('should handle extra columns (ignore them)', () => {
        const content = `2
Extra data
Fe  0.0  0.0  0.0  extra1  extra2
N   1.0  1.0  1.0  more stuff`;
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(2);
        expect(atoms[0]).toEqual({ element: 'Fe', x: 0, y: 0, z: 0 });
    });
});

describe('parseXYZ - Error Cases', () => {
    test('should throw on empty file', () => {
        const content = '';
        expect(() => parseXYZ(content)).toThrow('Failed to parse');
    });

    test('should throw on invalid header', () => {
        const content = `abc
Comment
Fe  0.0  0.0  0.0`;
        expect(() => parseXYZ(content)).toThrow('Atom count is missing or invalid');
    });

    test('should throw when no valid atoms found', () => {
        const content = `2
All invalid
InvalidLine1
InvalidLine2`;
        expect(() => parseXYZ(content)).toThrow('No valid atoms found');
    });

    test('should throw on negative atom count', () => {
        const content = `-1
Comment
Fe  0.0  0.0  0.0`;
        expect(() => parseXYZ(content)).toThrow('invalid');
    });
});

describe('parseXYZ - Edge Cases', () => {
    test('should handle single atom file', () => {
        const content = `1
Single
Fe  1.23  4.56  7.89`;
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(1);
        expect(atoms[0]).toEqual({ element: 'Fe', x: 1.23, y: 4.56, z: 7.89 });
    });

    test('should handle very small coordinates', () => {
        const content = `1
Tiny
Fe  1e-10  2e-10  3e-10`;
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(1);
        expect(atoms[0].x).toBeCloseTo(1e-10, 15);
    });

    test('should handle zero coordinates', () => {
        const content = `1
Zero
Fe  0.0  0.0  0.0`;
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(1);
        expect(atoms[0]).toEqual({ element: 'Fe', x: 0, y: 0, z: 0 });
    });

    test('should handle file with more atoms than claimed (use only claimed count)', () => {
        const content = `2
Claims 2
Fe  0.0  0.0  0.0
N   1.0  1.0  1.0
C   2.0  2.0  2.0
O   3.0  3.0  3.0`;
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(2);
        expect(atoms.map(a => a.element)).toEqual(['Fe', 'N']);
    });

    test('should handle empty comment line', () => {
        const content = "1\n \nFe  0.0  0.0  0.0";
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(1);
    });

    test('should handle multiple spaces between values', () => {
        const content = `1
Multiple spaces
Fe    0.0     0.0      0.0`;
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(1);
        expect(atoms[0]).toEqual({ element: 'Fe', x: 0, y: 0, z: 0 });
    });

    test('should handle tabs as separators', () => {
        const content = "1\nTabs\nFe\t0.0\t0.0\t0.0";
        const atoms = parseXYZ(content);
        expect(atoms).toHaveLength(1);
        expect(atoms[0]).toEqual({ element: 'Fe', x: 0, y: 0, z: 0 });
    });
});

// ==========================================
// Multi-Frame XYZ Tests (v1.5.0)
// ==========================================

describe('isMultiFrameXYZ - Detection', () => {
    test('should detect single-frame file', () => {
        const content = `3
Water
O  0.0  0.0  0.0
H  0.96  0.0  0.0
H -0.24  0.93  0.0`;
        expect(isMultiFrameXYZ(content)).toBe(false);
    });

    test('should detect multi-frame file', () => {
        const content = `2
Frame1
Fe  0.0  0.0  0.0
N   1.0  0.0  0.0
2
Frame2
Fe  0.0  0.0  0.0
N   1.0  1.0  0.0`;
        expect(isMultiFrameXYZ(content)).toBe(true);
    });

    test('should handle empty content', () => {
        expect(isMultiFrameXYZ('')).toBe(false);
        expect(isMultiFrameXYZ(null)).toBe(false);
        expect(isMultiFrameXYZ(undefined)).toBe(false);
    });

    test('should handle invalid content', () => {
        expect(isMultiFrameXYZ('abc\ndef\nghi')).toBe(false);
    });
});

describe('countXYZFrames - Frame Counting', () => {
    test('should count single frame', () => {
        const content = `2
Single
Fe  0.0  0.0  0.0
N   1.0  0.0  0.0`;
        expect(countXYZFrames(content)).toBe(1);
    });

    test('should count multiple frames', () => {
        const content = `2
Frame1
Fe  0.0  0.0  0.0
N   1.0  0.0  0.0
3
Frame2
Fe  0.0  0.0  0.0
N   1.0  0.0  0.0
C   2.0  0.0  0.0
2
Frame3
Zn  0.0  0.0  0.0
O   1.5  0.0  0.0`;
        expect(countXYZFrames(content)).toBe(3);
    });

    test('should return 0 for invalid content', () => {
        expect(countXYZFrames('')).toBe(0);
        expect(countXYZFrames('invalid')).toBe(0);
    });
});

describe('validateMultiXYZ - Multi-Frame Validation', () => {
    test('should validate valid multi-frame file', () => {
        const content = `2
Frame1
Fe  0.0  0.0  0.0
N   1.0  0.0  0.0
2
Frame2
Fe  0.0  0.0  0.0
N   1.0  1.0  0.0`;
        const result = validateMultiXYZ(content);
        expect(result.valid).toBe(true);
        expect(result.frameCount).toBe(2);
        expect(result.errors).toEqual([]);
    });

    test('should detect invalid first frame', () => {
        const content = `abc
Invalid`;
        const result = validateMultiXYZ(content);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid atom count');
    });

    test('should collect warnings from all frames', () => {
        const content = `1
Frame1
Xx  0.0  0.0  0.0
1
Frame2
Yy  1.0  0.0  0.0`;
        const result = validateMultiXYZ(content);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    });
});

describe('parseMultiXYZ - Multi-Frame Parsing', () => {
    test('should parse multi-frame file into structures', () => {
        const content = `2
Frame1
Fe  0.0  0.0  0.0
N   1.0  0.0  0.0
3
Frame2
Zn  0.0  0.0  0.0
O   1.0  0.0  0.0
S   2.0  0.0  0.0`;
        const structures = parseMultiXYZ(content, 'test.xyz');

        expect(structures).toHaveLength(2);

        expect(structures[0].name).toBe('Frame1');
        expect(structures[0].atoms).toHaveLength(2);
        expect(structures[0].format).toBe('xyz');
        expect(structures[0].frameIndex).toBe(0);
        expect(structures[0].source).toBe('test.xyz');

        expect(structures[1].name).toBe('Frame2');
        expect(structures[1].atoms).toHaveLength(3);
        expect(structures[1].frameIndex).toBe(1);
    });

    test('should use generated names when comment is empty', () => {
        const content = `1

Fe  0.0  0.0  0.0
1

N   1.0  0.0  0.0`;
        const structures = parseMultiXYZ(content, 'test');

        expect(structures[0].name).toBe('Structure_1');
        expect(structures[1].name).toBe('Structure_2');
    });

    test('should throw on invalid file', () => {
        const content = 'invalid\ncontent';
        expect(() => parseMultiXYZ(content)).toThrow('Failed to parse');
    });
});

describe('parseXYZAuto - Auto-Detection', () => {
    test('should parse single-frame file as array with one structure', () => {
        const content = `2
Single
Fe  0.0  0.0  0.0
N   1.0  0.0  0.0`;
        const structures = parseXYZAuto(content, 'test');

        expect(structures).toHaveLength(1);
        expect(structures[0].name).toBe('Single');
        expect(structures[0].atoms).toHaveLength(2);
    });

    test('should parse multi-frame file as array with multiple structures', () => {
        const content = `2
Frame1
Fe  0.0  0.0  0.0
N   1.0  0.0  0.0
2
Frame2
Zn  0.0  0.0  0.0
O   1.0  0.0  0.0`;
        const structures = parseXYZAuto(content, 'test');

        expect(structures).toHaveLength(2);
        expect(structures[0].name).toBe('Frame1');
        expect(structures[1].name).toBe('Frame2');
    });
});
