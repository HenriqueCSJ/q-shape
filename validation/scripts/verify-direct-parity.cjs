#!/usr/bin/env node
'use strict';

// This verifier deliberately uses only Node.js core modules and does not import
// the runner, its parsers, the Q-Shape source loader, or the parity analyzer.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_REFERENCE_CODES = Object.freeze({
    2: ['L-2', 'vT-2', 'vOC-2'],
    3: ['TP-3', 'vT-3', 'fac-vOC-3', 'mer-vOC-3'],
    4: ['SP-4', 'T-4', 'SS-4', 'vTBPY-4'],
    5: ['PP-5', 'vOC-5', 'TBPY-5', 'SPY-5', 'JTBPY-5'],
    6: ['HP-6', 'PPY-6', 'OC-6', 'TPR-6', 'JPPY-6'],
    7: ['HP-7', 'HPY-7', 'PBPY-7', 'COC-7', 'CTPR-7', 'JPBPY-7', 'JETPY-7'],
    8: ['OP-8', 'HPY-8', 'HBPY-8', 'CU-8', 'SAPR-8', 'TDD-8', 'JGBF-8',
        'JETBPY-8', 'JBTP-8', 'BTPR-8', 'JSD-8', 'TT-8', 'ETBPY-8'],
    9: ['EP-9', 'OPY-9', 'HBPY-9', 'JTC-9', 'JCCU-9', 'CCU-9', 'JCSAPR-9',
        'CSAPR-9', 'JTCTPR-9', 'TCTPR-9', 'JTDIC-9', 'HH-9', 'MFF-9'],
    10: ['DP-10', 'EPY-10', 'OBPY-10', 'PPR-10', 'PAPR-10', 'JBCCU-10',
        'JBCSAPR-10', 'JMBIC-10', 'JATDI-10', 'JSPC-10', 'SDD-10', 'TD-10', 'HD-10'],
    11: ['HP-11', 'DPY-11', 'EBPY-11', 'JCPPR-11', 'JCPAPR-11', 'JAPPR-11', 'JASPC-11'],
    12: ['DP-12', 'HPY-12', 'DBPY-12', 'HPR-12', 'HAPR-12', 'TT-12', 'COC-12',
        'ACOC-12', 'IC-12', 'JSC-12', 'JEPBPY-12', 'JBAPPR-12', 'JSPMC-12']
});

const CODE_ALIASES = Object.freeze({
    '3:fac-vOC-3': 'fvOC-3',
    '3:mer-vOC-3': 'mvOC-3',
    '8:JBTP-8': 'JBTPR-8'
});

const EXPECTED_SHAPE_HASH = '1592122408e7f5486fd9665e96e129dda9390b1b0ac76da4d348e3070c1bb4cb';
const QSHAPE_SEED_POLICY = 'input-derived';
const EXPECTED_CANDIDATE_SNAPSHOT_PATHS = Object.freeze([
    'package.json',
    'package-lock.json',
    'src/constants/algorithmConstants.js',
    'src/constants/referenceGeometries/index.js',
    'src/services/algorithms/hungarian.js',
    'src/services/algorithms/kabsch.js',
    'src/services/shapeAnalysis/shapeCalculator.js',
    'validation/protocol.md',
    'validation/scripts/direct-parity-analysis.cjs',
    'validation/scripts/direct-parity-core.cjs',
    'validation/scripts/qshape-direct-worker.cjs',
    'validation/scripts/run-direct-parity.cjs',
    'validation/scripts/verify-direct-parity.cjs'
]);
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/;
const FIXED_15_PATTERN = /^[+-]?\d+\.\d{15}$/;
const SHAPE_5_PATTERN = /^\d+\.\d{5}$/;
const SHAPE_3_PATTERN = /^\d+\.\d{3}$/;

const COMPARISON_COLUMNS = Object.freeze([
    'case_id', 'stratum', 'cn', 'source_name', 'target_code', 'target_name',
    'shape_code', 'shape_token', 'qshape_full_precision', 'qshape_float64_hex',
    'qshape_display_5dp', 'signed_error', 'absolute_error', 'result_domain_valid',
    'pass_abs_0_01', 'runtime_ms', 'qshape_seed_policy',
    'qshape_explicit_seed_uint32', 'shape_raw_path', 'qshape_raw_path'
]);

const CASE_SUMMARY_COLUMNS = Object.freeze([
    'case_id', 'stratum', 'cn', 'source_name', 'expected_own_target_code',
    'shape_best_code', 'qshape_best_code', 'shape_tie_set', 'qshape_tie_set',
    'exact_best_label_agrees', 'qshape_best_within_shape_tie_set',
    'shape_best_second_margin', 'qshape_best_second_margin', 'max_absolute_error',
    'median_absolute_error', 'p95_absolute_error', 'p99_absolute_error',
    'mean_absolute_error', 'root_mean_square_error', 'signed_bias',
    'kendall_tau_b_gamma', 'kendall_concordant_pairs',
    'kendall_discordant_pairs', 'kendall_shape_only_ties',
    'kendall_qshape_only_ties', 'kendall_joint_ties', 'resolved_ranking_pairs',
    'discordant_ranking_pairs', 'ranking_agreement_fraction', 'failure_count', 'pass'
]);

const FAILURE_COLUMNS = Object.freeze([
    'failure_id', 'case_id', 'stratum', 'cn', 'gate', 'target_code',
    'comparison_code', 'observed', 'threshold', 'details', 'shape_raw_path',
    'qshape_raw_path', 'severity', 'status'
]);

class VerificationError extends Error {}

function fail(message) {
    throw new VerificationError(message);
}

function assert(condition, message) {
    if (!condition) fail(message);
}

function sha256File(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function float64Hex(value) {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeDoubleBE(value, 0);
    return buffer.toString('hex');
}

function canonicalBinary64Token(token, label = 'binary64 token') {
    assert(typeof token === 'string' && token.length > 0 && token.length <= 32,
        `${label} has invalid length`);
    assert(DECIMAL_PATTERN.test(token), `${label} is not a decimal token: ${token}`);
    const value = Number(token);
    assert(Number.isFinite(value), `${label} is not finite: ${token}`);
    const canonical = Object.is(value, -0) ? '-0' : value.toPrecision(17);
    assert(token === canonical,
        `${label} is not the canonical worker round-trip token: ${token}`);
    return value;
}

function fixed15(value) {
    assert(Number.isFinite(value), `Cannot canonicalize non-finite coordinate: ${value}`);
    return (Object.is(value, -0) ? 0 : value).toFixed(15);
}

const POW10 = [1n];
function pow10(exponent) {
    assert(Number.isInteger(exponent) && exponent >= 0, `Invalid decimal exponent ${exponent}`);
    while (POW10.length <= exponent) POW10.push(POW10[POW10.length - 1] * 10n);
    return POW10[exponent];
}

function parseDecimal(text) {
    assert(typeof text === 'string' && DECIMAL_PATTERN.test(text), `Invalid decimal token: ${text}`);
    const match = text.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:[Ee]([+-]?\d+))?$/);
    const sign = match[1] === '-' ? -1n : 1n;
    const integer = match[2] || '0';
    const fraction = match[3] || '';
    const exponent = Number(match[4] || 0);
    let coefficient = BigInt(`${integer}${fraction}` || '0') * sign;
    let scale = fraction.length - exponent;
    if (scale < 0) {
        coefficient *= pow10(-scale);
        scale = 0;
    }
    while (scale > 0 && coefficient % 10n === 0n) {
        coefficient /= 10n;
        scale -= 1;
    }
    return { coefficient, scale };
}

function alignDecimals(left, right) {
    const scale = Math.max(left.scale, right.scale);
    return {
        left: left.coefficient * pow10(scale - left.scale),
        right: right.coefficient * pow10(scale - right.scale),
        scale
    };
}

function compareDecimals(left, right) {
    const aligned = alignDecimals(left, right);
    return aligned.left < aligned.right ? -1 : aligned.left > aligned.right ? 1 : 0;
}

function subtractDecimals(left, right) {
    const aligned = alignDecimals(left, right);
    return { coefficient: aligned.left - aligned.right, scale: aligned.scale };
}

function absoluteDecimal(value) {
    return { coefficient: value.coefficient < 0n ? -value.coefficient : value.coefficient, scale: value.scale };
}

function decimalToNumber(value) {
    return Number(value.coefficient) / (10 ** value.scale);
}

function exactDecimalEqual(leftToken, rightToken) {
    return compareDecimals(parseDecimal(leftToken), parseDecimal(rightToken)) === 0;
}

function walk(root, current = root) {
    const files = [];
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        const stat = fs.lstatSync(fullPath);
        assert(!stat.isSymbolicLink(), `Symlink is forbidden in validation package: ${fullPath}`);
        if (entry.isDirectory()) files.push(...walk(root, fullPath));
        else if (entry.isFile()) files.push(fullPath);
    }
    return files;
}

function normalizeManifestPath(token) {
    assert(typeof token === 'string' && token.length > 0, 'Manifest path is empty');
    assert(!token.includes('\\'), `Manifest path contains backslash: ${token}`);
    assert(!path.posix.isAbsolute(token), `Manifest path is absolute: ${token}`);
    const normalized = path.posix.normalize(token);
    assert(normalized === token && normalized !== '..' && !normalized.startsWith('../'),
        `Unsafe manifest path: ${token}`);
    return token;
}

function resolveListedFile(root, listedPaths, token, label) {
    const normalized = normalizeManifestPath(token);
    assert(listedPaths.has(normalized), `${label} is not a manifested file: ${normalized}`);
    const filePath = path.join(root, ...normalized.split('/'));
    assert(isRegularFile(filePath), `${label} is not a regular file: ${normalized}`);
    return filePath;
}

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        fail(`Cannot parse JSON ${filePath}: ${error.message}`);
    }
}

function isRegularFile(filePath) {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function exactSet(actualValues, expectedValues, label) {
    const actual = new Set(actualValues);
    const expected = new Set(expectedValues);
    assert(actual.size === actualValues.length, `${label} contains duplicates`);
    const missing = [...expected].filter(value => !actual.has(value));
    const extra = [...actual].filter(value => !expected.has(value));
    assert(missing.length === 0 && extra.length === 0,
        `${label} set mismatch; missing=${missing.join('|')}; extra=${extra.join('|')}`);
}

function pairKey(caseId, targetCode) {
    return `${caseId}\u0000${targetCode}`;
}

function repeatedPairKey(repetition, caseId, targetCode) {
    return `${repetition}\u0000${caseId}\u0000${targetCode}`;
}

function parseCsvDocument(text) {
    const records = [];
    let record = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index += 1;
            } else if (character === '"') quoted = false;
            else field += character;
        } else if (character === '"') quoted = true;
        else if (character === ',') {
            record.push(field);
            field = '';
        } else if (character === '\n') {
            record.push(field.replace(/\r$/, ''));
            records.push(record);
            record = [];
            field = '';
        } else field += character;
    }
    assert(!quoted, 'CSV ends inside a quoted field');
    if (field.length || record.length) {
        record.push(field.replace(/\r$/, ''));
        records.push(record);
    }
    assert(records.length > 0, 'CSV is empty');
    const header = records[0];
    exactSet(header, header, 'CSV header');
    const rows = records.slice(1).filter(row => !(row.length === 1 && row[0] === '')).map((row, index) => {
        assert(row.length === header.length, `CSV row ${index + 2} has wrong field count`);
        return Object.fromEntries(header.map((column, offset) => [column, row[offset]]));
    });
    return { header, rows };
}

