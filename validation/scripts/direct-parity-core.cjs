'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_REFERENCE_COUNTS = Object.freeze({
    2: 3,
    3: 4,
    4: 4,
    5: 5,
    6: 5,
    7: 7,
    8: 13,
    9: 13,
    10: 13,
    11: 7,
    12: 13
});

function sha256Buffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
    return sha256Buffer(fs.readFileSync(filePath));
}

function codeFromReferenceName(name) {
    const match = String(name).match(/^([^\s]+-\d+)\s/);
    if (!match) {
        throw new Error(`Cannot extract SHAPE code from reference name: ${name}`);
    }
    return match[1];
}

function installSourceBabelHook(repoRoot) {
    const sourceRoot = `${path.resolve(repoRoot, 'src')}${path.sep}`;
    const previousLoader = require.extensions['.js'];
    const babel = require('@babel/core');
    process.env.BABEL_ENV = process.env.BABEL_ENV || 'test';

    require.extensions['.js'] = function loadSourceModule(module, filename) {
        if (!path.resolve(filename).startsWith(sourceRoot)) {
            return previousLoader(module, filename);
        }
        const source = fs.readFileSync(filename, 'utf8');
        const transformed = babel.transformSync(source, {
            filename,
            presets: [require.resolve('babel-preset-react-app')],
            babelrc: false,
            configFile: false,
            sourceMaps: false
        });
        module._compile(transformed.code, filename);
    };
}

function loadQShape(repoRoot) {
    installSourceBabelHook(repoRoot);
    const referenceModule = require(path.resolve(
        repoRoot,
        'src/constants/referenceGeometries'
    ));
    const calculatorModule = require(path.resolve(
        repoRoot,
        'src/services/shapeAnalysis/shapeCalculator'
    ));
    return {
        referenceGeometries: referenceModule.REFERENCE_GEOMETRIES,
        calculateShapeMeasure: calculatorModule.default
    };
}

function buildReferenceInventory(referenceGeometries) {
    const inventory = [];
    const seenCodes = new Set();

    for (const [cnToken, expectedCount] of Object.entries(EXPECTED_REFERENCE_COUNTS)) {
        const cn = Number(cnToken);
        const geometries = referenceGeometries[cn];
        if (!geometries) {
            throw new Error(`Missing reference geometry collection for CN=${cn}`);
        }
        const entries = Object.entries(geometries);
        if (entries.length !== expectedCount) {
            throw new Error(
                `CN=${cn} has ${entries.length} references; expected ${expectedCount}`
            );
        }

        const targets = entries.map(([name, coordinates], index) => {
            const code = codeFromReferenceName(name);
            if (seenCodes.has(code)) {
                throw new Error(`Duplicate reference code: ${code}`);
            }
            seenCodes.add(code);
            if (!Array.isArray(coordinates) || coordinates.length !== cn + 1) {
                throw new Error(
                    `${name} has ${coordinates?.length ?? 'no'} points; expected ${cn + 1}`
                );
            }
            for (const point of coordinates) {
                if (
                    !Array.isArray(point) ||
                    point.length !== 3 ||
                    point.some(value => !Number.isFinite(value))
                ) {
                    throw new Error(`Invalid coordinate in ${name}`);
                }
            }
            return {
                index: index + 1,
                cn,
                code,
                name,
                coordinates
            };
        });
        inventory.push({ cn, count: targets.length, targets });
    }

    const total = inventory.reduce((sum, item) => sum + item.count, 0);
    if (total !== 87) {
        throw new Error(`Reference inventory contains ${total} geometries; expected 87`);
    }
    return inventory;
}

function formatCoordinate(value) {
    if (!Number.isFinite(value)) {
        throw new Error(`Cannot format non-finite coordinate: ${value}`);
    }
    const normalized = Object.is(value, -0) ? 0 : value;
    return normalized.toFixed(15);
}

function centerRelativeLigands(coordinates) {
    const center = coordinates[coordinates.length - 1];
    return coordinates.slice(0, -1).map(point => point.map(
        (value, axis) => value - center[axis]
    ));
}

function buildIdealCases(inventory) {
    const cases = [];
    for (const item of inventory) {
        item.targets.forEach((target, offset) => {
            const center = target.coordinates[target.coordinates.length - 1];
            const ligands = centerRelativeLigands(target.coordinates);
            const atoms = [
                { element: 'Fe', tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000'] },
                ...ligands.map(point => ({
                    element: 'C',
                    tokens: point.map(formatCoordinate)
                }))
            ];
            cases.push({
                caseId: `ideal-cn${String(item.cn).padStart(2, '0')}-${String(offset + 1).padStart(2, '0')}`,
                structureId: `I${String(item.cn).padStart(2, '0')}${String(offset + 1).padStart(2, '0')}`,
                stratum: 'ideal_reference',
                cn: item.cn,
                sourceName: target.name,
                expectedOwnTargetCode: target.code,
                sourceFile: 'src/constants/referenceGeometries/index.js',
                centerOriginal: center,
                actualLigands: ligands,
                shapeAtoms: atoms
            });
        });
    }
    return cases;
}

function parseXyzFile(filePath) {
    const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/);
    const declaredCount = Number.parseInt(lines[0]?.trim(), 10);
    if (!Number.isInteger(declaredCount) || declaredCount < 2) {
        throw new Error(`Invalid XYZ atom count in ${filePath}`);
    }
    const comment = lines[1] ?? '';
    const atomLines = lines.slice(2).filter(line => line.trim().length > 0);
    if (atomLines.length !== declaredCount) {
        throw new Error(
            `${filePath} declares ${declaredCount} atoms but contains ${atomLines.length}`
        );
    }
    const atoms = atomLines.map((line, index) => {
        const fields = line.trim().split(/\s+/);
        if (fields.length < 4) {
            throw new Error(`Invalid XYZ atom line ${index + 3} in ${filePath}`);
        }
        const tokens = fields.slice(1, 4);
        const coordinates = tokens.map(Number);
        if (coordinates.some(value => !Number.isFinite(value))) {
            throw new Error(`Non-finite XYZ coordinate at line ${index + 3} in ${filePath}`);
        }
        return { element: fields[0], tokens, coordinates };
    });
    return { declaredCount, comment, atoms, sourceText: text };
}

