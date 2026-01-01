import { REFERENCE_GEOMETRIES } from '../src/constants/referenceGeometries/index.js';

for (const cn of [3,4,5,6,7,8,9,10,11,12]) {
  const geoms = REFERENCE_GEOMETRIES[cn];
  if (!geoms) continue;
  const entries = Object.entries(geoms);
  const pointCounts = entries.map(([name, coords]) => coords.length);
  const unique = [...new Set(pointCounts)];
  const expected = cn + 1;
  const status = unique.length === 1 && unique[0] === expected ? "✓" : "✗";
  console.log(`CN=${cn}: ${unique.join(",")} points (expect ${expected}) ${status}`);

  // Show details if not all matching
  if (unique.length > 1 || unique[0] !== expected) {
    for (const [name, coords] of entries) {
      if (coords.length !== expected) {
        console.log(`  - ${name}: ${coords.length} points`);
      }
    }
  }
}
