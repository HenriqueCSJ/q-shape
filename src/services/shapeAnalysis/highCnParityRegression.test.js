/**
 * High-CN local-minimum regressions from the sealed direct SHAPE 2.1 census.
 *
 * These cross-geometry cases exposed narrow assignment/rotation basins in the
 * production optimizer. The expected values are the five-decimal tokens from
 * SHAPE 2.1 (executable SHA-256
 * 1592122408e7f5486fd9665e96e129dda9390b1b0ac76da4d348e3070c1bb4cb).
 */

import calculateShapeMeasure from './shapeCalculator';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';

const CASES = [
    {
        cn: 8,
        source: 'ETBPY-8 (Elongated Trigonal Bipyramid)',
        target: 'TT-8 (Triakis Tetrahedron)',
        shape: 23.73952
    },
    {
        cn: 10,
        source: 'JATDI-10 (Augmented Tridiminished Icosahedron, J64)',
        target: 'PAPR-10 (Pentagonal Antiprism - STAGGERED)',
        shape: 20.51469
    },
    {
        cn: 10,
        source: 'JATDI-10 (Augmented Tridiminished Icosahedron, J64)',
        target: 'JBCCU-10 (Bicapped Cube, J15)',
        shape: 16.57168
    },
    {
        cn: 10,
        source: 'JATDI-10 (Augmented Tridiminished Icosahedron, J64)',
        target: 'JMBIC-10 (Metabidiminished Icosahedron, J62)',
        shape: 13.88027
    },
    {
        cn: 10,
        source: 'TD-10 (Tetradecahedron 2:6:2)',
        target: 'JATDI-10 (Augmented Tridiminished Icosahedron, J64)',
        shape: 16.92040
    }
];

function fixed15CenterRelativeLigands(reference) {
    const center = reference[reference.length - 1];
    return reference.slice(0, -1).map(point => point.map((value, axis) =>
        Number((value - center[axis]).toFixed(15))
    ));
}

describe('high-CN direct-parity local-minimum regressions', () => {
    test.each(CASES)('$source against $target remains within 0.01 CShM', item => {
        const geometries = REFERENCE_GEOMETRIES[item.cn];
        const actual = fixed15CenterRelativeLigands(geometries[item.source]);
        const result = calculateShapeMeasure(actual, geometries[item.target], 'default');
        expect(Math.abs(result.measure - item.shape)).toBeLessThan(0.01);
    });

    test('the repaired ETBPY-8/TT-8 basin remains bitwise deterministic', () => {
        const geometries = REFERENCE_GEOMETRIES[8];
        const actual = fixed15CenterRelativeLigands(
            geometries['ETBPY-8 (Elongated Trigonal Bipyramid)']
        );
        const target = geometries['TT-8 (Triakis Tetrahedron)'];
        expect(calculateShapeMeasure(actual, target, 'default').measure).toBe(
            calculateShapeMeasure(actual, target, 'default').measure
        );
    });
});
