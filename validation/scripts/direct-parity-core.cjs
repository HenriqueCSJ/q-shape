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

const SHAPE_CODE_ALIASES = Object.freeze({
    '3:fac-vOC-3': 'fvOC-3',
    '3:mer-vOC-3': 'mvOC-3',
    '8:JBTP-8': 'JBTPR-8'
});

const DECIMAL_TOKEN_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/;

let babelHookRoot = null;

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
    if (babelHookRoot === sourceRoot) return;
    if (babelHookRoot !== null) {
        throw new Error(`Babel source hook already installed for ${babelHookRoot}`);
    }
    const previousLoader = require.extensions['.js'];
    const babel = require('@babel/core');
    process.env.BABEL_ENV = 'test';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

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
    babelHookRoot = sourceRoot;
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
        pointGroups: referenceModule.POINT_GROUPS,
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

function expectedShapeCode(cn, qshapeCode) {
    return SHAPE_CODE_ALIASES[`${cn}:${qshapeCode}`] || qshapeCode;
}

function bindShapeReferenceListing(inventoryItem, parsedListing) {
    if (parsedListing.cn !== inventoryItem.cn) {
        throw new Error(
            `Cannot bind CN=${parsedListing.cn} SHAPE listing to CN=${inventoryItem.cn}`
        );
    }
    if (parsedListing.references.length !== inventoryItem.count) {
        throw new Error(
            `SHAPE listed ${parsedListing.references.length} references for CN=${inventoryItem.cn}; ` +
            `expected ${inventoryItem.count}`
        );
    }

    const indexSet = new Set();
    const codeSet = new Set();
    for (const reference of parsedListing.references) {
        if (!Number.isInteger(reference.index) || reference.index < 1) {
            throw new Error(`Invalid SHAPE reference index for CN=${inventoryItem.cn}`);
        }
        if (indexSet.has(reference.index)) {
            throw new Error(
                `Duplicate SHAPE reference index ${reference.index} for CN=${inventoryItem.cn}`
            );
        }
        if (codeSet.has(reference.shapeCode)) {
            throw new Error(
                `Duplicate SHAPE reference code ${reference.shapeCode} for CN=${inventoryItem.cn}`
            );
        }
        indexSet.add(reference.index);
        codeSet.add(reference.shapeCode);
    }
    for (let index = 1; index <= inventoryItem.count; index++) {
        if (!indexSet.has(index)) {
            throw new Error(`SHAPE omitted CN=${inventoryItem.cn} reference index ${index}`);
        }
    }

    for (const target of inventoryItem.targets) {
        const requiredShapeCode = expectedShapeCode(inventoryItem.cn, target.code);
        const official = parsedListing.references.find(
            reference => reference.shapeCode === requiredShapeCode
        );
        if (!official) {
            throw new Error(
                `SHAPE omitted required mapping CN=${inventoryItem.cn} ` +
                `${target.code}->${requiredShapeCode}`
            );
        }
        if (official.index !== target.index) {
            throw new Error(
                `Reference-order mismatch for CN=${inventoryItem.cn} ${target.code}: ` +
                `Q-Shape index ${target.index}, SHAPE index ${official.index}`
            );
        }
        target.shapeCode = official.shapeCode;
        target.shapeIndex = official.index;
        target.shapePointGroup = official.pointGroup;
        target.shapeDescription = official.description;
        target.mappingRule = requiredShapeCode === target.code
            ? 'exact_code'
            : 'explicit_alias_v1';
    }
    return inventoryItem;
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

function coordinateTokensToNumbers(tokens, context) {
    if (!Array.isArray(tokens) || tokens.length !== 3) {
        throw new Error(`Invalid coordinate token triplet in ${context}`);
    }
    return tokens.map(token => {
        if (typeof token !== 'string' || !DECIMAL_TOKEN_PATTERN.test(token)) {
            throw new Error(`Invalid coordinate token ${token} in ${context}`);
        }
        const value = Number(token);
        if (!Number.isFinite(value)) {
            throw new Error(`Non-finite coordinate token ${token} in ${context}`);
        }
        return value;
    });
}

function buildIdealCases(inventory) {
    const cases = [];
    for (const item of inventory) {
        item.targets.forEach((target, offset) => {
            const center = target.coordinates[target.coordinates.length - 1];
            const ligandTokens = centerRelativeLigands(target.coordinates).map(
                point => point.map(formatCoordinate)
            );
            const ligands = ligandTokens.map((tokens, ligandIndex) =>
                coordinateTokensToNumbers(
                    tokens,
                    `ideal CN=${item.cn} ${target.code} ligand ${ligandIndex + 1}`
                )
            );
            const atoms = [
                { element: 'Fe', tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000'] },
                ...ligandTokens.map(tokens => ({
                    element: 'C',
                    tokens
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
                shapeAtoms: atoms,
                inputCoordinatePolicy: 'same_decimal_tokens_for_qshape_and_shape'
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
        const canonicalLigandTokens = parsed.atoms.slice(1).map(atom =>
            atom.coordinates.map((value, axis) => formatCoordinate(value - center[axis]))
        );
        const actualLigands = canonicalLigandTokens.map((tokens, ligandIndex) =>
            coordinateTokensToNumbers(
                tokens,
                `${fileName} canonical ligand ${ligandIndex + 1}`
            )
        );
        const shapeAtoms = [
            {
                element: parsed.atoms[0].element,
                tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000']
            },
            ...parsed.atoms.slice(1).map((atom, ligandIndex) => ({
                element: atom.element,
                tokens: canonicalLigandTokens[ligandIndex]
            }))
        ];
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
            sourceAtoms: parsed.atoms.map(atom => ({
                element: atom.element,
                tokens: atom.tokens
            })),
            centerOriginal: center,
            actualLigands,
            shapeAtoms,
            inputCoordinatePolicy: 'source_xyz_translated_to_center_zero_then_fixed_to_15_decimals; identical canonical tokens feed both programs'
        });
    }
    return cases;
}

function buildShapeDat(cn, cases, targets) {
    if (!Number.isInteger(cn) || cn < 2) {
        throw new Error(`Invalid coordination number: ${cn}`);
    }
    if (!Array.isArray(cases) || cases.length === 0) {
        throw new Error(`No cases supplied for CN=${cn} SHAPE input`);
    }
    if (!Array.isArray(targets) || targets.length === 0 || targets.length > 12) {
        throw new Error(`Invalid target batch size for CN=${cn}`);
    }
    if (cases.some(item => item.cn !== cn)) {
        throw new Error(`Mixed coordination numbers in CN=${cn} SHAPE input`);
    }
    const structureIds = new Set();
    for (const item of cases) {
        if (!/^[A-Za-z0-9_.-]+$/.test(item.structureId || '')) {
            throw new Error(`Unsafe or empty SHAPE structure ID: ${item.structureId}`);
        }
        if (structureIds.has(item.structureId)) {
            throw new Error(`Duplicate SHAPE structure ID: ${item.structureId}`);
        }
        structureIds.add(item.structureId);
        if (!Array.isArray(item.shapeAtoms) || item.shapeAtoms.length !== cn + 1) {
            throw new Error(
                `${item.structureId} has ${item.shapeAtoms?.length ?? 'no'} atoms; expected ${cn + 1}`
            );
        }
        item.shapeAtoms.forEach((atom, atomIndex) => {
            if (!/^[A-Za-z][A-Za-z0-9]*$/.test(atom.element || '')) {
                throw new Error(`Invalid atom label in ${item.structureId} atom ${atomIndex + 1}`);
            }
            coordinateTokensToNumbers(
                atom.tokens,
                `${item.structureId} atom ${atomIndex + 1}`
            );
        });
    }
    const targetIndices = targets.map(target => target.shapeIndex ?? target.index);
    if (
        targetIndices.some(index => !Number.isInteger(index) || index < 1) ||
        new Set(targetIndices).size !== targetIndices.length
    ) {
        throw new Error(`Invalid or duplicate SHAPE target indices for CN=${cn}`);
    }
    const lines = [
        `$ Q-Shape direct parity validation, CN=${cn}`,
        '%fullout',
        `${cn} 1`,
        targetIndices.join(' ')
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
    const lines = text.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const structureMatch = line.match(/^\s*Structure\s+\d+\s+\[([^\]]+)\]/);
        if (structureMatch) {
            const structureId = structureMatch[1].trim();
            if (structures.some(item => item.structureId === structureId)) {
                throw new Error(`Duplicate SHAPE .out structure block: ${structureId}`);
            }
            current = { structureId, values: [] };
            structures.push(current);
            continue;
        }
        if (!current) continue;
        const valueMatch = line.match(
            /^\s*([^\s]+-\d+)\s+Ideal structure\s+CShM\s*=\s*(.*?)\s*$/
        );
        if (valueMatch) {
            if (current.values.some(item => item.targetCode === valueMatch[1])) {
                throw new Error(
                    `Duplicate SHAPE .out target ${valueMatch[1]} for ${current.structureId}`
                );
            }
            current.values.push({
                targetCode: valueMatch[1],
                valueToken: valueMatch[2],
                lexicallyValid: /^\d+\.\d{5}$/.test(valueMatch[2]),
                rawLineNumber: lineIndex + 1
            });
        }
    }
    return structures;
}

function parseShapeTab(text) {
    const headerLine = text.split(/\r?\n/).find(line => /^\s*Structure\s+\[[^\]]+\]/.test(line));
    if (!headerLine) {
        throw new Error('SHAPE .tab did not contain a structure header');
    }
    const closeBracket = headerLine.indexOf(']');
    const targetCodes = [...headerLine.slice(closeBracket + 1).matchAll(/([^\s,]+-\d+)/g)]
        .map(match => match[1]);
    if (targetCodes.length === 0 || new Set(targetCodes).size !== targetCodes.length) {
        throw new Error('SHAPE .tab target header is empty or contains duplicates');
    }

    const structures = [];
    const lines = text.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const match = line.match(/^ (.{15}),(.*)$/);
        if (!match) continue;
        const structureField = match[1];
        const structureId = structureField.trim();
        if (!structureId) {
            throw new Error(`Empty SHAPE .tab structure field at line ${lineIndex + 1}`);
        }
        if (structures.some(item => item.structureId === structureId)) {
            throw new Error(`Duplicate SHAPE .tab structure row: ${structureId}`);
        }
        const valueTokens = match[2].split(',').map(token => token.trim());
        if (valueTokens.length !== targetCodes.length) {
            throw new Error(
                `SHAPE .tab ${structureId} has ${valueTokens.length} values; ` +
                `expected ${targetCodes.length}`
            );
        }
        const values = valueTokens.map((valueToken, index) => ({
            targetCode: targetCodes[index],
            valueToken,
            lexicallyValid: /^\d+\.\d{3}$/.test(valueToken),
            rawLineNumber: lineIndex + 1
        }));
        structures.push({ structureId, structureField, values });
    }
    if (structures.length === 0) {
        throw new Error('SHAPE .tab did not contain any structure rows');
    }
    return { targetCodes, structures };
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
    if (references.length === 0) {
        throw new Error(`SHAPE reference listing for CN=${cn} contained no references`);
    }
    return { cn, references };
}

function float64Hex(value) {
    if (typeof value !== 'number') {
        throw new Error(`Cannot encode non-number as float64: ${value}`);
    }
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeDoubleBE(value, 0);
    return buffer.toString('hex');
}

function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function wslPathCommand(windowsPath) {
    return `wslpath -a ${shellQuote(windowsPath)}`;
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
    DECIMAL_TOKEN_PATTERN,
    EXPECTED_REFERENCE_COUNTS,
    SHAPE_CODE_ALIASES,
    bindShapeReferenceListing,
    buildFixtureCases,
    buildIdealCases,
    buildReferenceInventory,
    buildShapeDat,
    centerRelativeLigands,
    codeFromReferenceName,
    csvEscape,
    expectedShapeCode,
    float64Hex,
    formatCoordinate,
    loadQShape,
    parseShapeOut,
    parseShapeReferenceListing,
    parseShapeTab,
    parseXyzFile,
    rowsToCsv,
    shellQuote,
    sha256Buffer,
    sha256File,
    wslPathCommand
};