function buildFixtureCases(repoRoot, inventory) {
    const fixtureRoot = path.resolve(repoRoot, 'tests/fixtures/shape-parity');
    const cases = [];
    for (const item of inventory) {
        const prefix = `CN${item.cn}-`;
        const candidates = fs.readdirSync(fixtureRoot).filter(
            name => name.startsWith(prefix) && name.endsWith('.xyz')
        );
        if (candidates.length !== 1) {
            throw new Error(
                `Expected one ${prefix}*.xyz fixture; found ${candidates.length}`
            );
        }
        const fileName = candidates[0];
        const filePath = path.join(fixtureRoot, fileName);
        const parsed = parseXyzFile(filePath);
        if (parsed.declaredCount !== item.cn + 1) {
            throw new Error(
                `${fileName} contains ${parsed.declaredCount} atoms; expected ${item.cn + 1}`
            );
        }
        const center = parsed.atoms[0].coordinates;
        const actualLigands = parsed.atoms.slice(1).map(atom => atom.coordinates.map(
            (value, axis) => value - center[axis]
        ));
        cases.push({
            caseId: `fixture-cn${String(item.cn).padStart(2, '0')}`,
            structureId: `F${String(item.cn).padStart(2, '0')}`,
            stratum: 'retained_fixture',
            cn: item.cn,
            sourceName: fileName,
            expectedOwnTargetCode: null,
            sourceFile: path.relative(repoRoot, filePath).replace(/\\/g, '/'),
            sourceSha256: sha256File(filePath),
            sourceComment: parsed.comment,
            centerOriginal: center,
            actualLigands,
            shapeAtoms: parsed.atoms.map(atom => ({
                element: atom.element,
                tokens: atom.tokens
            }))
        });
    }
    return cases;
}

function buildShapeDat(cn, cases, targets) {
    if (cases.some(item => item.cn !== cn)) {
        throw new Error(`Mixed coordination numbers in CN=${cn} SHAPE input`);
    }
    const lines = [
        `$ Q-Shape direct parity validation, CN=${cn}`,
        '%fullout',
        `${cn} 1`,
        targets.map(target => target.index).join(' ')
    ];
    for (const item of cases) {
        lines.push(item.structureId);
        for (const atom of item.shapeAtoms) {
            lines.push(
                `${atom.element.padEnd(3, ' ')} ${atom.tokens[0]} ${atom.tokens[1]} ${atom.tokens[2]}`
            );
        }
    }
    lines.push('');
    return lines.join('\n');
}

function parseShapeOut(text) {
    const structures = [];
    let current = null;
    for (const line of text.split(/\r?\n/)) {
        const structureMatch = line.match(/^Structure\s+\d+\s+\[([^\]]+)\]/);
        if (structureMatch) {
            current = { structureId: structureMatch[1].trim(), values: [] };
            structures.push(current);
            continue;
        }
        if (!current) continue;
        const valueMatch = line.match(
            /^\s*([^\s]+-\d+)\s+Ideal structure\s+CShM\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)\s*$/
        );
        if (valueMatch) {
            current.values.push({
                targetCode: valueMatch[1],
                valueToken: valueMatch[2]
            });
        }
    }
    return structures;
}

function parseShapeReferenceListing(text, expectedCn = null) {
    const header = text.match(/^\*\s+(\d+)\s+Vertices\s*$/m);
    if (!header) {
        throw new Error('SHAPE reference listing did not contain a vertex-count header');
    }
    const cn = Number(header[1]);
    if (expectedCn !== null && cn !== expectedCn) {
        throw new Error(`SHAPE listed CN=${cn}; expected CN=${expectedCn}`);
    }
    const references = [];
    for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s+([^\s]+-\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/);
        if (!match) continue;
        references.push({
            shapeCode: match[1],
            index: Number(match[2]),
            pointGroup: match[3],
            description: match[4]
        });
    }
    references.sort((a, b) => a.index - b.index);
    return { cn, references };
}

function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const token = String(value);
    return /[",\r\n]/.test(token) ? `"${token.replace(/"/g, '""')}"` : token;
}

function rowsToCsv(columns, rows) {
    const lines = [columns.join(',')];
    for (const row of rows) {
        lines.push(columns.map(column => csvEscape(row[column])).join(','));
    }
    return `${lines.join('\n')}\n`;
}

module.exports = {
    EXPECTED_REFERENCE_COUNTS,
    buildFixtureCases,
    buildIdealCases,
    buildReferenceInventory,
    buildShapeDat,
    centerRelativeLigands,
    codeFromReferenceName,
    csvEscape,
    formatCoordinate,
    loadQShape,
    parseShapeOut,
    parseShapeReferenceListing,
    parseXyzFile,
    rowsToCsv,
    shellQuote,
    sha256Buffer,
    sha256File
};
