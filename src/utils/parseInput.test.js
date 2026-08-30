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

    it('should reject an XYZ atom count with a trailing suffix', () => {
        const result = parseInput('2junk\nTest\nFe 0 0 0\nN 1 0 0', 'test.xyz');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid atom count');
    });

    it('should reject a coordinate token with a trailing suffix but accept an exponent', () => {
        const malformed = parseInput('1\nTest\nFe 1.0abc 0 0', 'bad.xyz');
        expect(malformed.valid).toBe(false);
        expect(malformed.error).toContain('Frame 1 rejected');

        const exponent = parseInput('1\nTest\nFe -1.2e+3 0 0', 'exponent.xyz');
        expect(exponent.valid).toBe(true);
        expect(exponent.structures[0].atoms[0].x).toBe(-1200);
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

    it('should convert fractional-coordinate CIF using the unit cell', () => {
        const content = `data_NaCl
_cell_length_a 5.64(2)
_cell_length_b 5.64(2)
_cell_length_c 5.64(2)
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
Cl1 Cl 0.5(1) 0.5(1) 0.5(1)`;

        const result = parseInput(content, 'nacl.cif');

        expect(result.valid).toBe(true);
        expect(result.structures.length).toBe(1);
        expect(result.structures[0].atoms.length).toBe(2);
        expect(result.structures[0].atoms[0].x).toBeCloseTo(0, 8);
        expect(result.structures[0].atoms[1].x).toBeCloseTo(2.82, 8);
        expect(result.structures[0].atoms[1].y).toBeCloseTo(2.82, 8);
        expect(result.structures[0].atoms[1].z).toBeCloseTo(2.82, 8);
        expect(result.structures[0].metadata.parseProvenance).toBe('cif-fractional-to-cartesian');
        expect(result.warnings).toContain(
            'Fractional CIF coordinates were converted to Cartesian coordinates from the unit cell; crystallographic symmetry and periodic images are not expanded.'
        );
    });

    it('should parse every block in a multi-block fractional-coordinate CIF', () => {
        const block = (name, element, x) => `data_${name}
_cell_length_a 10
_cell_length_b 10
_cell_length_c 10
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
${element}1 ${element} ${x} 0.25 0.5`;
        const blockNames = ['1', '9', '2', '7', '8', '3', '6', '4', '10'];
        const content = blockNames.map((name, index) =>
            block(name, 'Fe', (index + 1) / 10)
        ).join('\n\n');

        const result = parseInput(content, 'multi-fractional.cif');

        expect(result.valid).toBe(true);
        expect(result.frameCount).toBe(9);
        expect(result.warnings).toEqual([
            'Fractional CIF coordinates were converted to Cartesian coordinates from the unit cell; crystallographic symmetry and periodic images are not expanded.'
        ]);
        result.structures.forEach((structure, index) => {
            expect(structure.atoms[0].x).toBeCloseTo(index + 1, 8);
        });
    });

    it('should reject invalid fractional rows instead of silently dropping atoms', () => {
        const content = `data_invalid_fractional
_cell_length_a 10
_cell_length_b 10
_cell_length_c 10
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Fe1 Fe 0 0 0
N1 N ? 0.2 0.3`;

        const result = parseInput(content, 'invalid-fractional.cif');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Fractional atom-site loop rejected: 1 invalid row');
    });

    it('should reject fractional coordinates without a complete valid unit cell', () => {
        const content = `data_missing_cell
_cell_length_a 10
_cell_length_b 10
_cell_length_c 10
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Fe1 Fe 0 0 0`;

        const result = parseInput(content, 'missing-cell.cif');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('require complete, valid unit-cell lengths and angles');
    });

    it('should convert a non-orthogonal unit cell', () => {
        const content = `data_triclinic
_cell_length_a 10
_cell_length_b 20
_cell_length_c 30
_cell_angle_alpha 80
_cell_angle_beta 70
_cell_angle_gamma 60
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Fe1 Fe 0.1 0.2 0.3`;

        const result = parseInput(content, 'triclinic.cif');

        expect(result.valid).toBe(true);
        const atom = result.structures[0].atoms[0];
        expect(atom.x).toBeCloseTo(6.0781812899, 8);
        expect(atom.y).toBeCloseTo(3.4915176169, 8);
        expect(atom.z).toBeCloseTo(8.4571891494, 8);
    });

    it('should reject a degenerate unit cell', () => {
        const content = `data_degenerate
_cell_length_a 10
_cell_length_b 10
_cell_length_c 10
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 0.000001
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Fe1 Fe 0.1 0.2 0.3`;

        const result = parseInput(content, 'degenerate.cif');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unit-cell angles define a degenerate cell');
    });

    it('should prefer valid Cartesian coordinates when both coordinate forms are present', () => {
        const content = `data_both
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Fe1 Fe ? 0 0
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_Cartn_x
_atom_site_Cartn_y
_atom_site_Cartn_z
Fe1 Fe 1.5 2.5 3.5`;

        const result = parseInput(content, 'both.cif');

        expect(result.valid).toBe(true);
        expect(result.structures[0].atoms[0]).toEqual({
            element: 'Fe', x: 1.5, y: 2.5, z: 3.5
        });
        expect(result.structures[0].metadata.parseProvenance).toBe('cif-cartesian');
    });

    it('should expose the no-symmetry boundary for Cartesian-coordinate CIF', () => {
        const content = `data_cartesian
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_Cartn_x
_atom_site_Cartn_y
_atom_site_Cartn_z
Fe1 Fe 0.0 0.0 0.0
N1 N 2.0 0.0 0.0`;

        const result = parseInput(content, 'cartesian.cif');
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
            'Basic Cartesian-coordinate CIF import: coordinates are used exactly as listed; crystallographic symmetry and periodic images are not expanded.'
        );
    });

    it('should reject an entire Cartesian CIF block containing an invalid atom row', () => {
        const content = `data_invalid
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_Cartn_x
_atom_site_Cartn_y
_atom_site_Cartn_z
Fe1 Fe 0.0 0.0 0.0
N1 N ? 2.0 0.0`;

        const result = parseInput(content, 'invalid.cif');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Cartesian atom-site loop rejected: 1 invalid row');
    });

    it('should reject Cartesian CIF numeric tokens with trailing text', () => {
        const content = `data_invalid_suffix
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_Cartn_x
_atom_site_Cartn_y
_atom_site_Cartn_z
Fe1 Fe 1.0abc 0.0 0.0`;

        const result = parseInput(content, 'invalid-suffix.cif');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Cartesian atom-site loop rejected: 1 invalid row');
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

    it('should reject markup-like element tokens before they enter the structure model', () => {
        const content = `2
Test
Fe 0 0 0
<svg/onload=alert(1)> 1 0 0`;

        const result = parseInput(content, 'test.xyz');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Frame 1 rejected: 1 of 2 atom lines were invalid');
    });

    it('should retain ordinary charged element tokens while removing the charge suffix', () => {
        const content = `2
Charged labels
Fe2+ 0 0 0
Cl- 1 0 0`;

        const result = parseInput(content, 'charged.xyz');
        expect(result.valid).toBe(true);
        expect(result.structures[0].atoms.map(atom => atom.element)).toEqual(['Fe', 'Cl']);
    });

    it('should reject malformed or repeated charge suffixes', () => {
        const content = `2
Malformed charge
Fe++--123 0 0 0
Cl- 1 0 0`;

        const result = parseInput(content, 'malformed-charge.xyz');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Frame 1 rejected: 1 of 2 atom lines were invalid');
    });

    it('should reject a frame containing only invalid element tokens', () => {
        const content = `1
Test
<img/src=x/onerror=alert(1)> 0 0 0`;

        const result = parseInput(content, 'test.xyz');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Frame 1 rejected: 1 of 1 atom lines were invalid');
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
