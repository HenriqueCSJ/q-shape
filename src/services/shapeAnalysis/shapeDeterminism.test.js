import * as THREE from 'three';
import calculateShapeMeasure from './shapeCalculator';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';
import { loadCenteredLigands } from './testUtils/loadShapeFixture';

const MFF_NAME = 'MFF-9 (Muffin)';
const CSAPR_NAME = 'CSAPR-9 (Capped Square Antiprism)';
const JAPPR_NAME = 'JAPPR-11 (Augmented Pentagonal Prism, J52)';
const JEPBPY_NAME = 'JEPBPY-12 (Elongated Pentagonal Bipyramid, J16)';

function permute(values, order) {
    return order.map(index => values[index]);
}

function deterministicShuffle(length, seed) {
    const order = Array.from({ length }, (_, index) => index);
    let state = seed >>> 0;
    for (let i = length - 1; i > 0; i--) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const j = state % (i + 1);
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

function rotateAndScale(coords, axis, angle, scale = 1) {
    const rotation = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(...axis).normalize(),
        angle
    );
    return coords.map(coord =>
        new THREE.Vector3(...coord).applyMatrix4(rotation).multiplyScalar(scale).toArray()
    );
}

describe('Deterministic high-CN CShM search', () => {
    const cn9 = loadCenteredLigands('CN9-CrL9.xyz');
    const mff = REFERENCE_GEOMETRIES[9][MFF_NAME];
    const csapr = REFERENCE_GEOMETRIES[9][CSAPR_NAME];

    test('repeated default calculations are bitwise repeatable', () => {
        const values = Array.from({ length: 20 }, () =>
            calculateShapeMeasure(cn9, mff, 'default').measure
        );

        expect(new Set(values).size).toBe(1);
        expect(values[0]).toBeLessThan(1e-4);
    });

    test('pair-frame MFF-9 result is independent of optimization seed', () => {
        const csaprMeasure = calculateShapeMeasure(cn9, csapr, 'default').measure;
        for (let seed = 0; seed < 32; seed++) {
            const mffMeasure = calculateShapeMeasure(
                cn9,
                mff,
                'default',
                null,
                { seed }
            ).measure;
            expect(mffMeasure).toBeLessThan(1e-4);
            expect(mffMeasure).toBeLessThan(csaprMeasure);
        }
    });

    test('MFF-9 is invariant to rotation, isotropic scale, and ligand permutation', () => {
        const baseline = calculateShapeMeasure(cn9, mff, 'default').measure;
        const cases = [
            { axis: [1, 0, 0], angle: Math.PI / 2, scale: 0.5, seed: 11 },
            { axis: [0, 1, 0], angle: Math.PI, scale: 3.7, seed: 23 },
            { axis: [1, 2, 3], angle: 0.731, scale: 1.0, seed: 37 },
            { axis: [3, -2, 5], angle: 2.193, scale: 2.2, seed: 51 },
            { axis: [-2, 7, 1], angle: 4.019, scale: 0.8, seed: 79 },
            { axis: [4, 1, -3], angle: 1.417, scale: 5e-5, seed: 97 }
        ];

        for (const item of cases) {
            const transformed = rotateAndScale(cn9, item.axis, item.angle, item.scale);
            const shuffled = permute(
                transformed,
                deterministicShuffle(transformed.length, item.seed)
            );
            const mffMeasure = calculateShapeMeasure(shuffled, mff, 'default').measure;
            const csaprMeasure = calculateShapeMeasure(shuffled, csapr, 'default').measure;

            expect(mffMeasure).toBeLessThan(1e-4);
            expect(Math.abs(mffMeasure - baseline)).toBeLessThan(1e-6);
            expect(mffMeasure).toBeLessThan(csaprMeasure);
        }
    });

    test('CN=12 local-search result is repeatable for the full-precision fixture', () => {
        const cn12 = loadCenteredLigands('CN12-NbL12.xyz');
        const reference = REFERENCE_GEOMETRIES[12][JEPBPY_NAME];
        const values = Array.from({ length: 10 }, () =>
            calculateShapeMeasure(cn12, reference, 'default').measure
        );

        expect(new Set(values).size).toBe(1);
        expect(Math.abs(values[0] - 23.49135)).toBeLessThan(0.01);
    });

    test('CN=11 distorted fixture reaches the SHAPE basin repeatably', () => {
        const cn11 = loadCenteredLigands('CN11-NbL11.xyz');
        const reference = REFERENCE_GEOMETRIES[11][JAPPR_NAME];
        const values = Array.from({ length: 5 }, () =>
            calculateShapeMeasure(cn11, reference, 'default').measure
        );

        expect(new Set(values).size).toBe(1);
        expect(Math.abs(values[0] - 21.67256)).toBeLessThan(0.01);

        for (let seed = 1; seed <= 20; seed++) {
            const transformed = rotateAndScale(
                cn11,
                [seed + 1, 2 * seed + 1, 3],
                seed * 0.239,
                0.5 + (seed % 5) * 0.4
            );
            const shuffled = permute(
                transformed,
                deterministicShuffle(cn11.length, seed)
            );
            const shuffledMeasure = calculateShapeMeasure(
                shuffled,
                reference,
                'default'
            ).measure;
            expect(Math.abs(shuffledMeasure - values[0])).toBeLessThan(1e-6);
            expect(Math.abs(shuffledMeasure - 21.67256)).toBeLessThan(0.01);
        }
    });

    test('distorted high-CN search exercises an injected random sequence', () => {
        const cn11 = loadCenteredLigands('CN11-NbL11.xyz');
        const reference = REFERENCE_GEOMETRIES[11][JAPPR_NAME];
        let state = 123456789;
        const rng = jest.fn(() => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 4294967296;
        });

        const result = calculateShapeMeasure(
            cn11,
            reference,
            'default',
            null,
            { rng }
        );

        expect(rng).toHaveBeenCalled();
        expect(Number.isFinite(result.measure)).toBe(true);
        expect(Math.abs(result.measure - 21.67256)).toBeLessThan(0.01);
    });

    test('explicit seeds are repeatable on a distorted high-CN case', () => {
        const cn11 = loadCenteredLigands('CN11-NbL11.xyz');
        const reference = REFERENCE_GEOMETRIES[11][JAPPR_NAME];
        const measureForSeed = seed => calculateShapeMeasure(
            cn11,
            reference,
            'default',
            null,
            { seed }
        ).measure;

        const first = measureForSeed(42);
        const repeated = measureForSeed(42);
        const alternate = measureForSeed(314159);

        expect(repeated).toBe(first);
        expect(Math.abs(first - 21.67256)).toBeLessThan(0.01);
        expect(Math.abs(alternate - 21.67256)).toBeLessThan(0.01);
    });

    test('center/ligand swap trap keeps the central atom fixed', () => {
        const actual = [
            [-1.9183892570436, -1.9338086070492864, 0.17262317799031734],
            [0.5396162243559957, 1.6401180550456047, -1.5501533234491944]
        ];
        const reference = [
            [-0.016442378982901573, 0.1933953771367669, 0.38440046831965446],
            [1.1338016642257571, -1.8405827302485704, 0.9752048896625638],
            [1.8632374703884125, -1.705329836346209, 0.7984277177602053]
        ];
        const result = calculateShapeMeasure(actual, reference, 'default');
        const points = [...actual, [0, 0, 0]];
        const centroid = [0, 1, 2].map(axis =>
            points.reduce((sum, point) => sum + point[axis], 0) / points.length
        );
        const centered = points.map(point =>
            point.map((value, axis) => value - centroid[axis])
        );
        const rms = Math.sqrt(
            centered.reduce(
                (sum, point) => sum + point.reduce((sq, value) => sq + value * value, 0),
                0
            ) / points.length
        );
        const normalizedCenter = new THREE.Vector3(
            ...centered[centered.length - 1].map(value => value / rms)
        ).applyMatrix4(result.rotationMatrix);
        const alignedCenter = new THREE.Vector3(
            ...result.alignedCoords[result.alignedCoords.length - 1]
        );

        expect(alignedCenter.distanceTo(normalizedCenter)).toBeLessThan(1e-10);
    });

    test('early high-CN completion reports monotonic progress ending at 100%', () => {
        const updates = [];
        calculateShapeMeasure(cn9, mff, 'default', update => updates.push(update));

        expect(updates.length).toBeGreaterThan(0);
        expect(updates[updates.length - 1]).toMatchObject({
            stage: 'Complete',
            percentage: 100
        });
        for (let index = 1; index < updates.length; index++) {
            expect(updates[index].percentage).toBeGreaterThanOrEqual(
                updates[index - 1].percentage
            );
        }
    });

    test('every CN=8-12 reference survives adversarial rigid rotations and permutations', () => {
        const transforms = [
            { axis: [1, 2, 3], angle: 0.417, scale: 0.7, seed: 101 },
            { axis: [-3, 1, 4], angle: 1.913, scale: 2.5, seed: 211 },
            { axis: [5, -2, 1], angle: 4.207, scale: 1.3, seed: 307 }
        ];

        for (let cn = 8; cn <= 12; cn++) {
            for (const reference of Object.values(REFERENCE_GEOMETRIES[cn])) {
                const center = reference[reference.length - 1];
                const centeredLigands = reference.slice(0, -1).map(point =>
                    point.map((value, axis) => value - center[axis])
                );

                for (const item of transforms) {
                    const transformed = rotateAndScale(
                        centeredLigands,
                        item.axis,
                        item.angle,
                        item.scale
                    );
                    const shuffled = permute(
                        transformed,
                        deterministicShuffle(transformed.length, item.seed + cn)
                    );
                    const measure = calculateShapeMeasure(
                        shuffled,
                        reference,
                        'default'
                    ).measure;

                    expect(measure).toBeLessThan(1e-8);
                }
            }
        }
    });
});
