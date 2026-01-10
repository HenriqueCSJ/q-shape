/**
 * parseInput Tests - v1.5.0
 *
 * Tests for the unified parser that handles XYZ (single/multi-frame) and CIF files.
 */

import { parseInput, detectFormat, parseXYZMultiFrame, parseCIF } from './parseInput';

describe('parseInput - Format Detection', () => {
    it('should detect XYZ format from extension', () => {
        expect(detectFormat('3\nTest\nFe 0 0 0', 'test.xyz')).toBe('xyz');
    });

    it('should detect CIF format from extension', () => {
        expect(detectFormat('data_test\n_cell_length_a 10', 'test.cif')).toBe('cif');
    });

    it('should detect XYZ format from content when extension unknown', () => {
        const content = '3\nTest molecule\nFe 0 0 0\nN 2 0 0\nN 0 2 0';
        expect(detectFormat(content, 'test.dat')).toBe('xyz');
    });

    it('should detect CIF format from content when extension unknown', () => {
        const content = 'data_test\n_cell_length_a 10.5\n_atom_site_label Fe1';
        expect(detectFormat(content, 'test.dat')).toBe('cif');
    });

    it('should return unknown for unrecognized format', () => {
        expect(detectFormat('random text', 'test.txt')).toBe('unknown');
    });
});

describe('parseInput - Single XYZ', () => {
    it('should parse a valid single-structure XYZ file', () => {
        const content = `3
Water molecule
O  0.000  0.000  0.000
H  0.757  0.586  0.000
H -0.757  0.586  0.000`;

        const result = parseInput(content, 'water.xyz');

        expect(result.valid).toBe(true);
        expect(result.format).toBe('xyz');
        expect(result.frameCount).toBe(1);
        expect(result.structures.length).toBe(1);
        expect(result.structures[0].atoms.length).toBe(3);
        expect(result.structures[0].atoms[0].element).toBe('O');
    });

    it('should use comment as structure ID when appropriate', () => {
        const content = `3
LMMPa
Fe 0 0 0
N 2 0 0
N 0 2 0`;

        const result = parseInput(content, 'complex.xyz');
        expect(result.structures[0].id).toBe('LMMPa');
    });

    it('should generate ID from filename when comment is empty', () => {
        const content = `3

Fe 0 0 0
N 2 0 0
N 0 2 0`;

        const result = parseInput(content, 'mycomplex.xyz');
        expect(result.structures[0].id).toBe('mycomplex');
    });

    it('should fail on invalid atom count', () => {
        const content = `not_a_number
Test
Fe 0 0 0`;

        const result = parseInput(content, 'test.xyz');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid atom count');
    });

    it('should fail when atom count exceeds data lines', () => {
        const content = `10
Test
Fe 0 0 0
N 2 0 0`;

        const result = parseInput(content, 'test.xyz');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('claims 10 atoms');
    });
});

describe('parseInput - Multi-frame XYZ', () => {
    it('should parse multiple frames', () => {
        const content = `2
Frame 1
Fe 0 0 0
N 2 0 0
2
Frame 2
Fe 0 0 1
N 2 0 1`;

        const result = parseInput(content, 'trajectory.xyz');

        expect(result.valid).toBe(true);
        expect(result.frameCount).toBe(2);
        expect(result.structures.length).toBe(2);
        // IDs are extracted from comment line - "Frame 1" becomes "1" after removing "frame" prefix
        expect(result.structures[0].id).toBe('1');
        expect(result.structures[1].id).toBe('2');
    });

    it('should handle empty lines between frames', () => {
        const content = `2
Frame 1
Fe 0 0 0
N 2 0 0

2
Frame 2
Fe 1 0 0
N 3 0 0

`;

        const result = parseInput(content, 'trajectory.xyz');
        expect(result.valid).toBe(true);
        expect(result.frameCount).toBe(2);
    });

    it('should stop at malformed frame in tolerant mode', () => {
        const content = `2
Good Frame
Fe 0 0 0
N 2 0 0
bad_header
broken frame`;

        const result = parseInput(content, 'trajectory.xyz');
        expect(result.valid).toBe(true);
        expect(result.frameCount).toBe(1);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should generate sequential IDs when comments are generic', () => {
        const content = `2

Fe 0 0 0
N 2 0 0
2

Fe 1 0 0
N 3 0 0`;

        const result = parseInput(content, 'traj.xyz');
        expect(result.valid).toBe(true);
        expect(result.structures[0].id).toBe('traj');
        expect(result.structures[1].id).toBe('traj:frame-002');
    });
});