function parseCsv(text) {
    return parseCsvDocument(text).rows;
}

function parseXyz(text, label) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const declaredCount = Number.parseInt(lines[0]?.trim(), 10);
    assert(Number.isInteger(declaredCount) && declaredCount >= 2,
        `${label} has invalid atom count`);
    const comment = lines[1] ?? '';
    const atomLines = lines.slice(2).filter(line => line.trim().length > 0);
    assert(atomLines.length === declaredCount,
        `${label} declares ${declaredCount} atoms but contains ${atomLines.length}`);
    const atoms = atomLines.map((line, index) => {
        const fields = line.trim().split(/\s+/);
        assert(fields.length >= 4, `${label} has an invalid atom line ${index + 3}`);
        const tokens = fields.slice(1, 4);
        const coordinates = tokens.map(Number);
        assert(coordinates.every(Number.isFinite),
            `${label} has a non-finite coordinate at line ${index + 3}`);
        return { element: fields[0], tokens, coordinates };
    });
    return { declaredCount, comment, atoms };
}

function parseShapeDat(text, cn) {
    const lines = text.split(/\r?\n/);
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    assert(lines[0]?.startsWith('$ Q-Shape direct parity validation'), 'Invalid SHAPE .dat title');
    assert(lines[1] === '%fullout', 'SHAPE .dat lacks %fullout');
    assert(lines[2] === `${cn} 1`, `SHAPE .dat has incorrect CN/center control for CN=${cn}`);
    const targetIndices = lines[3].trim().split(/\s+/).map(Number);
    assert(targetIndices.length >= 1 && targetIndices.length <= 12, 'Invalid SHAPE target batch size');
    exactSet(targetIndices, targetIndices, 'SHAPE target indices');
    const structures = [];
    let offset = 4;
    while (offset < lines.length) {
        const structureId = lines[offset++];
        assert(/^[A-Za-z0-9_.-]+$/.test(structureId), `Invalid .dat structure ID ${structureId}`);
        const atoms = [];
        for (let atomIndex = 0; atomIndex < cn + 1; atomIndex++) {
            const fields = (lines[offset++] || '').trim().split(/\s+/);
            assert(fields.length === 4, `Invalid atom line for ${structureId}`);
            assert(FIXED_15_PATTERN.test(fields[1]) && FIXED_15_PATTERN.test(fields[2]) &&
                FIXED_15_PATTERN.test(fields[3]), `Noncanonical coordinate token in ${structureId}`);
            atoms.push({ element: fields[0], tokens: fields.slice(1) });
        }
        structures.push({ structureId, atoms });
    }
    exactSet(structures.map(item => item.structureId), structures.map(item => item.structureId),
        'SHAPE .dat structures');
    return { targetIndices, structures };
}

function parseShapeOut(text) {
    const structures = [];
    let current = null;
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
        const structureMatch = lines[index].match(/^\s*Structure\s+(\d+)\s+\[([^\]]{1,15})\]\s*$/);
        if (structureMatch) {
            const structureId = structureMatch[2].trim();
            assert(!structures.some(item => item.structureId === structureId),
                `Duplicate .out structure ${structureId}`);
            current = { structureId, values: [] };
            structures.push(current);
            continue;
        }
        if (!current) continue;
        const valueMatch = lines[index].match(
            /^\s*(\S+-\d+)\s+Ideal structure\s+CShM\s*=\s*(.*?)\s*$/
        );
        if (valueMatch) {
            assert(!current.values.some(value => value.targetCode === valueMatch[1]),
                `Duplicate .out target ${valueMatch[1]} for ${current.structureId}`);
            current.values.push({
                targetCode: valueMatch[1],
                valueToken: valueMatch[2],
                lexicallyValid: SHAPE_5_PATTERN.test(valueMatch[2]),
                rawLineNumber: index + 1
            });
        }
    }
    assert(structures.length > 0, 'SHAPE .out contains no structures');
    return structures;
}

function parseShapeTab(text) {
    const lines = text.split(/\r?\n/);
    const header = lines.find(line => /^\s*Structure\s+\[[^\]]+\]/.test(line));
    assert(header, 'SHAPE .tab lacks structure header');
    const targetCodes = [...header.slice(header.indexOf(']') + 1).matchAll(/([^\s,]+-\d+)/g)]
        .map(match => match[1]);
    assert(targetCodes.length > 0, 'SHAPE .tab contains no target columns');
    exactSet(targetCodes, targetCodes, 'SHAPE .tab target codes');
    const structures = [];
    for (let index = 0; index < lines.length; index++) {
        const match = lines[index].match(/^ (.{15}),(.*)$/);
        if (!match) continue;
        const structureId = match[1].trim();
        assert(structureId, `Empty SHAPE .tab structure at line ${index + 1}`);
        assert(!structures.some(item => item.structureId === structureId),
            `Duplicate SHAPE .tab structure ${structureId}`);
        const tokens = match[2].split(',').map(token => token.trim());
        assert(tokens.length === targetCodes.length,
            `SHAPE .tab ${structureId} has wrong value count`);
        structures.push({
            structureId,
            values: tokens.map((valueToken, targetIndex) => ({
                targetCode: targetCodes[targetIndex],
                valueToken,
                lexicallyValid: SHAPE_3_PATTERN.test(valueToken),
                rawLineNumber: index + 1
            }))
        });
    }
    assert(structures.length > 0, 'SHAPE .tab contains no structure rows');
    return { targetCodes, structures };
}

function parseShapeReferenceListing(text, expectedCn) {
    const header = text.match(/^\*\s+(\d+)\s+Vertices\s*$/m);
    assert(header && Number(header[1]) === expectedCn,
        `SHAPE reference listing header mismatch for CN=${expectedCn}`);
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
    references.sort((left, right) => left.index - right.index);
    assert(references.length > 0, `SHAPE reference listing is empty for CN=${expectedCn}`);
    exactSet(references.map(item => item.index),
        references.map((_, index) => index + 1), `SHAPE listing indices CN=${expectedCn}`);
    exactSet(references.map(item => item.shapeCode),
        references.map(item => item.shapeCode), `SHAPE listing codes CN=${expectedCn}`);
    return references;
}

function eventKey(event) {
    return [event.caseId, event.gate, event.targetCode || '', event.comparisonCode || ''].join('\u001f');
}

function addEvent(events, caseId, gate, targetCode = '', comparisonCode = '') {
    events.push({ caseId, gate, targetCode, comparisonCode });
}

function numericStats(signedErrors) {
    if (signedErrors.length === 0) return { count: 0 };
    const absolute = signedErrors.map(Math.abs).sort((left, right) => left - right);
    const ordered = [...signedErrors].sort((left, right) => left - right);
    const nearest = probability => absolute[Math.max(0, Math.ceil(probability * absolute.length) - 1)];
    const median = absolute.length % 2
        ? absolute[Math.floor(absolute.length / 2)]
        : (absolute[absolute.length / 2 - 1] + absolute[absolute.length / 2]) / 2;
    return {
        count: signedErrors.length,
        signed_bias: signedErrors.reduce((sum, value) => sum + value, 0) / signedErrors.length,
        mean_absolute_error: absolute.reduce((sum, value) => sum + value, 0) / absolute.length,
        root_mean_square_error: Math.sqrt(
            signedErrors.reduce((sum, value) => sum + value * value, 0) / signedErrors.length
        ),
        median_absolute_error: median,
        p95_absolute_error: nearest(0.95),
        p99_absolute_error: nearest(0.99),
        max_absolute_error: absolute[absolute.length - 1],
        signed_min: ordered[0],
        signed_max: ordered[ordered.length - 1]
    };
}

function numericDistribution(values) {
    if (values.length === 0) {
        return { count: 0, mean: null, median: null, p95: null, p99: null, max: null };
    }
    const sorted = [...values].sort((left, right) => left - right);
    const midpoint = Math.floor(sorted.length / 2);
    const median = sorted.length % 2
        ? sorted[midpoint]
        : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
    const nearest = probability => sorted[Math.max(0, Math.ceil(probability * sorted.length) - 1)];
    return {
        count: values.length,
        mean: values.reduce((sum, value) => sum + value, 0) / values.length,
        median,
        p95: nearest(0.95),
        p99: nearest(0.99),
        max: sorted[sorted.length - 1]
    };
}

function decimalToFixedHalfUp(value, digits) {
    assert(Number.isInteger(digits) && digits >= 0, 'Invalid fixed-decimal width');
    const negative = value.coefficient < 0n;
    let coefficient = negative ? -value.coefficient : value.coefficient;
    if (value.scale > digits) {
        const divisor = pow10(value.scale - digits);
        let rounded = coefficient / divisor;
        if ((coefficient % divisor) * 2n >= divisor) rounded += 1n;
        coefficient = rounded;
    } else coefficient *= pow10(digits - value.scale);
    const token = coefficient.toString().padStart(digits + 1, '0');
    const integer = digits === 0 ? token : token.slice(0, -digits);
    const fraction = digits === 0 ? '' : `.${token.slice(-digits)}`;
    return `${negative && coefficient !== 0n ? '-' : ''}${integer}${fraction}`;
}

function stableLedgerId(row, duplicateIndex = 0) {
    const payload = [
        row.case_id,
        row.gate,
        row.target_code,
        row.comparison_code,
        row.observed,
        row.threshold,
        row.details
    ].join('\u001f');
    const digest = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
    return duplicateIndex === 0 ? `failure-${digest}` : `failure-${digest}-${duplicateIndex + 1}`;
}

function verifyNumericStatistics(observed, expected, label) {
    assert(observed && typeof observed === 'object', `${label} is missing`);
    assert(observed.count === expected.count, `${label} count mismatch`);
    for (const field of [
        'signed_bias', 'mean_absolute_error', 'root_mean_square_error',
        'median_absolute_error', 'p95_absolute_error', 'p99_absolute_error',
        'max_absolute_error'
    ]) {
        if (expected.count === 0) assert(observed[field] === null, `${label} ${field} must be null`);
        else nearNumber(observed[field], expected[field], `${label} ${field}`);
    }
}

function verifyDistribution(observed, expected, label) {
    assert(observed && observed.count === expected.count, `${label} count mismatch`);
    for (const field of ['mean', 'median', 'p95', 'p99', 'max']) {
        if (expected.count === 0) assert(observed[field] === null, `${label} ${field} must be null`);
        else nearNumber(observed[field], expected[field], `${label} ${field}`);
    }
}

