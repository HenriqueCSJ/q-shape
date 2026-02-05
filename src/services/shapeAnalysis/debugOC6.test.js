/**
 * Debug test for OC-6 CShM discrepancy
 */

import calculateShapeMeasure from './shapeCalculator';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';

describe('OC-6 Debug Analysis', () => {
    // User's Ni complex coordinates (centered on metal)
    const metalCoords = [6.016150, 1.141803, 11.745750];
    const ligandCoordsRaw = [
        [6.016150, 1.203879, 9.489940],
        [7.433796, 2.672975, 11.745750],
        [7.475548, -0.333146, 11.745750],
        [6.016150, 1.203879, 14.001560],
        [4.598504, 2.672975, 11.745750],
        [4.556752, -0.333146, 11.745750]
    ];

    // Center on metal
    const ligandCoords = ligandCoordsRaw.map(l => [
        l[0] - metalCoords[0],
        l[1] - metalCoords[1],
        l[2] - metalCoords[2]
    ]);

    const SHAPE_REF = {
        'HP-6 (Hexagon)': 32.43652,
        'PPY-6 (Pentagonal Pyramid)': 29.59348,
        'OC-6 (Octahedral)': 0.19694,
        'TPR-6 (Trigonal Prism)': 16.60998,
        'JPPY-6 (Johnson Pentagonal Pyramid, J2)': 32.84784
    };

    test('Full CN=6 comparison for user Ni complex', () => {
        console.log("\n=== User's Ni Complex: Q-Shape vs SHAPE ===\n");
        console.log("Geometry                                    Q-Shape     SHAPE      Diff     RelErr");
        console.log("─".repeat(85));

        const cn6Geometries = REFERENCE_GEOMETRIES[6];
        const results = [];

        for (const [name, refCoords] of Object.entries(cn6Geometries)) {
            const { measure } = calculateShapeMeasure(ligandCoords, refCoords, 'intensive');
            const shapeValue = SHAPE_REF[name];
            const diff = measure - shapeValue;
            const relErr = Math.abs(diff) / shapeValue * 100;
            results.push({ name, measure, shapeValue, diff, relErr });
        }

        // Sort by Q-Shape measure
        results.sort((a, b) => a.measure - b.measure);

        for (const r of results) {
            console.log(
                `${r.name.padEnd(44)} ${r.measure.toFixed(5).padStart(10)} ${r.shapeValue.toFixed(5).padStart(10)} ${r.diff.toFixed(5).padStart(10)} ${r.relErr.toFixed(2).padStart(8)}%`
            );
        }
        console.log("─".repeat(85));

        expect(true).toBe(true);
    });

    test('OC-6 detailed formula analysis', () => {
        console.log("\n=== OC-6 Formula Analysis ===\n");

        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];
        const { measure, alignedCoords } = calculateShapeMeasure(
            ligandCoords, ocRef, 'intensive'
        );

        console.log("Q-Shape OC-6 CShM:", measure.toFixed(5));
        console.log("SHAPE OC-6 CShM:  ", SHAPE_REF['OC-6 (Octahedral)'].toFixed(5));
        console.log("Difference:       ", (measure - SHAPE_REF['OC-6 (Octahedral)']).toFixed(5));
        console.log("Relative error:   ", ((measure - SHAPE_REF['OC-6 (Octahedral)']) / SHAPE_REF['OC-6 (Octahedral)'] * 100).toFixed(2), "%");

        // Centroid-based normalization function
        function scaleNormalize(coords) {
            const n = coords.length;
            const centroid = [0, 0, 0];
            for (const c of coords) {
                centroid[0] += c[0] / n;
                centroid[1] += c[1] / n;
                centroid[2] += c[2] / n;
            }
            const centered = coords.map(c => [
                c[0] - centroid[0],
                c[1] - centroid[1],
                c[2] - centroid[2]
            ]);
            let sumSq = 0;
            for (const c of centered) {
                sumSq += c[0]*c[0] + c[1]*c[1] + c[2]*c[2];
            }
            const rms = Math.sqrt(sumSq / n);
            const normalized = centered.map(c => [c[0]/rms, c[1]/rms, c[2]/rms]);
            return { normalized, centroid, rms };
        }

        const { normalized: Q_norm } = scaleNormalize(ocRef);
        const N = 7;

        // Compute using aligned coords
        let overlap = 0;
        let sumSqDiff = 0;

        for (let i = 0; i < N; i++) {
            const p = alignedCoords[i];
            const q = Q_norm[i];

            overlap += p[0]*q[0] + p[1]*q[1] + p[2]*q[2];

            const dx = p[0] - q[0];
            const dy = p[1] - q[1];
            const dz = p[2] - q[2];
            sumSqDiff += dx*dx + dy*dy + dz*dz;
        }

        const overlapNorm = overlap / N;

        console.log("\nWith optimal alignment:");
        console.log("  Total overlap:", overlap.toFixed(6));
        console.log("  Overlap/N:", overlapNorm.toFixed(6));
        console.log("  Sum |p-q|²:", sumSqDiff.toFixed(6));

        // Formula calculations
        const cshm_rmsd = 100 * sumSqDiff / N;
        const cshm_overlap = 100 * (1 - overlapNorm * overlapNorm);

        console.log("\nFormula comparison:");
        console.log("  RMSD-based (100*Σ|p-q|²/N):        CShM =", cshm_rmsd.toFixed(5));
        console.log("  Overlap-based (100*(1-(o/N)²)):    CShM =", cshm_overlap.toFixed(5));
        console.log("  SHAPE reference value:             CShM =", SHAPE_REF['OC-6 (Octahedral)'].toFixed(5));

        console.log("\n=== Key Finding ===");
        console.log("RMSD formula matches SHAPE better:", Math.abs(cshm_rmsd - SHAPE_REF['OC-6 (Octahedral)']) < Math.abs(cshm_overlap - SHAPE_REF['OC-6 (Octahedral)']));
        console.log("RMSD error:", Math.abs(cshm_rmsd - SHAPE_REF['OC-6 (Octahedral)']).toFixed(5));
        console.log("Overlap error:", Math.abs(cshm_overlap - SHAPE_REF['OC-6 (Octahedral)']).toFixed(5));

        expect(true).toBe(true);
    });

    test('Verify normalization', () => {
        console.log("\n=== Normalization Verification ===\n");

        function scaleNormalize(coords) {
            const n = coords.length;
            const centroid = [0, 0, 0];
            for (const c of coords) {
                centroid[0] += c[0] / n;
                centroid[1] += c[1] / n;
                centroid[2] += c[2] / n;
            }
            const centered = coords.map(c => [
                c[0] - centroid[0],
                c[1] - centroid[1],
                c[2] - centroid[2]
            ]);
            let sumSq = 0;
            for (const c of centered) {
                sumSq += c[0]*c[0] + c[1]*c[1] + c[2]*c[2];
            }
            const rms = Math.sqrt(sumSq / n);
            const normalized = centered.map(c => [c[0]/rms, c[1]/rms, c[2]/rms]);
            return { normalized, centroid, rms };
        }

        // Add central atom
        const actualWithCentral = [...ligandCoords, [0, 0, 0]];
        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];

        const actualNorm = scaleNormalize(actualWithCentral);
        const refNorm = scaleNormalize(ocRef);

        console.log("Actual structure:");
        console.log("  Centroid:", actualNorm.centroid.map(x => x.toFixed(6)));
        console.log("  RMS:", actualNorm.rms.toFixed(6));
        console.log("  Central atom after norm:", actualNorm.normalized[6].map(x => x.toFixed(6)));

        console.log("\nReference OC-6:");
        console.log("  Centroid:", refNorm.centroid.map(x => x.toFixed(6)));
        console.log("  RMS:", refNorm.rms.toFixed(6));
        console.log("  Central atom after norm:", refNorm.normalized[6].map(x => x.toFixed(6)));

        // The key difference: actual has y-centroid != 0
        console.log("\n=== Key observation ===");
        console.log("The actual structure has centroid y =", actualNorm.centroid[1].toFixed(6));
        console.log("This shifts the central atom to y =", actualNorm.normalized[6][1].toFixed(6));
        console.log("This is a real structural asymmetry that contributes to CShM.");

        expect(true).toBe(true);
    });
});
