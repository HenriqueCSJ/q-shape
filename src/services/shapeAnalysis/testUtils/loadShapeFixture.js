import fs from 'fs';
import path from 'path';

export function loadCenteredLigands(filename) {
    const fixturePath = path.resolve(
        process.cwd(),
        'tests',
        'fixtures',
        'shape-parity',
        filename
    );
    const lines = fs.readFileSync(fixturePath, 'utf8')
        .trim()
        .split(/\r?\n/)
        .slice(2)
        .map(line => line.trim().split(/\s+/));

    const center = lines[0].slice(1).map(Number);
    return lines.slice(1).map(fields =>
        fields.slice(1).map(Number).map((value, axis) => value - center[axis])
    );
}