function gammaAwareKendall(rows) {
    const gamma = parseDecimal('0.02001');
    let concordant = 0;
    let discordant = 0;
    let shapeOnlyTies = 0;
    let qshapeOnlyTies = 0;
    let jointTies = 0;
    for (let left = 0; left < rows.length; left++) {
        for (let right = left + 1; right < rows.length; right++) {
            const shapeDelta = subtractDecimals(rows[left].shapeDecimal, rows[right].shapeDecimal);
            const qshapeDelta = subtractDecimals(rows[left].qshapeDecimal, rows[right].qshapeDecimal);
            const shapeTie = compareDecimals(absoluteDecimal(shapeDelta), gamma) <= 0;
            const qshapeTie = compareDecimals(absoluteDecimal(qshapeDelta), gamma) <= 0;
            if (shapeTie && qshapeTie) jointTies += 1;
            else if (shapeTie) shapeOnlyTies += 1;
            else if (qshapeTie) qshapeOnlyTies += 1;
            else {
                const sameSign = (shapeDelta.coefficient > 0n && qshapeDelta.coefficient > 0n) ||
                    (shapeDelta.coefficient < 0n && qshapeDelta.coefficient < 0n);
                if (sameSign) concordant += 1;
                else discordant += 1;
            }
        }
    }
    const denominatorSquared =
        (concordant + discordant + shapeOnlyTies) *
        (concordant + discordant + qshapeOnlyTies);
    return {
        tauB: denominatorSquared === 0
            ? null
            : (concordant - discordant) / Math.sqrt(denominatorSquared),
        concordant,
        discordant,
        shapeOnlyTies,
        qshapeOnlyTies,
        jointTies
    };
}

function nearNumber(observedToken, expected, label) {
    assert(observedToken !== null && observedToken !== undefined, `${label} is missing`);
    const observed = Number(observedToken);
    const tolerance = Math.max(1e-14, Math.abs(expected) * 1e-12);
    assert(Number.isFinite(observed) && Math.abs(observed - expected) <= tolerance,
        `${label} mismatch: observed=${observedToken}; expected=${expected}`);
}

function verifyManifest(root) {
    const manifestPath = path.join(root, 'manifest.json');
    const digestPath = path.join(root, 'manifest.sha256');
    assert(isRegularFile(manifestPath), 'manifest.json is missing');
    assert(isRegularFile(digestPath), 'manifest.sha256 is missing');
    const digestText = fs.readFileSync(digestPath, 'utf8');
    const digestMatch = digestText.match(/^([0-9a-f]{64})  manifest\.json\n$/);
    assert(digestMatch, 'manifest.sha256 has invalid syntax');
    const manifestSha256 = sha256File(manifestPath);
    assert(digestMatch[1] === manifestSha256, 'manifest.json digest mismatch');
    const manifest = readJson(manifestPath);
    assert(manifest.schema_version === 2, 'Unsupported manifest schema');
    assert(manifest.package_status === 'complete', 'Package is not complete');
    assert(manifest.overall_validation_status === 'incomplete',
        'Direct package must retain overall_validation_status=incomplete');
    assert(manifest.shape_executable_sha256 === EXPECTED_SHAPE_HASH,
        'Unexpected SHAPE executable digest');
    assert(manifest.qshape_seed_policy === QSHAPE_SEED_POLICY &&
        manifest.qshape_explicit_seed_uint32 === null, 'Unexpected Q-Shape seed policy');
    assert(Array.isArray(manifest.files), 'Manifest file inventory is missing');

    const listed = new Map();
    for (const entry of manifest.files) {
        const token = normalizeManifestPath(entry.path);
        assert(!listed.has(token), `Duplicate manifest path: ${token}`);
        assert(Number.isInteger(entry.size_bytes) && entry.size_bytes >= 0,
            `Invalid manifest size for ${token}`);
        assert(/^[0-9a-f]{64}$/.test(entry.sha256), `Invalid manifest digest for ${token}`);
        listed.set(token, entry);
    }
    const present = walk(root).map(filePath => path.relative(root, filePath).replace(/\\/g, '/'))
        .filter(token => token !== 'manifest.json' && token !== 'manifest.sha256');
    exactSet(present, [...listed.keys()], 'Manifest/present files');
    for (const [token, entry] of listed) {
        const filePath = path.join(root, ...token.split('/'));
        const stat = fs.statSync(filePath);
        assert(stat.size === entry.size_bytes, `Size mismatch for ${token}`);
        assert(sha256File(filePath) === entry.sha256, `Digest mismatch for ${token}`);
    }
    return { manifest, manifestSha256, listedPaths: new Set(listed.keys()) };
}

function verifyReferences(root, listedPaths) {
    const document = readJson(resolveListedFile(
        root, listedPaths, 'references.json', 'Reference inventory'
    ));
    assert(document.schema_version === 2 && document.count === 87, 'Invalid reference inventory envelope');
    assert(document.source_file === 'src/constants/referenceGeometries/index.js' &&
        /^[0-9a-f]{64}$/.test(document.source_sha256 || ''),
        'Reference inventory source identity is invalid');
    assert(document.mapping_policy ===
        'explicit code plus index; alias table v1 contains exactly three entries',
        'Reference mapping policy is invalid');
    assert(Array.isArray(document.by_cn) && document.by_cn.length === 11,
        'Reference inventory must span CN 2-12');
    const referencesByCn = new Map();
    for (const item of document.by_cn) {
        const expectedCodes = EXPECTED_REFERENCE_CODES[item.cn];
        assert(expectedCodes, `Unexpected reference CN=${item.cn}`);
        assert(item.count === expectedCodes.length && item.references.length === expectedCodes.length,
            `Reference count mismatch for CN=${item.cn}`);
        item.references.forEach((reference, index) => {
            const qCode = expectedCodes[index];
            const shapeCode = CODE_ALIASES[`${item.cn}:${qCode}`] || qCode;
            assert(reference.qshape_index === index + 1 && reference.shape_index === index + 1,
                `Reference index mismatch CN=${item.cn} index=${index + 1}`);
            assert(reference.reference_id ===
                `cn${String(item.cn).padStart(2, '0')}-r${String(index + 1).padStart(2, '0')}`,
            `Reference ID mismatch CN=${item.cn} index=${index + 1}`);
            assert(reference.qshape_code === qCode && reference.shape_code === shapeCode,
                `Reference code mapping mismatch CN=${item.cn} index=${index + 1}`);
            assert(typeof reference.qshape_name === 'string' && reference.qshape_name.length > 0,
                `Reference name is missing for ${qCode}`);
            assert(reference.qshape_center_index_zero_based === item.cn,
                `Reference center index mismatch for ${qCode}`);
            assert(reference.mapping_rule === (qCode === shapeCode ? 'exact_code' : 'explicit_alias_v1'),
                `Reference mapping rule mismatch for ${qCode}`);
            assert(Array.isArray(reference.qshape_reference_coordinate_fixed15_tokens) &&
                reference.qshape_reference_coordinate_fixed15_tokens.length === item.cn + 1,
                `Reference coordinate count mismatch for ${qCode}`);
            for (const point of reference.qshape_reference_coordinate_fixed15_tokens) {
                assert(Array.isArray(point) && point.length === 3 && point.every(token =>
                    FIXED_15_PATTERN.test(token)), `Invalid reference coordinate token for ${qCode}`);
            }
            assert(Array.isArray(reference.qshape_reference_coordinate_roundtrip_tokens) &&
                Array.isArray(reference.qshape_reference_coordinate_float64_hex) &&
                reference.qshape_reference_coordinate_roundtrip_tokens.length === item.cn + 1 &&
                reference.qshape_reference_coordinate_float64_hex.length === item.cn + 1,
                `Exact binary64 reference snapshot missing for ${qCode}`);
            for (let pointIndex = 0; pointIndex < item.cn + 1; pointIndex++) {
                const roundTrip = reference.qshape_reference_coordinate_roundtrip_tokens[pointIndex];
                const hex = reference.qshape_reference_coordinate_float64_hex[pointIndex];
                assert(roundTrip.length === 3 && hex.length === 3, `Reference point width mismatch for ${qCode}`);
                for (let axis = 0; axis < 3; axis++) {
                    const value = canonicalBinary64Token(
                        roundTrip[axis], `Reference ${qCode} point ${pointIndex + 1} axis ${axis + 1}`
                    );
                    assert(/^[0-9a-f]{16}$/.test(hex[axis]) && float64Hex(value) === hex[axis] &&
                        reference.qshape_reference_coordinate_fixed15_tokens[pointIndex][axis] ===
                            fixed15(value),
                        `Reference binary64 reconstruction mismatch for ${qCode}`);
                }
            }
        });
        referencesByCn.set(item.cn, item.references);
    }
    exactSet([...referencesByCn.keys()], Object.keys(EXPECTED_REFERENCE_CODES).map(Number),
        'Reference CN set');
    return referencesByCn;
}

