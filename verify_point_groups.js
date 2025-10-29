import { REFERENCE_GEOMETRIES, POINT_GROUPS } from './src/constants/referenceGeometries/index.js';

console.log("=== Point Group Verification ===\n");

// Count total geometries
let totalGeometries = 0;
let totalWithPointGroups = 0;
let missingPointGroups = [];

for (const [cn, geometries] of Object.entries(REFERENCE_GEOMETRIES)) {
    console.log(`\nCN=${cn}:`);
    const geomNames = Object.keys(geometries);
    totalGeometries += geomNames.length;

    for (const name of geomNames) {
        const pointGroup = POINT_GROUPS[name];
        if (pointGroup) {
            totalWithPointGroups++;
            console.log(`  ✓ ${name}: ${pointGroup}`);
        } else {
            missingPointGroups.push(`CN=${cn}: ${name}`);
            console.log(`  ✗ ${name}: MISSING POINT GROUP`);
        }
    }
}

console.log("\n=== Summary ===");
console.log(`Total geometries: ${totalGeometries}`);
console.log(`Geometries with point groups: ${totalWithPointGroups}`);
console.log(`Missing point groups: ${missingPointGroups.length}`);

if (missingPointGroups.length > 0) {
    console.log("\n❌ Missing point groups for:");
    missingPointGroups.forEach(g => console.log(`   - ${g}`));
} else {
    console.log("\n✅ All geometries have point groups!");
}

// Verify specific key geometries
console.log("\n=== Key Geometry Verification ===");
const keyTests = [
    { name: "OC-6 (Octahedral)", expected: "Oh" },
    { name: "T-4 (Tetrahedral)", expected: "Td" },
    { name: "IC-12 (Icosahedral)", expected: "Ih" },
    { name: "DD-20 (Dodecahedron)", expected: "Ih" },
    { name: "TIC-60 (Truncated Icosahedron)", expected: "Ih" },
    { name: "TCOC-48 (Truncated Cuboctahedron)", expected: "Oh" }
];

let allCorrect = true;
for (const test of keyTests) {
    const actual = POINT_GROUPS[test.name];
    const match = actual === test.expected;
    if (match) {
        console.log(`✓ ${test.name}: ${actual}`);
    } else {
        console.log(`✗ ${test.name}: Expected ${test.expected}, got ${actual}`);
        allCorrect = false;
    }
}

if (allCorrect) {
    console.log("\n✅ All key geometries have correct point groups!");
}
