import { REFERENCE_GEOMETRIES } from './src/constants/referenceGeometries/index.js';

// ML60 Reference Geometries from CoSyMlib
const ML60_COSYMLIB = {
    "TIC-60 (Truncated Icosahedron)": [
        [0.799214169418, 0.329186766636, -0.519191166048],
        [0.560045966052, 0.658373533272, -0.519191166048],
        [-0.066104440661, 0.861822142285, -0.519191166048],
        [-0.453086725387, 0.736083984662, -0.519191166048],
        [-0.840068969422, 0.203448609013, -0.519191166048],
        [-0.840068969422, -0.203448609013, -0.519191166048],
        [-0.453086725387, -0.736083984662, -0.519191166048],
        [-0.066104440661, -0.861822142285, -0.519191166048],
        [0.560045966052, -0.658373533272, -0.519191166048],
        [0.799214169418, -0.329186766636, -0.519191166048],
        [0.453086725387, 0.736083984662, 0.519191166048],
        [0.066104440661, 0.861822142285, 0.519191166048],
        [-0.560045966052, 0.658373533272, 0.519191166048],
        [-0.799214169418, 0.329186766636, 0.519191166048],
        [-0.799214169418, -0.329186766636, 0.519191166048],
        [-0.560045966052, -0.658373533272, 0.519191166048],
        [0.066104440661, -0.861822142285, 0.519191166048],
        [0.453086725387, -0.736083984662, 0.519191166048],
        [0.840068969422, -0.203448609013, 0.519191166048],
        [0.840068969422, 0.203448609013, 0.519191166048],
        [0.972277891434, 0.203448609013, -0.173063722016],
        [0.906173410083, 0.406897218026, 0.173063722016],
        [0.667005247406, 0.736083984662, 0.173063722016],
        [0.493941525391, 0.861822142285, -0.173063722016],
        [0.106959281355, 0.987560299908, -0.173063722016],
        [-0.106959281355, 0.987560299908, 0.173063722016],
        [-0.493941525391, 0.861822142285, 0.173063722016],
        [-0.667005247406, 0.736083984662, -0.173063722016],
        [-0.906173410083, 0.406897218026, -0.173063722016],
        [-0.972277891434, 0.203448609013, 0.173063722016],
        [-0.972277891434, -0.203448609013, 0.173063722016],
        [-0.906173410083, -0.406897218026, -0.173063722016],
        [-0.667005247406, -0.736083984662, -0.173063722016],
        [-0.493941525391, -0.861822142285, 0.173063722016],
        [-0.106959281355, -0.987560299908, 0.173063722016],
        [0.106959281355, -0.987560299908, -0.173063722016],
        [0.493941525391, -0.861822142285, -0.173063722016],
        [0.667005247406, -0.736083984662, 0.173063722016],
        [0.906173410083, -0.406897218026, 0.173063722016],
        [0.972277891434, -0.203448609013, -0.173063722016],
        [0.692254888064, 0.000000000000, -0.733109688067],
        [0.346127444032, 0.000000000000, -0.947028210087],
        [0.213918522020, 0.658373533272, -0.733109688067],
        [0.106959281355, 0.329186766636, -0.947028210087],
        [-0.560045966052, 0.406897218026, -0.733109688067],
        [-0.280023003371, 0.203448609013, -0.947028210087],
        [-0.560045966052, -0.406897218026, -0.733109688067],
        [-0.280023003371, -0.203448609013, -0.947028210087],
        [0.213918522020, -0.658373533272, -0.733109688067],
        [0.106959281355, -0.329186766636, -0.947028210087],
        [0.560045966052, 0.406897218026, 0.733109688067],
        [0.280023003371, 0.203448609013, 0.947028210087],
        [-0.213918522020, 0.658373533272, 0.733109688067],
        [-0.106959281355, 0.329186766636, 0.947028210087],
        [-0.692254888064, 0.000000000000, 0.733109688067],
        [-0.346127444032, 0.000000000000, 0.947028210087],
        [-0.213918522020, -0.658373533272, 0.733109688067],
        [-0.106959281355, -0.329186766636, 0.947028210087],
        [0.560045966052, -0.406897218026, 0.733109688067],
        [0.280023003371, -0.203448609013, 0.947028210087]
    ]
};

// Normalize a coordinate to unit length
function normalize(coord) {
    const [x, y, z] = coord;
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length === 0) return [0, 0, 0];
    return [x / length, y / length, z / length];
}

// Normalize all coordinates
for (const [name, coords] of Object.entries(ML60_COSYMLIB)) {
    ML60_COSYMLIB[name] = coords.map(normalize);
}

// Calculate RMSD between two sets of coordinates
function calculateRMSD(coords1, coords2) {
    if (coords1.length !== coords2.length) {
        throw new Error(`Coordinate count mismatch: ${coords1.length} vs ${coords2.length}`);
    }

    let sumSquaredDiff = 0;
    for (let i = 0; i < coords1.length; i++) {
        const [x1, y1, z1] = coords1[i];
        const [x2, y2, z2] = coords2[i];
        sumSquaredDiff += (x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2;
    }

    return Math.sqrt(sumSquaredDiff / coords1.length);
}

// Compare our geometries with CoSyMlib references
console.log("=== ML60 Geometry Comparison: Ours vs CoSyMlib ===\n");

const results = [];
for (const [name, cosymlibCoords] of Object.entries(ML60_COSYMLIB)) {
    const ourCoords = REFERENCE_GEOMETRIES[60][name];

    if (!ourCoords) {
        console.log(`❌ ${name}: NOT FOUND in our library`);
        results.push({ name, status: 'missing' });
        continue;
    }

    const rmsd = calculateRMSD(ourCoords, cosymlibCoords);
    const status = rmsd < 0.01 ? '✓ PERFECT' :
                   rmsd < 0.1 ? '✓ GOOD' :
                   rmsd < 0.5 ? '⚠️  REVIEW' :
                   '❌ BAD';

    results.push({ name, rmsd, status });
}

// Print formatted results
console.log("Geometry                                      RMSD       Status");
console.log("---------------------------------------- --------- ----------");
for (const result of results) {
    if (result.status === 'missing') continue;
    const nameCol = result.name.padEnd(40);
    const rmsdCol = result.rmsd.toFixed(6).padStart(9);
    console.log(`${nameCol} ${rmsdCol}    ${result.status}`);
}

console.log("\n=== Summary ===\n");
const perfect = results.filter(r => r.rmsd !== undefined && r.rmsd < 0.01).length;
const good = results.filter(r => r.rmsd !== undefined && r.rmsd >= 0.01 && r.rmsd < 0.1).length;
const review = results.filter(r => r.rmsd !== undefined && r.rmsd >= 0.1 && r.rmsd < 0.5).length;
const bad = results.filter(r => r.rmsd !== undefined && r.rmsd >= 0.5).length;
const total = results.length;

console.log(`✓ Perfect matches (RMSD < 0.01): ${perfect}/${total}`);
console.log(`✓ Good matches (RMSD < 0.1): ${good}/${total}`);
console.log(`⚠️  Need review (RMSD 0.1-0.5): ${review}/${total}`);
console.log(`❌ Bad matches (RMSD > 0.5): ${bad}/${total}`);