function verifyCases(root, listedPaths, referencesByCn) {
    const document = readJson(resolveListedFile(root, listedPaths, 'cases.json', 'Case inventory'));
    assert(document.schema_version === 2 && document.count === 98, 'Invalid case inventory envelope');
    assert(document.strata?.retained_fixture === 11 && document.strata?.ideal_reference === 87,
        'Invalid case strata counts');
    const cases = document.cases;
    assert(Array.isArray(cases) && cases.length === 98, 'Case rows are missing');
    const expectedCaseIds = [];
    const expectedStructureIds = [];
    for (const [cnToken, codes] of Object.entries(EXPECTED_REFERENCE_CODES)) {
        const cn = Number(cnToken);
        expectedCaseIds.push(`fixture-cn${String(cn).padStart(2, '0')}`);
        expectedStructureIds.push(`F${String(cn).padStart(2, '0')}`);
        codes.forEach((_, index) => {
            expectedCaseIds.push(
                `ideal-cn${String(cn).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
            );
            expectedStructureIds.push(
                `I${String(cn).padStart(2, '0')}${String(index + 1).padStart(2, '0')}`
            );
        });
    }
    exactSet(cases.map(item => item.case_id), expectedCaseIds, 'Case IDs');
    exactSet(cases.map(item => item.structure_id), expectedStructureIds, 'Structure IDs');
    const caseById = new Map(cases.map(item => [item.case_id, item]));
    const caseByStructure = new Map(cases.map(item => [item.structure_id, item]));
    for (const cn of Object.keys(EXPECTED_REFERENCE_CODES).map(Number)) {
        const cnCases = cases.filter(item => item.cn === cn);
        assert(cnCases.filter(item => item.stratum === 'retained_fixture').length === 1,
            `CN=${cn} must contain one fixture`);
        assert(cnCases.filter(item => item.stratum === 'ideal_reference').length ===
            referencesByCn.get(cn).length, `CN=${cn} ideal case count mismatch`);
    }
    for (const item of cases) {
        assert(item.center_index_one_based_in_shape_input === 1,
            `${item.case_id} does not freeze center index 1`);
        assert(Number.isInteger(item.cn) && referencesByCn.has(item.cn),
            `${item.case_id} has an invalid coordination number`);
        assert(Array.isArray(item.canonical_shape_atoms) &&
            item.canonical_shape_atoms.length === item.cn + 1,
            `${item.case_id} atom count mismatch`);
        assert(Array.isArray(item.qshape_actual_ligand_tokens) &&
            item.qshape_actual_ligand_tokens.length === item.cn,
            `${item.case_id} Q-Shape ligand count mismatch`);
        assert(JSON.stringify(item.qshape_actual_ligand_tokens) === JSON.stringify(
            item.canonical_shape_atoms.slice(1).map(atom => atom.tokens)
        ), `${item.case_id} programs did not receive identical canonical ligand tokens`);
        assert(JSON.stringify(item.canonical_shape_atoms[0].tokens) === JSON.stringify([
            '0.000000000000000', '0.000000000000000', '0.000000000000000'
        ]), `${item.case_id} canonical center is not zero`);
        for (const atom of item.canonical_shape_atoms) {
            assert(atom.tokens.every(token => FIXED_15_PATTERN.test(token)),
                `${item.case_id} contains noncanonical input token`);
        }
        if (item.stratum === 'ideal_reference') {
            const match = item.case_id.match(/^ideal-cn(\d{2})-(\d{2})$/);
            assert(match && Number(match[1]) === item.cn, `Invalid ideal case ID ${item.case_id}`);
            const referenceIndex = Number(match[2]) - 1;
            const reference = referencesByCn.get(item.cn)[referenceIndex];
            const expected = EXPECTED_REFERENCE_CODES[item.cn][referenceIndex];
            assert(reference && item.expected_own_target_code === expected,
                `Ideal target mismatch for ${item.case_id}`);
            assert(item.structure_id ===
                `I${String(item.cn).padStart(2, '0')}${String(referenceIndex + 1).padStart(2, '0')}` &&
                item.source_name === reference.qshape_name &&
                item.source_file === 'src/constants/referenceGeometries/index.js' &&
                item.source_sha256 === null && item.source_atoms === null &&
                item.input_coordinate_policy === 'same_decimal_tokens_for_qshape_and_shape',
                `Ideal provenance metadata mismatch for ${item.case_id}`);
            const coordinates = reference.qshape_reference_coordinate_roundtrip_tokens.map(point =>
                point.map((token, axis) => canonicalBinary64Token(
                    token, `${item.case_id} source point axis ${axis + 1}`
                ))
            );
            const center = coordinates[coordinates.length - 1];
            assert(Array.isArray(item.source_center) && item.source_center.length === 3 &&
                item.source_center.every((value, axis) => Number.isFinite(value) &&
                    float64Hex(value) === float64Hex(center[axis])),
                `Ideal source center mismatch for ${item.case_id}`);
            const expectedAtoms = [
                { element: 'Fe', tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000'] },
                ...coordinates.slice(0, -1).map(point => ({
                    element: 'C',
                    tokens: point.map((value, axis) => fixed15(value - center[axis]))
                }))
            ];
            assert(JSON.stringify(item.canonical_shape_atoms) === JSON.stringify(expectedAtoms),
                `Ideal canonical coordinates do not derive from the reference snapshot for ${item.case_id}`);
        } else {
            assert(item.stratum === 'retained_fixture' &&
                item.case_id === `fixture-cn${String(item.cn).padStart(2, '0')}` &&
                item.structure_id === `F${String(item.cn).padStart(2, '0')}` &&
                item.expected_own_target_code === null &&
                item.input_coordinate_policy ===
                    'source_xyz_translated_to_center_zero_then_fixed_to_15_decimals; identical canonical tokens feed both programs',
                `Fixture metadata mismatch for ${item.case_id}`);
            assert(item.source_sha256 && /^[0-9a-f]{64}$/.test(item.source_sha256),
                `Fixture hash missing for ${item.case_id}`);
            assert(/^tests\/fixtures\/shape-parity\/CN\d+-[^/]+\.xyz$/.test(item.source_file),
                `Unsafe or unexpected fixture source path for ${item.case_id}`);
            assert(item.source_name === path.basename(item.source_file),
                `Fixture source name mismatch for ${item.case_id}`);
            const copiedToken = `inputs/fixtures/${path.basename(item.source_file)}`;
            const copied = resolveListedFile(root, listedPaths, copiedToken,
                `Fixture copy for ${item.case_id}`);
            assert(sha256File(copied) === item.source_sha256,
                `Fixture copy mismatch for ${item.case_id}`);
            const parsed = parseXyz(fs.readFileSync(copied, 'utf8'), copiedToken);
            assert(parsed.declaredCount === item.cn + 1,
                `Fixture atom count mismatch for ${item.case_id}`);
            const expectedSourceAtoms = parsed.atoms.map(atom => ({
                element: atom.element,
                tokens: atom.tokens
            }));
            assert(JSON.stringify(item.source_atoms) === JSON.stringify(expectedSourceAtoms),
                `Fixture source-atom snapshot mismatch for ${item.case_id}`);
            const center = parsed.atoms[0].coordinates;
            assert(Array.isArray(item.source_center) && item.source_center.length === 3 &&
                item.source_center.every((value, axis) => Number.isFinite(value) &&
                    float64Hex(value) === float64Hex(center[axis])),
                `Fixture source center mismatch for ${item.case_id}`);
            const expectedAtoms = [
                {
                    element: parsed.atoms[0].element,
                    tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000']
                },
                ...parsed.atoms.slice(1).map(atom => ({
                    element: atom.element,
                    tokens: atom.coordinates.map((value, axis) => fixed15(value - center[axis]))
                }))
            ];
            assert(JSON.stringify(item.canonical_shape_atoms) === JSON.stringify(expectedAtoms),
                `Fixture canonical coordinates do not derive from copied XYZ for ${item.case_id}`);
        }
    }
    return { cases, caseById, caseByStructure };
}

function verifyShapeEvidence(
    root,
    listedPaths,
    repeatability,
    casesState,
    referencesByCn,
    events,
    warnings
) {
    assert(repeatability.schema_version === 2 && repeatability.repetitions === 2,
        'Invalid SHAPE repeatability envelope');
    assert(Array.isArray(repeatability.batches) && repeatability.batches.length === 15,
        'SHAPE must contain exactly 15 batches');
    const expectedBatchKeys = Object.entries(EXPECTED_REFERENCE_CODES).flatMap(([cn, codes]) =>
        Array.from({ length: Math.ceil(codes.length / 12) }, (_, index) => `${cn}:${index + 1}`)
    );
    exactSet(repeatability.batches.map(batch => `${batch.cn}:${batch.batch}`),
        expectedBatchKeys, 'SHAPE batch IDs');
    const allRows = [];
    const primaryRows = [];
    const indicesByCn = new Map();
    let totalValueTokenMismatches = 0;
    for (const batch of repeatability.batches) {
        const references = referencesByCn.get(batch.cn);
        assert(references, `Unexpected SHAPE batch CN=${batch.cn}`);
        assert(Array.isArray(batch.files) && batch.files.length === 2, 'SHAPE batch must contain two runs');
        exactSet(batch.files.map(fileSet => fileSet.replicate), [1, 2], 'SHAPE repetition IDs');
        assert(batch.target_indices.length >= 1 && batch.target_indices.length <= 12,
            'SHAPE batch target count is outside 1-12');
        const targetReferences = batch.target_indices.map(index => references[index - 1]);
        assert(targetReferences.every(Boolean), `SHAPE batch contains invalid target index for CN=${batch.cn}`);
        assert(JSON.stringify(batch.target_shape_codes) === JSON.stringify(
            targetReferences.map(reference => reference.shape_code)
        ), `SHAPE batch code/index mapping mismatch for CN=${batch.cn}`);
        indicesByCn.set(batch.cn, [
            ...(indicesByCn.get(batch.cn) || []),
            ...batch.target_indices
        ]);
        const rowsByRepetition = [];
        for (const fileSet of batch.files) {
            assert(fileSet.replicate === 1 || fileSet.replicate === 2, 'Invalid SHAPE repetition');
            assert(fileSet.exit_code === 0, `SHAPE run has nonzero exit code: ${fileSet.out}`);
            for (const field of ['dat', 'out', 'tab', 'stdout', 'stderr', 'exit_code_file']) {
                resolveListedFile(root, listedPaths, fileSet[field], `SHAPE ${field}`);
            }
            const exitToken = fs.readFileSync(
                resolveListedFile(root, listedPaths, fileSet.exit_code_file, 'SHAPE exit code'),
                'utf8'
            );
            assert(exitToken === '0\n', `SHAPE exit-code file mismatch: ${fileSet.exit_code_file}`);
            const datPath = resolveListedFile(root, listedPaths, fileSet.dat, 'SHAPE .dat');
            const outPath = resolveListedFile(root, listedPaths, fileSet.out, 'SHAPE .out');
            const tabPath = resolveListedFile(root, listedPaths, fileSet.tab, 'SHAPE .tab');
            assert(sha256File(datPath) === fileSet.dat_sha256, `SHAPE .dat digest mismatch: ${fileSet.dat}`);
            assert(sha256File(outPath) === fileSet.out_sha256, `SHAPE .out digest mismatch: ${fileSet.out}`);
            assert(sha256File(tabPath) === fileSet.tab_sha256, `SHAPE .tab digest mismatch: ${fileSet.tab}`);
            const parsedDat = parseShapeDat(fs.readFileSync(datPath, 'utf8'), batch.cn);
            assert(JSON.stringify(parsedDat.targetIndices) === JSON.stringify(batch.target_indices),
                `SHAPE .dat target indices mismatch: ${fileSet.dat}`);
            const expectedCases = casesState.cases.filter(item => item.cn === batch.cn);
            exactSet(parsedDat.structures.map(item => item.structureId),
                expectedCases.map(item => item.structure_id), `${fileSet.dat} structures`);
            for (const structure of parsedDat.structures) {
                const caseItem = casesState.caseByStructure.get(structure.structureId);
                assert(JSON.stringify(structure.atoms) === JSON.stringify(caseItem.canonical_shape_atoms),
                    `SHAPE .dat coordinates mismatch for ${structure.structureId}`);
            }
            const parsedOut = parseShapeOut(fs.readFileSync(outPath, 'utf8'));
            const parsedTab = parseShapeTab(fs.readFileSync(tabPath, 'utf8'));
            exactSet(parsedOut.map(item => item.structureId), expectedCases.map(item => item.structure_id),
                `${fileSet.out} structures`);
            exactSet(parsedTab.structures.map(item => item.structureId),
                expectedCases.map(item => item.structure_id), `${fileSet.tab} structures`);
            const expectedShapeCodes = targetReferences.map(reference => reference.shape_code);
            assert(JSON.stringify(parsedTab.targetCodes) === JSON.stringify(expectedShapeCodes),
                `${fileSet.tab} target header mismatch`);
            const outByStructure = new Map(parsedOut.map(item => [item.structureId, item]));
            const tabByStructure = new Map(parsedTab.structures.map(item => [item.structureId, item]));
            const rows = [];
            for (const caseItem of expectedCases) {
                const outStructure = outByStructure.get(caseItem.structure_id);
                const tabStructure = tabByStructure.get(caseItem.structure_id);
                exactSet(outStructure.values.map(value => value.targetCode), expectedShapeCodes,
                    `${fileSet.out}/${caseItem.structure_id} targets`);
                exactSet(tabStructure.values.map(value => value.targetCode), expectedShapeCodes,
                    `${fileSet.tab}/${caseItem.structure_id} targets`);
                const tabByCode = new Map(tabStructure.values.map(value => [value.targetCode, value]));
                for (const outValue of outStructure.values) {
                    const reference = targetReferences.find(item => item.shape_code === outValue.targetCode);
                    const tabValue = tabByCode.get(outValue.targetCode);
                    if (!tabValue.lexicallyValid) {
                        addEvent(events, caseItem.case_id, 'shape_tab_lexical_token', reference.qshape_code);
                    } else if (outValue.lexicallyValid) {
                        const difference = absoluteDecimal(subtractDecimals(
                            parseDecimal(outValue.valueToken), parseDecimal(tabValue.valueToken)
                        ));
                        if (compareDecimals(difference, parseDecimal('0.000505')) > 0) {
                            addEvent(events, caseItem.case_id, 'shape_out_tab_inconsistency',
                                reference.qshape_code);
                        }
                    }
                    rows.push({
                        repetition: fileSet.replicate,
                        caseId: caseItem.case_id,
                        targetCode: reference.qshape_code,
                        shapeCode: reference.shape_code,
                        valueToken: outValue.valueToken,
                        lexicallyValid: outValue.lexicallyValid,
                        rawLineNumber: outValue.rawLineNumber,
                        rawPath: fileSet.out
                    });
                }
            }
            rowsByRepetition[fileSet.replicate - 1] = rows;
            allRows.push(...rows);
            if (fileSet.replicate === 1) primaryRows.push(...rows);
        }
        const firstMap = new Map(rowsByRepetition[0].map(row => [pairKey(row.caseId, row.targetCode), row]));
        const secondMap = new Map(rowsByRepetition[1].map(row => [pairKey(row.caseId, row.targetCode), row]));
        exactSet([...firstMap.keys()], [...secondMap.keys()], 'SHAPE repetition keys');
        let mismatches = 0;
        for (const [key, first] of firstMap) {
            const second = secondMap.get(key);
            if (first.valueToken !== second.valueToken) {
                mismatches += 1;
                addEvent(events, first.caseId, 'shape_repeatability', first.targetCode);
            }
        }
        assert(batch.value_token_mismatches === mismatches, 'SHAPE repeatability count mismatch');
        totalValueTokenMismatches += mismatches;
        assert(batch.dat_files_byte_identical === (batch.files[0].dat_sha256 === batch.files[1].dat_sha256),
            'SHAPE .dat byte-identity flag mismatch');
        assert(batch.dat_files_byte_identical === true,
            'SHAPE repeated runs must use byte-identical .dat input files');
        assert(batch.out_files_byte_identical === (batch.files[0].out_sha256 === batch.files[1].out_sha256),
            'SHAPE .out byte-identity flag mismatch');
        assert(batch.tab_files_byte_identical === (batch.files[0].tab_sha256 === batch.files[1].tab_sha256),
            'SHAPE .tab byte-identity flag mismatch');
        assert(batch.raw_byte_identity_is_diagnostic_not_a_scientific_gate === true,
            'SHAPE raw-byte diagnostic policy is missing');
        if (!batch.out_files_byte_identical) warnings.push(`raw_out_diff_cn${batch.cn}_b${batch.batch}`);
        if (!batch.tab_files_byte_identical) warnings.push(`raw_tab_diff_cn${batch.cn}_b${batch.batch}`);
    }
    for (const [cnToken, codes] of Object.entries(EXPECTED_REFERENCE_CODES)) {
        exactSet(indicesByCn.get(Number(cnToken)) || [], codes.map((_, index) => index + 1),
            `SHAPE batch coverage CN=${cnToken}`);
    }
    assert(allRows.length === 1904 && primaryRows.length === 952,
        'SHAPE raw/primary row counts are incorrect');
    exactSet(allRows.map(row => repeatedPairKey(row.repetition, row.caseId, row.targetCode)),
        allRows.map(row => repeatedPairKey(row.repetition, row.caseId, row.targetCode)),
        'SHAPE repeated result keys');
    exactSet(primaryRows.map(row => pairKey(row.caseId, row.targetCode)),
        primaryRows.map(row => pairKey(row.caseId, row.targetCode)), 'SHAPE primary result keys');
    assert(repeatability.total_value_token_mismatches === totalValueTokenMismatches,
        'SHAPE total repeatability mismatch count is inconsistent');
    assert(repeatability.raw_byte_differences_are_warnings_not_gates === true,
        'SHAPE raw-byte warning policy is missing');
    return { allRows, primaryRows, mismatchCount: totalValueTokenMismatches };
}

function compareJsonRows(observedRows, expectedRows, repeated, label) {
    assert(Array.isArray(observedRows) && observedRows.length === expectedRows.length,
        `${label} row count mismatch`);
    const keyOf = repeated
        ? row => repeatedPairKey(row.repetition || row.replicate, row.caseId, row.targetCode)
        : row => pairKey(row.caseId, row.targetCode);
    const observedKeys = observedRows.map(keyOf);
    const expectedKeys = expectedRows.map(keyOf);
    exactSet(observedKeys, expectedKeys, `${label} keys`);
    const observedMap = new Map(observedRows.map(row => [keyOf(row), row]));
    const expectedMap = new Map(expectedRows.map(row => [keyOf(row), row]));
    for (const [key, expected] of expectedMap) {
        const observed = observedMap.get(key);
        for (const field of ['valueToken', 'shapeCode', 'rawPath']) {
            if (expected[field] !== undefined) {
                assert(observed[field] === expected[field], `${label} ${field} mismatch for ${key}`);
            }
        }
    }
}

function verifyQShapeEvidence(root, listedPaths, expectedPairKeys, casesState, events) {
    const repetitions = [];
    for (let repetition = 1; repetition <= 2; repetition++) {
        const relativePath = `qshape/raw/repetition-${String(repetition).padStart(2, '0')}.json`;
        const stem = `qshape/raw/repetition-${String(repetition).padStart(2, '0')}`;
        assert(fs.readFileSync(resolveListedFile(
            root, listedPaths, `${stem}.exit-code.txt`, `Q-Shape repetition ${repetition} exit code`
        ), 'utf8') === '0\n', `Q-Shape repetition ${repetition} exit-code file is not zero`);
        assert(fs.readFileSync(resolveListedFile(
            root, listedPaths, `${stem}.stderr.txt`, `Q-Shape repetition ${repetition} stderr`
        ), 'utf8') === '', `Q-Shape repetition ${repetition} wrote to stderr`);
        assert(fs.readFileSync(resolveListedFile(
            root, listedPaths, `${stem}.stdout.txt`, `Q-Shape repetition ${repetition} stdout`
        ), 'utf8') === `Q-Shape repetition ${repetition}: 952 values\n`,
        `Q-Shape repetition ${repetition} stdout is inconsistent`);
        const payload = readJson(resolveListedFile(
            root, listedPaths, relativePath, `Q-Shape repetition ${repetition}`
        ));
        assert(payload.program === 'Q-Shape' && payload.mode === 'default' &&
            payload.seed_policy === QSHAPE_SEED_POLICY &&
            payload.explicit_seed_uint32 === null && payload.repetition === repetition &&
            payload.count === 952 && payload.results.length === 952,
            `Invalid Q-Shape repetition ${repetition} envelope`);
        const rows = payload.results.map(row => {
            exactSet(Object.keys(row), [
                'caseId', 'stratum', 'cn', 'targetCode', 'valueToken', 'valueHex',
                'runtimeMsToken', 'mode', 'seedPolicy', 'explicitSeed', 'repetition'
            ], `Q-Shape repetition ${repetition} row fields`);
            assert(row.repetition === repetition && row.seedPolicy === QSHAPE_SEED_POLICY &&
                row.explicitSeed === null && row.mode === 'default',
                `Q-Shape row contract mismatch in repetition ${repetition}`);
            const caseItem = casesState.caseById.get(row.caseId);
            assert(caseItem && row.cn === caseItem.cn && row.stratum === caseItem.stratum &&
                EXPECTED_REFERENCE_CODES[row.cn]?.includes(row.targetCode),
                `Q-Shape case/target identity mismatch in repetition ${repetition}`);
            assert(/^[0-9a-f]{16}$/.test(row.valueHex), 'Invalid Q-Shape float64 hex');
            const value = canonicalBinary64Token(
                row.valueToken, `Q-Shape ${row.caseId}/${row.targetCode}`
            );
            assert(float64Hex(value) === row.valueHex,
                `Q-Shape decimal/hex mismatch for ${row.caseId}/${row.targetCode}`);
            assert(/^\d+\.\d{6}$/.test(row.runtimeMsToken) &&
                Number.isFinite(Number(row.runtimeMsToken)) && Number(row.runtimeMsToken) >= 0,
                `Q-Shape runtime token mismatch for ${row.caseId}/${row.targetCode}`);
            return {
                ...row,
                rawPath: relativePath,
                lexicallyValid: true
            };
        });
        exactSet(rows.map(row => pairKey(row.caseId, row.targetCode)), expectedPairKeys,
            `Q-Shape repetition ${repetition} keys`);
        repetitions.push(rows);
    }
    const first = new Map(repetitions[0].map(row => [pairKey(row.caseId, row.targetCode), row]));
    const second = new Map(repetitions[1].map(row => [pairKey(row.caseId, row.targetCode), row]));
    let mismatchCount = 0;
    const expectedMismatches = [];
    for (const [key, row] of first) {
        const repeated = second.get(key);
        if (row.valueHex !== repeated.valueHex) {
            mismatchCount += 1;
            addEvent(events, row.caseId, 'qshape_repeatability', row.targetCode);
            expectedMismatches.push({
                caseId: row.caseId,
                targetCode: row.targetCode,
                primaryToken: row.valueToken,
                repeatedToken: repeated.valueToken,
                primaryHex: row.valueHex,
                repeatedHex: repeated.valueHex,
                primaryRawPath: row.rawPath,
                repeatedRawPath: repeated.rawPath
            });
        }
    }
    const repeatability = readJson(resolveListedFile(
        root, listedPaths, 'qshape/repeatability.json', 'Q-Shape repeatability'
    ));
    assert(repeatability.schema_version === 2 && repeatability.comparisons_per_repetition === 952 &&
        repeatability.comparison_basis === 'IEEE-754 binary64 hexadecimal bits' &&
        repeatability.mismatch_count === mismatchCount &&
        JSON.stringify(repeatability.mismatches) === JSON.stringify(expectedMismatches),
        'Q-Shape repeatability summary mismatch');
    const combined = readJson(resolveListedFile(
        root, listedPaths, 'qshape/results.json', 'Q-Shape combined results'
    ));
    assert(combined.schema_version === 2 && combined.mode === 'default' &&
        combined.seed_policy === QSHAPE_SEED_POLICY && combined.explicit_seed_uint32 === null &&
        combined.repetitions === 2 &&
        combined.count === 1904 && combined.results.length === 1904,
        'Q-Shape combined results envelope mismatch');
    const expectedCombined = [...repetitions[0], ...repetitions[1]];
    exactSet(combined.results.map(row =>
        repeatedPairKey(row.repetition, row.caseId, row.targetCode)), expectedCombined.map(row =>
        repeatedPairKey(row.repetition, row.caseId, row.targetCode)), 'Q-Shape combined keys');
    const combinedMap = new Map(combined.results.map(row => [
        repeatedPairKey(row.repetition, row.caseId, row.targetCode), row
    ]));
    for (const row of expectedCombined) {
        const observed = combinedMap.get(repeatedPairKey(row.repetition, row.caseId, row.targetCode));
        exactSet(Object.keys(observed), Object.keys(row), 'Q-Shape combined/raw row fields');
        for (const field of Object.keys(row)) {
            assert(JSON.stringify(observed[field]) === JSON.stringify(row[field]),
                `Q-Shape combined/raw ${field} mismatch`);
        }
    }
    return { allRows: expectedCombined, primaryRows: repetitions[0], mismatchCount };
}

function recomputeAnalysis(casesState, referencesByCn, shapeRows, qshapeRows, events) {
    const shapeMap = new Map(shapeRows.map(row => [pairKey(row.caseId, row.targetCode), row]));
    const qshapeMap = new Map(qshapeRows.map(row => [pairKey(row.caseId, row.targetCode), row]));
    const comparisons = [];
    const caseSummaries = [];
    for (const caseItem of casesState.cases) {
        const rows = [];
        for (const reference of referencesByCn.get(caseItem.cn)) {
            const key = pairKey(caseItem.case_id, reference.qshape_code);
            const shape = shapeMap.get(key);
            const qshape = qshapeMap.get(key);
            assert(shape && qshape, `Missing primary pair ${key}`);
            const shapeDecimal = shape.lexicallyValid && DECIMAL_PATTERN.test(shape.valueToken)
                ? parseDecimal(shape.valueToken) : null;
            const qshapeDecimal = qshape.lexicallyValid ? parseDecimal(qshape.valueToken) : null;
            if (!shape.lexicallyValid) addEvent(events, caseItem.case_id, 'shape_lexical_token', reference.qshape_code);
            if (!qshape.lexicallyValid) addEvent(events, caseItem.case_id, 'qshape_lexical_token', reference.qshape_code);
            if (shapeDecimal && shapeDecimal.coefficient < 0n) {
                addEvent(events, caseItem.case_id, 'shape_negative_cshm', reference.qshape_code);
            }
            if (qshapeDecimal && qshapeDecimal.coefficient < 0n) {
                addEvent(events, caseItem.case_id, 'qshape_negative_cshm', reference.qshape_code);
            }
            if (shapeDecimal && compareDecimals(shapeDecimal, parseDecimal('100')) > 0) {
                addEvent(events, caseItem.case_id, 'shape_cshm_above_100', reference.qshape_code);
            }
            if (qshapeDecimal && compareDecimals(qshapeDecimal, parseDecimal('100')) > 0) {
                addEvent(events, caseItem.case_id, 'qshape_cshm_above_100', reference.qshape_code);
            }
            const domainValid = Boolean(shapeDecimal && qshapeDecimal &&
                shapeDecimal.coefficient >= 0n && qshapeDecimal.coefficient >= 0n &&
                compareDecimals(shapeDecimal, parseDecimal('100')) <= 0 &&
                compareDecimals(qshapeDecimal, parseDecimal('100')) <= 0);
            const signed = domainValid ? subtractDecimals(qshapeDecimal, shapeDecimal) : null;
            const absolute = signed ? absoluteDecimal(signed) : null;
            if (domainValid && compareDecimals(absolute, parseDecimal('0.01')) >= 0) {
                addEvent(events, caseItem.case_id, 'absolute_error', reference.qshape_code);
            }
            const result = {
                caseItem,
                reference,
                shape,
                qshape,
                shapeDecimal,
                qshapeDecimal,
                signed,
                absolute,
                domainValid
            };
            rows.push(result);
            comparisons.push(result);
        }
        const finite = rows.filter(row => row.domainValid);
        const byShape = [...finite].sort((left, right) =>
            compareDecimals(left.shapeDecimal, right.shapeDecimal) ||
            left.reference.qshape_code.localeCompare(right.reference.qshape_code)
        );
        const byQ = [...finite].sort((left, right) =>
            compareDecimals(left.qshapeDecimal, right.qshapeDecimal) ||
            left.reference.qshape_code.localeCompare(right.reference.qshape_code)
        );
        const shapeBest = byShape[0]?.reference.qshape_code || '';
        const qshapeBest = byQ[0]?.reference.qshape_code || '';
        const gamma = parseDecimal('0.02001');
        const shapeTieSet = byShape.length ? byShape.filter(row =>
            compareDecimals(subtractDecimals(row.shapeDecimal, byShape[0].shapeDecimal), gamma) <= 0
        ).map(row => row.reference.qshape_code) : [];
        const qshapeTieSet = byQ.length ? byQ.filter(row =>
            compareDecimals(subtractDecimals(row.qshapeDecimal, byQ[0].qshapeDecimal), gamma) <= 0
        ).map(row => row.reference.qshape_code) : [];
        if (finite.length && !shapeTieSet.includes(qshapeBest)) {
            addEvent(events, caseItem.case_id, 'best_geometry_outside_shape_tie_set', qshapeBest, shapeBest);
        }
        let resolvedPairs = 0;
        let discordantPairs = 0;
        for (let left = 0; left < finite.length; left++) {
            for (let right = left + 1; right < finite.length; right++) {
                const shapeDelta = subtractDecimals(finite[left].shapeDecimal, finite[right].shapeDecimal);
                if (compareDecimals(absoluteDecimal(shapeDelta), gamma) <= 0) continue;
                resolvedPairs += 1;
                const qDelta = subtractDecimals(finite[left].qshapeDecimal, finite[right].qshapeDecimal);
                const sameStrictSign = (shapeDelta.coefficient > 0n && qDelta.coefficient > 0n) ||
                    (shapeDelta.coefficient < 0n && qDelta.coefficient < 0n);
                if (!sameStrictSign) {
                    discordantPairs += 1;
                    addEvent(events, caseItem.case_id, 'ranking_loss_or_inversion',
                        finite[left].reference.qshape_code, finite[right].reference.qshape_code);
                }
            }
        }
        if (caseItem.stratum === 'ideal_reference') {
            const own = finite.find(row => row.reference.qshape_code === caseItem.expected_own_target_code);
            if (!own) addEvent(events, caseItem.case_id, 'missing_valid_ideal_self_result',
                caseItem.expected_own_target_code);
            else {
                if (compareDecimals(own.qshapeDecimal, parseDecimal('1e-8')) >= 0) {
                    addEvent(events, caseItem.case_id, 'ideal_self_qshape', caseItem.expected_own_target_code);
                }
                if (compareDecimals(own.shapeDecimal, parseDecimal('0.01')) >= 0) {
                    addEvent(events, caseItem.case_id, 'ideal_self_shape', caseItem.expected_own_target_code);
                }
                if (!shapeTieSet.includes(caseItem.expected_own_target_code)) {
                    addEvent(events, caseItem.case_id, 'ideal_nominal_outside_shape_tie_set',
                        caseItem.expected_own_target_code);
                }
            }
        }
        const kendall = gammaAwareKendall(finite);
        caseSummaries.push({
            caseItem,
            shapeBest,
            qshapeBest,
            shapeTieSet,
            qshapeTieSet,
            resolvedPairs,
            discordantPairs,
            kendall,
            finite
        });
    }
    return { comparisons, caseSummaries };
}

function verifyDerivedReports(
    root,
    listedPaths,
    analysisState,
    casesState,
    referencesByCn,
    events
) {
    const readCsv = (token, columns, label) => {
        const document = parseCsvDocument(fs.readFileSync(
            resolveListedFile(root, listedPaths, token, label), 'utf8'
        ));
        assert(JSON.stringify(document.header) === JSON.stringify(columns),
            `${label} header mismatch`);
        return document.rows;
    };
    const verifyRawPath = (token, label) => {
        if (token === '') return;
        const parts = token.split('|');
        assert(parts.every(Boolean), `${label} contains an empty path component`);
        for (const part of parts) resolveListedFile(root, listedPaths, part, label);
    };

    const comparisonRows = readCsv(
        'reports/comparisons.csv', COMPARISON_COLUMNS, 'comparisons.csv'
    );
    assert(comparisonRows.length === 952, 'comparisons.csv must contain 952 rows');
    const comparisonKeys = comparisonRows.map(row => pairKey(row.case_id, row.target_code));
    const expectedComparisonKeys = analysisState.comparisons.map(item =>
        pairKey(item.caseItem.case_id, item.reference.qshape_code));
    exactSet(comparisonKeys, expectedComparisonKeys, 'comparisons.csv keys');
    const comparisonMap = new Map(comparisonRows.map(row => [
        pairKey(row.case_id, row.target_code), row
    ]));
    const signedErrors = [];
    for (const item of analysisState.comparisons) {
        const label = `${item.caseItem.case_id}/${item.reference.qshape_code}`;
        const row = comparisonMap.get(pairKey(item.caseItem.case_id, item.reference.qshape_code));
        assert(row.case_id === item.caseItem.case_id && row.stratum === item.caseItem.stratum &&
            row.cn === String(item.caseItem.cn) && row.source_name === item.caseItem.source_name &&
            row.target_code === item.reference.qshape_code &&
            row.target_name === item.reference.qshape_name &&
            row.shape_code === item.reference.shape_code,
            `Comparison identity fields mismatch for ${label}`);
        assert(row.shape_token === item.shape.valueToken &&
            row.qshape_full_precision === item.qshape.valueToken &&
            row.qshape_float64_hex === item.qshape.valueHex &&
            row.runtime_ms === item.qshape.runtimeMsToken &&
            row.qshape_seed_policy === QSHAPE_SEED_POLICY &&
            row.qshape_explicit_seed_uint32 === '' &&
            row.shape_raw_path === item.shape.rawPath && row.qshape_raw_path === item.qshape.rawPath,
            `Comparison raw fields mismatch for ${label}`);
        verifyRawPath(row.shape_raw_path, `Comparison SHAPE raw path for ${label}`);
        verifyRawPath(row.qshape_raw_path, `Comparison Q-Shape raw path for ${label}`);
        const expectedDisplay = item.qshapeDecimal.coefficient >= 0n
            ? decimalToFixedHalfUp(item.qshapeDecimal, 5)
            : '';
        assert(row.qshape_display_5dp === expectedDisplay,
            `Comparison five-decimal display mismatch for ${label}`);
        assert(row.result_domain_valid === String(item.domainValid),
            `Comparison domain flag mismatch for ${label}`);
        assert(row.pass_abs_0_01 === String(Boolean(
            item.absolute && compareDecimals(item.absolute, parseDecimal('0.01')) < 0
        )), `Comparison absolute gate flag mismatch for ${label}`);
        if (item.domainValid) {
            const expectedSigned = decimalToNumber(item.signed);
            nearNumber(row.signed_error, expectedSigned, `Comparison signed error for ${label}`);
            nearNumber(row.absolute_error, Math.abs(expectedSigned),
                `Comparison absolute error for ${label}`);
            signedErrors.push(expectedSigned);
        } else {
            assert(row.signed_error === '' && row.absolute_error === '',
                `Invalid-domain comparison contains derived errors for ${label}`);
        }
    }

    const eventCountsByCase = new Map();
    for (const event of events) {
        eventCountsByCase.set(event.caseId, (eventCountsByCase.get(event.caseId) || 0) + 1);
    }
    const caseRows = readCsv(
        'reports/case-summary.csv', CASE_SUMMARY_COLUMNS, 'case-summary.csv'
    );
    assert(caseRows.length === 98, 'case-summary.csv must contain 98 rows');
    const caseKeys = caseRows.map(row => row.case_id);
    exactSet(caseKeys, analysisState.caseSummaries.map(item => item.caseItem.case_id),
        'case-summary.csv keys');
    const caseMap = new Map(caseRows.map(row => [row.case_id, row]));
    for (const item of analysisState.caseSummaries) {
        const caseId = item.caseItem.case_id;
        const row = caseMap.get(caseId);
        const shapeOrder = [...item.finite].sort((left, right) =>
            compareDecimals(left.shapeDecimal, right.shapeDecimal) ||
            left.reference.qshape_code.localeCompare(right.reference.qshape_code)
        );
        const qshapeOrder = [...item.finite].sort((left, right) =>
            compareDecimals(left.qshapeDecimal, right.qshapeDecimal) ||
            left.reference.qshape_code.localeCompare(right.reference.qshape_code)
        );
        const shapeMargin = shapeOrder.length > 1
            ? subtractDecimals(shapeOrder[1].shapeDecimal, shapeOrder[0].shapeDecimal)
            : null;
        const qshapeMargin = qshapeOrder.length > 1
            ? subtractDecimals(qshapeOrder[1].qshapeDecimal, qshapeOrder[0].qshapeDecimal)
            : null;
        const exactBest = item.shapeBest !== '' && item.shapeBest === item.qshapeBest;
        const bestWithinTie = item.qshapeBest !== '' && item.shapeTieSet.includes(item.qshapeBest);
        assert(row.stratum === item.caseItem.stratum && row.cn === String(item.caseItem.cn) &&
            row.source_name === item.caseItem.source_name &&
            row.expected_own_target_code === (item.caseItem.expected_own_target_code ?? '') &&
            row.shape_best_code === item.shapeBest && row.qshape_best_code === item.qshapeBest &&
            row.shape_tie_set === item.shapeTieSet.join('|') &&
            row.qshape_tie_set === item.qshapeTieSet.join('|') &&
            row.exact_best_label_agrees === String(exactBest) &&
            row.qshape_best_within_shape_tie_set === String(bestWithinTie),
            `Case identity/best-geometry fields mismatch for ${caseId}`);
        if (shapeMargin) nearNumber(row.shape_best_second_margin,
            decimalToNumber(shapeMargin), `SHAPE best-second margin for ${caseId}`);
        else assert(row.shape_best_second_margin === '', `Unexpected SHAPE margin for ${caseId}`);
        if (qshapeMargin) nearNumber(row.qshape_best_second_margin,
            decimalToNumber(qshapeMargin), `Q-Shape best-second margin for ${caseId}`);
        else assert(row.qshape_best_second_margin === '', `Unexpected Q-Shape margin for ${caseId}`);
        const statistics = numericStats(item.finite.map(value => decimalToNumber(value.signed)));
        const caseStatisticColumns = {
            max_absolute_error: 'max_absolute_error',
            median_absolute_error: 'median_absolute_error',
            p95_absolute_error: 'p95_absolute_error',
            p99_absolute_error: 'p99_absolute_error',
            mean_absolute_error: 'mean_absolute_error',
            root_mean_square_error: 'root_mean_square_error',
            signed_bias: 'signed_bias'
        };
        for (const [column, field] of Object.entries(caseStatisticColumns)) {
            if (statistics.count === 0) assert(row[column] === '',
                `Unexpected ${column} for ${caseId}`);
            else nearNumber(row[column], statistics[field], `${column} for ${caseId}`);
        }
        if (item.kendall.tauB === null) {
            assert(row.kendall_tau_b_gamma === 'not_applicable',
                `Kendall tau applicability mismatch for ${caseId}`);
        } else nearNumber(row.kendall_tau_b_gamma, item.kendall.tauB,
            `Kendall tau for ${caseId}`);
        assert(Number(row.kendall_concordant_pairs) === item.kendall.concordant &&
            Number(row.kendall_discordant_pairs) === item.kendall.discordant &&
            Number(row.kendall_shape_only_ties) === item.kendall.shapeOnlyTies &&
            Number(row.kendall_qshape_only_ties) === item.kendall.qshapeOnlyTies &&
            Number(row.kendall_joint_ties) === item.kendall.jointTies &&
            Number(row.resolved_ranking_pairs) === item.resolvedPairs &&
            Number(row.discordant_ranking_pairs) === item.discordantPairs,
            `Ranking accounting mismatch for ${caseId}`);
        if (item.resolvedPairs === 0) assert(row.ranking_agreement_fraction === 'not_applicable',
            `Ranking agreement applicability mismatch for ${caseId}`);
        else nearNumber(row.ranking_agreement_fraction,
            (item.resolvedPairs - item.discordantPairs) / item.resolvedPairs,
            `Ranking agreement for ${caseId}`);
        const failureCount = eventCountsByCase.get(caseId) || 0;
        assert(Number(row.failure_count) === failureCount &&
            row.pass === String(failureCount === 0), `Case pass/failure mismatch for ${caseId}`);
    }

    const ledgerRows = readCsv(
        'reports/failure-ledger.csv', FAILURE_COLUMNS, 'failure-ledger.csv'
    );
    const expectedEventKeys = events.map(eventKey).sort();
    const observedEventKeys = ledgerRows.map(row => eventKey({
        caseId: row.case_id,
        gate: row.gate,
        targetCode: row.target_code,
        comparisonCode: row.comparison_code
    })).sort();
    assert(JSON.stringify(observedEventKeys) === JSON.stringify(expectedEventKeys),
        'Failure ledger does not match independently recomputed gate events');
    const sortedLedger = [...ledgerRows].sort((left, right) =>
        left.case_id.localeCompare(right.case_id) ||
        left.gate.localeCompare(right.gate) ||
        left.target_code.localeCompare(right.target_code) ||
        left.comparison_code.localeCompare(right.comparison_code) ||
        left.observed.localeCompare(right.observed)
    );
    assert(JSON.stringify(ledgerRows) === JSON.stringify(sortedLedger),
        'Failure ledger is not in deterministic order');
    const idCounts = new Map();
    for (const row of ledgerRows) {
        const caseItem = casesState.caseById.get(row.case_id);
        assert(caseItem && row.stratum === caseItem.stratum && row.cn === String(caseItem.cn),
            `Failure ledger case metadata mismatch for ${row.case_id}`);
        const codes = EXPECTED_REFERENCE_CODES[caseItem.cn];
        assert((row.target_code === '' || codes.includes(row.target_code)) &&
            (row.comparison_code === '' || codes.includes(row.comparison_code)),
            `Failure ledger target code mismatch for ${row.case_id}`);
        assert(row.severity === 'gate_failure' && row.status === 'fail',
            'Failure ledger row has invalid severity/status');
        verifyRawPath(row.shape_raw_path, `Failure SHAPE raw path for ${row.case_id}`);
        verifyRawPath(row.qshape_raw_path, `Failure Q-Shape raw path for ${row.case_id}`);
        const provisional = stableLedgerId(row);
        const duplicateIndex = idCounts.get(provisional) || 0;
        assert(row.failure_id === stableLedgerId(row, duplicateIndex),
            `Invalid deterministic failure ID ${row.failure_id}`);
        idCounts.set(provisional, duplicateIndex + 1);
    }

    const summary = readJson(resolveListedFile(
        root, listedPaths, 'reports/summary.json', 'Summary report'
    ));
    const campaignGateStatus = events.length === 0 ? 'pass' : 'fail';
    assert(summary.schema_version === 2 && summary.campaign_gate_status === campaignGateStatus &&
        summary.overall_validation_status === 'incomplete' &&
        summary.claim_boundary ===
            'direct agreement on shared ideal references and retained fixtures only',
        'Summary status/claim boundary mismatch');
    assert(JSON.stringify(summary.gates) === JSON.stringify({
        absolute_error_cshm: '<0.01',
        ideal_self_qshape_cshm: '<1e-8',
        ideal_self_shape_cshm: '<0.01',
        shape_tie_set_gamma_cshm: '0.02001',
        best_geometry: 'Q-Shape minimum must belong to the SHAPE tie set',
        resolved_ranking_pairs: 'same strict sign when |SHAPE delta|>gamma',
        cshm_domain: 'finite and within [0, 100]'
    }), 'Summary gate definitions mismatch');

    const verifyRankStatistics = (observed, caseSummaries, label) => {
        assert(observed?.definition ===
            'Kendall tau-b with gamma=0.02001 CShM used as the tie threshold in both programs',
        `${label} definition mismatch`);
        const tauValues = caseSummaries.map(item => item.kendall.tauB)
            .filter(value => value !== null);
        verifyDistribution(observed.tau_b_across_cases,
            numericDistribution(tauValues), `${label} tau-b distribution`);
        const components = {
            concordant_pairs: caseSummaries.reduce((sum, item) => sum + item.kendall.concordant, 0),
            discordant_pairs: caseSummaries.reduce((sum, item) => sum + item.kendall.discordant, 0),
            shape_only_ties: caseSummaries.reduce((sum, item) => sum + item.kendall.shapeOnlyTies, 0),
            qshape_only_ties: caseSummaries.reduce((sum, item) => sum + item.kendall.qshapeOnlyTies, 0),
            joint_ties: caseSummaries.reduce((sum, item) => sum + item.kendall.jointTies, 0)
        };
        const candidatePairs = Object.values(components).reduce((sum, value) => sum + value, 0);
        assert(observed.kendall_pair_components?.candidate_pairs === candidatePairs,
            `${label} candidate-pair count mismatch`);
        for (const [field, value] of Object.entries(components)) {
            assert(observed.kendall_pair_components[field] === value,
                `${label} ${field} mismatch`);
        }
        const resolved = caseSummaries.reduce((sum, item) => sum + item.resolvedPairs, 0);
        const discordant = caseSummaries.reduce((sum, item) => sum + item.discordantPairs, 0);
        assert(observed.resolved_ranking_pairs === resolved &&
            observed.discordant_ranking_pairs === discordant &&
            observed.protected_pair_agreement?.agree === resolved - discordant &&
            observed.protected_pair_agreement?.total === resolved,
            `${label} protected-pair accounting mismatch`);
        if (resolved === 0) assert(observed.protected_pair_agreement.fraction === 'not_applicable',
            `${label} protected-pair fraction must be not_applicable`);
        else nearNumber(observed.protected_pair_agreement.fraction,
            (resolved - discordant) / resolved, `${label} protected-pair fraction`);
    };

    const verifySubset = (observed, caseSummaries, label) => {
        const caseIds = new Set(caseSummaries.map(item => item.caseItem.case_id));
        const comparisons = analysisState.comparisons.filter(item =>
            caseIds.has(item.caseItem.case_id));
        const subsetErrors = comparisons.filter(item => item.domainValid)
            .map(item => decimalToNumber(item.signed));
        const expectedComparisons = caseSummaries.reduce((sum, item) =>
            sum + referencesByCn.get(item.caseItem.cn).length, 0);
        assert(observed.cases === caseSummaries.length &&
            observed.comparisons_expected === expectedComparisons &&
            observed.comparisons_observed === comparisons.length &&
            observed.comparisons_domain_valid === subsetErrors.length,
            `${label} census mismatch`);
        verifyNumericStatistics(observed.error_statistics, numericStats(subsetErrors),
            `${label} error statistics`);
        const exactBestAgree = caseSummaries.filter(item =>
            item.shapeBest !== '' && item.shapeBest === item.qshapeBest).length;
        const tieAgree = caseSummaries.filter(item =>
            item.qshapeBest !== '' && item.shapeTieSet.includes(item.qshapeBest)).length;
        assert(observed.exact_best_label_agreement?.agree === exactBestAgree &&
            observed.exact_best_label_agreement?.total === caseSummaries.length &&
            observed.best_within_shape_tie_set?.agree === tieAgree &&
            observed.best_within_shape_tie_set?.total === caseSummaries.length,
            `${label} best-geometry agreement mismatch`);
        assert(observed.failures === events.filter(event =>
            caseIds.has(event.caseId)).length, `${label} failure count mismatch`);
        verifyRankStatistics(observed.rank_statistics, caseSummaries, `${label} ranking`);
    };

    assert(summary.totals.reference_geometries === 87 && summary.totals.cases === 98 &&
        summary.totals.comparisons_expected === 952 && summary.totals.comparisons_observed === 952 &&
        summary.totals.comparisons_domain_valid === signedErrors.length &&
        summary.totals.failures === events.length, 'Summary totals mismatch');
    verifyNumericStatistics(summary.totals.error_statistics, numericStats(signedErrors),
        'Summary total error statistics');
    verifyRankStatistics(summary.totals.rank_statistics, analysisState.caseSummaries,
        'Summary total ranking');
    exactSet(Object.keys(summary.by_stratum), ['retained_fixture', 'ideal_reference'],
        'Summary stratum keys');
    for (const stratum of ['retained_fixture', 'ideal_reference']) {
        verifySubset(summary.by_stratum[stratum], analysisState.caseSummaries.filter(item =>
            item.caseItem.stratum === stratum), `Summary stratum ${stratum}`);
    }
    exactSet(Object.keys(summary.by_cn), Object.keys(EXPECTED_REFERENCE_CODES), 'Summary CN keys');
    for (const cnToken of Object.keys(EXPECTED_REFERENCE_CODES)) {
        verifySubset(summary.by_cn[cnToken], analysisState.caseSummaries.filter(item =>
            item.caseItem.cn === Number(cnToken)), `Summary CN ${cnToken}`);
    }
    return { campaignGateStatus, summary, signedErrors, ledgerRows };
}

function verifyPackage(packagePath) {
    const root = path.resolve(packagePath);
    assert(fs.existsSync(root) && fs.statSync(root).isDirectory(),
        `Package directory does not exist: ${root}`);
    const { manifest, manifestSha256, listedPaths } = verifyManifest(root);
    const referencesByCn = verifyReferences(root, listedPaths);
    const casesState = verifyCases(root, listedPaths, referencesByCn);
    const expectedKeys = [];
    for (const item of casesState.cases) {
        for (const reference of referencesByCn.get(item.cn)) {
            expectedKeys.push(pairKey(item.case_id, reference.qshape_code));
        }
    }
    assert(expectedKeys.length === 952, `Expected-pair census is ${expectedKeys.length}, not 952`);
    exactSet(expectedKeys, expectedKeys, 'Expected comparison keys');

    const events = [];
    const warnings = [];
    const shapeRepeatability = readJson(resolveListedFile(
        root, listedPaths, 'oracle/repeatability.json', 'SHAPE repeatability'
    ));
    const shapeState = verifyShapeEvidence(
        root,
        listedPaths,
        shapeRepeatability,
        casesState,
        referencesByCn,
        events,
        warnings
    );
    const parsedPrimary = readJson(resolveListedFile(
        root, listedPaths, 'oracle/parsed-results.json', 'SHAPE primary parsed results'
    ));
    assert(parsedPrimary.schema_version === 2 && parsedPrimary.count === 952 &&
        Array.isArray(parsedPrimary.results) && parsedPrimary.results.length === 952,
        'SHAPE primary parsed-results envelope mismatch');
    compareJsonRows(parsedPrimary.results, shapeState.primaryRows, false, 'SHAPE primary JSON');
    const parsedAll = readJson(resolveListedFile(
        root, listedPaths, 'oracle/all-results.json', 'SHAPE repeated parsed results'
    ));
    assert(parsedAll.schema_version === 1 && parsedAll.count === 1904 &&
        Array.isArray(parsedAll.results) && parsedAll.results.length === 1904,
        'SHAPE all-results envelope mismatch');
    compareJsonRows(parsedAll.results, shapeState.allRows, true, 'SHAPE repeated JSON');

    const qshapeState = verifyQShapeEvidence(
        root, listedPaths, expectedKeys, casesState, events
    );
    const analysisState = recomputeAnalysis(
        casesState, referencesByCn, shapeState.primaryRows, qshapeState.primaryRows, events
    );
    const reportState = verifyDerivedReports(
        root, listedPaths, analysisState, casesState, referencesByCn, events
    );

    const environment = readJson(resolveListedFile(
        root, listedPaths, 'metadata/run-environment.json', 'Run environment'
    ));
    assert(environment.schema_version === 2 && environment.qshape_commit === manifest.qshape_commit,
        'Run environment/manifest commit mismatch');
    assert(environment.shape_executable_sha256 === EXPECTED_SHAPE_HASH &&
        environment.shape_expected_sha256 === EXPECTED_SHAPE_HASH,
        'Run environment SHAPE digest mismatch');
    assert(environment.qshape_seed_policy === QSHAPE_SEED_POLICY &&
        environment.qshape_explicit_seed_uint32 === null,
        'Run environment seed policy mismatch');
    assert(Array.isArray(environment.reference_listings) &&
        environment.reference_listings.length === 11,
        'Run environment reference listings are incomplete');
    exactSet(environment.reference_listings.map(item => item.cn),
        Object.keys(EXPECTED_REFERENCE_CODES).map(Number), 'Run environment listing CNs');
    for (const listing of environment.reference_listings) {
        resolveListedFile(root, listedPaths, listing.raw_path,
            `Reference listing CN=${listing.cn}`);
        assert(Array.isArray(listing.references) &&
            listing.references.length === EXPECTED_REFERENCE_CODES[listing.cn].length,
            `Reference listing row count mismatch CN=${listing.cn}`);
    }
    assert(environment.candidate_source_sha256 &&
        typeof environment.candidate_source_sha256 === 'object',
        'Candidate source fingerprint map is missing');
    exactSet(Object.keys(environment.candidate_source_sha256),
        EXPECTED_CANDIDATE_SNAPSHOT_PATHS, 'Candidate source fingerprint paths');
    const snapshotRoot = path.join(root, 'inputs', 'candidate-snapshot');
    const snapshotFiles = walk(snapshotRoot).map(filePath =>
        path.relative(snapshotRoot, filePath).replace(/\\/g, '/')
    );
    exactSet(snapshotFiles, EXPECTED_CANDIDATE_SNAPSHOT_PATHS,
        'Candidate snapshot file set');
    for (const [relativePath, digest] of Object.entries(environment.candidate_source_sha256)) {
        assert(/^[0-9a-f]{64}$/.test(digest), `Invalid candidate source digest: ${relativePath}`);
        const snapshotPath = resolveListedFile(
            root,
            listedPaths,
            `inputs/candidate-snapshot/${relativePath}`,
            `Candidate source snapshot ${relativePath}`
        );
        assert(sha256File(snapshotPath) === digest,
            `Candidate source snapshot mismatch: ${relativePath}`);
    }
    assert(environment.package_lock_sha256 ===
        environment.candidate_source_sha256['package-lock.json'],
        'Package-lock fingerprint mismatch');
    assert(environment.reference_source_sha256 ===
        environment.candidate_source_sha256['src/constants/referenceGeometries/index.js'],
        'Reference-source fingerprint mismatch');
    const finalShapeHashText = fs.readFileSync(resolveListedFile(
        root,
        listedPaths,
        'oracle/metadata/shape-sha256-final.stdout.txt',
        'Final SHAPE digest stdout'
    ), 'utf8');
    assert(finalShapeHashText.startsWith(`${EXPECTED_SHAPE_HASH} `),
        'Final SHAPE fingerprint check is missing or inconsistent');
    assert(fs.readFileSync(resolveListedFile(
        root,
        listedPaths,
        'oracle/metadata/shape-sha256-final.exit-code.txt',
        'Final SHAPE digest exit code'
    ), 'utf8') === '0\n', 'Final SHAPE fingerprint command failed');
    const runState = readJson(resolveListedFile(root, listedPaths, 'run-state.json', 'Run state'));
    assert(runState.status === 'complete' && runState.stage === 'complete', 'Run state is not complete');
    assert(manifest.campaign_gate_status === reportState.campaignGateStatus,
        'Manifest campaign status mismatch');

    const expectedCounts = manifest.expected_counts;
    const observedCounts = manifest.observed_counts;
    const canonicalCounts = {
        reference_geometries: 87,
        retained_fixture_cases: 11,
        ideal_reference_cases: 87,
        total_cases: 98,
        matched_target_evaluations_per_program: 952,
        qshape_raw_rows_with_repetitions: 1904,
        shape_raw_rows_with_repetitions: 1904,
        shape_batches: 15,
        shape_runs_with_repetitions: 30
    };
    for (const [field, value] of Object.entries(canonicalCounts)) {
        assert(expectedCounts[field] === value && observedCounts[field] === value,
            `Manifest count mismatch for ${field}`);
    }
    assert(observedCounts.failures === events.length, 'Manifest failure count mismatch');

    warnings.sort();
    return {
        schema_version: 1,
        verifier: 'verify-direct-parity.cjs',
        verification_status: 'valid',
        manifest_sha256: manifestSha256,
        package_status: 'complete',
        campaign_gate_status: reportState.campaignGateStatus,
        overall_validation_status: 'incomplete',
        verified_counts: {
            references: 87,
            cases: 98,
            matched_target_evaluations_per_program: 952,
            qshape_rows_with_repetitions: 1904,
            shape_rows_with_repetitions: 1904,
            shape_batches: 15,
            shape_runs: 30,
            gate_failures: events.length
        },
        warnings
    };
}

function cli(argv) {
    if (argv.length !== 1 || argv[0] === '--help' || argv[0] === '-h') {
        process.stdout.write('Usage: node validation/scripts/verify-direct-parity.cjs <package-directory>\n');
        process.exitCode = argv.length === 1 ? 0 : 64;
        return;
    }
    try {
        const receipt = verifyPackage(argv[0]);
        process.stdout.write(`${JSON.stringify(receipt)}\n`);
        process.exitCode = receipt.campaign_gate_status === 'pass' ? 0 : 2;
    } catch (error) {
        if (error instanceof VerificationError) {
            process.stdout.write(`${JSON.stringify({
                schema_version: 1,
                verifier: 'verify-direct-parity.cjs',
                verification_status: 'invalid',
                error: error.message
            })}\n`);
            process.exitCode = 3;
        } else {
            process.stdout.write(`${JSON.stringify({
                schema_version: 1,
                verifier: 'verify-direct-parity.cjs',
                verification_status: 'internal_error',
                error: error.message
            })}\n`);
            process.exitCode = 70;
        }
    }
}

if (require.main === module) cli(process.argv.slice(2));

module.exports = {
    VerificationError,
    absoluteDecimal,
    canonicalBinary64Token,
    compareDecimals,
    decimalToFixedHalfUp,
    exactDecimalEqual,
    float64Hex,
    parseCsv,
    parseDecimal,
    parseShapeDat,
    parseShapeOut,
    parseShapeTab,
    subtractDecimals,
    verifyPackage
};