describe('parseInput - CIF Basic Parsing', () => {
    it('should parse a simple CIF file with Cartesian coordinates', () => {
        const content = `data_test
_cell_length_a 10.0
_cell_length_b 10.0
_cell_length_c 10.0
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_Cartn_x
_atom_site_Cartn_y
_atom_site_Cartn_z
Fe1 Fe 0.0 0.0 0.0
N1 N 2.0 0.0 0.0
N2 N 0.0 2.0 0.0`;

        const result = parseInput(content, 'test.cif');

        expect(result.valid).toBe(true);
        expect(result.format).toBe('cif');
        expect(result.structures.length).toBe(1);
        expect(result.structures[0].id).toBe('test');
        expect(result.structures[0].atoms.length).toBe(3);
    });

    it('should parse CIF with fractional coordinates and unit cell', () => {
        const content = `data_NaCl
_cell_length_a 5.64
_cell_length_b 5.64
_cell_length_c 5.64
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Na1 Na 0.0 0.0 0.0
Cl1 Cl 0.5 0.5 0.5`;

        const result = parseInput(content, 'nacl.cif');

        expect(result.valid).toBe(true);
        expect(result.structures.length).toBe(1);
        expect(result.structures[0].atoms.length).toBe(2);
        // Check that fractional coords were converted to Cartesian
        expect(result.structures[0].atoms[0].x).toBeCloseTo(0, 2);
        expect(result.structures[0].atoms[1].x).toBeCloseTo(2.82, 1);
    });

    it('should handle multiple data blocks', () => {
        const content = `data_block1
_cell_length_a 10.0
_cell_length_b 10.0
_cell_length_c 10.0
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_Cartn_x
_atom_site_Cartn_y
_atom_site_Cartn_z
Fe1 Fe 0.0 0.0 0.0

data_block2
_cell_length_a 10.0
_cell_length_b 10.0
_cell_length_c 10.0
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_Cartn_x
_atom_site_Cartn_y
_atom_site_Cartn_z
Cu1 Cu 1.0 1.0 1.0`;

        const result = parseInput(content, 'multi.cif');

        expect(result.valid).toBe(true);
        expect(result.frameCount).toBe(2);
        // First block uses block name directly, subsequent blocks include filename prefix
        expect(result.structures[0].id).toBe('block1');
        expect(result.structures[1].id).toBe('multi:block2');
    });

    it('should fail gracefully with no atom coordinates', () => {
        const content = `data_empty
_cell_length_a 10.0`;

        const result = parseInput(content, 'empty.cif');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('No valid structures');
    });
});

describe('parseInput - Edge Cases', () => {
    it('should handle empty content', () => {
        const result = parseInput('', 'test.xyz');
        expect(result.valid).toBe(false);
    });

    it('should handle null content', () => {
        const result = parseInput(null, 'test.xyz');
        expect(result.valid).toBe(false);
    });

    it('should handle unknown file format', () => {
        const result = parseInput('random data', 'test.unknown');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unknown file format');
    });

    it('should normalize element symbols', () => {
        const content = `3
Test
FE 0 0 0
n 2 0 0
CL 0 2 0`;

        const result = parseInput(content, 'test.xyz');
        expect(result.structures[0].atoms[0].element).toBe('Fe');
        expect(result.structures[0].atoms[1].element).toBe('N');
        expect(result.structures[0].atoms[2].element).toBe('Cl');
    });

    it('should warn about large coordinates', () => {
        const content = `1
Test
Fe 10000 0 0`;

        const result = parseInput(content, 'test.xyz');
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('large coordinates'))).toBe(true);
    });
});
