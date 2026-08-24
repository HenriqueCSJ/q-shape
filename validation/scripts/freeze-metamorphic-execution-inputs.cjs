#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
    buildMetamorphicReferenceDocument,
    DIRECT_REFERENCES_SHA256
} = require('./prepare-metamorphic-references.cjs');
const {
    POSITIVE_CASES_SHA256,
    buildMalformedControlDocument,
    validateMalformedControlDocument
} = require('./metamorphic-malformed-controls.cjs');

const CAMPAIGN_ID = 'qshape-metamorphic-adversarial-v1';
const EXECUTION_INPUT_CAMPAIGN_ID = 'qshape-metamorphic-execution-inputs-v1';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
    }
    return value;
}

function jsonBytes(value) {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildExecutionInputBundle(directBytes, casesBytes, sourceCommit) {
    assert(Buffer.isBuffer(directBytes), 'direct references must be supplied as bytes');
    assert(Buffer.isBuffer(casesBytes), 'positive cases must be supplied as bytes');
    assert(/^[0-9a-f]{40}$/.test(sourceCommit), 'source commit must be 40 lowercase hexadecimal characters');
    const directSha256 = sha256(directBytes);
    const casesSha256 = sha256(casesBytes);
    assert(directSha256 === DIRECT_REFERENCES_SHA256, 'certified direct references SHA-256 mismatch');
    assert(casesSha256 === POSITIVE_CASES_SHA256, 'frozen positive cases SHA-256 mismatch');

    const direct = JSON.parse(directBytes.toString('utf8'));
    const cases = JSON.parse(casesBytes.toString('utf8'));
    assert(cases.campaign_id === CAMPAIGN_ID, 'positive campaign ID mismatch');
    const references = buildMetamorphicReferenceDocument(direct, cases, {
        directReferencesSha256: directSha256,
        casesSha256
    });
    const malformedControls = buildMalformedControlDocument(cases, casesSha256);
    validateMalformedControlDocument(malformedControls);

    const referenceBytes = jsonBytes(references);
    const malformedBytes = jsonBytes(malformedControls);
    const expectedNumericRowsByControl = Object.fromEntries(
        malformedControls.controls.map(control => [control.control_id, control.expected_numeric_rows])
    );
    const contentContract = {
        schema_version: 1,
        campaign_id: EXECUTION_INPUT_CAMPAIGN_ID,
        source_commit: sourceCommit,
        positive_cases: {
            campaign_id: CAMPAIGN_ID,
            sha256: casesSha256,
            count: cases.count,
            matched_target_evaluations_per_program:
                cases.expected_matched_target_evaluations_per_program
        },
        references: {
            sha256: sha256(referenceBytes),
            count: references.count,
            source_direct_references_sha256: directSha256
        },
        malformed_controls: {
            campaign_id: malformedControls.campaign_id,
            sha256: sha256(malformedBytes),
            count: malformedControls.count,
            expected_numeric_rows_contract: 'per-control',
            expected_numeric_rows_by_control: expectedNumericRowsByControl,
            expected_numeric_rows_total: Object.values(expectedNumericRowsByControl)
                .reduce((sum, value) => sum + value, 0)
        }
    };
    const bundleSha256 = sha256(Buffer.from(JSON.stringify(stable(contentContract)), 'utf8'));
    const receipt = {
        ...contentContract,
        status: 'preregistered_execution_inputs',
        positive_execution_started: false,
        output_policy: 'input-only directory; numerical outputs are forbidden',
        bundle_sha256: bundleSha256,
        files: {
            references: 'references.json',
            malformed_controls: 'malformed-controls.json',
            status: 'STATUS.md'
        }
    };
    const status = [
        '# Q-Shape metamorphic execution inputs',
        '',
        '- Status: preregistered input only.',
        '- Positive numerical execution started: no.',
        `- Source commit: \`${sourceCommit}\`.`,
        `- Positive cases SHA-256: \`${casesSha256}\`.`,
        `- Enhanced references SHA-256: \`${contentContract.references.sha256}\`.`,
        `- Malformed controls SHA-256: \`${contentContract.malformed_controls.sha256}\`.`,
        `- Bundle SHA-256: \`${bundleSha256}\`.`,
        '- This directory must never receive SHAPE, Q-Shape, report, log, or verification outputs.',
        ''
    ].join('\n');
    return {
        bundleSha256,
        references,
        malformedControls,
        receipt,
        files: {
            'references.json': referenceBytes,
            'malformed-controls.json': malformedBytes,
            'receipt.json': jsonBytes(receipt),
            'STATUS.md': Buffer.from(status, 'utf8')
        }
    };
}

function writeExecutionInputBundle(outputDirectory, bundle) {
    const output = path.resolve(outputDirectory);
    assert(!fs.existsSync(output), `output directory already exists: ${output}`);
    fs.mkdirSync(output, { recursive: false });
    for (const [fileName, bytes] of Object.entries(bundle.files)) {
        fs.writeFileSync(path.join(output, fileName), bytes, { flag: 'wx' });
    }
    return output;
}

function parseArguments(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index];
        const value = argv[index + 1];
        if (!key?.startsWith('--') || value === undefined) return null;
        const name = key.slice(2);
        options[name === 'source-commit' ? 'sourceCommit' : name] = value;
    }
    return options.direct && options.cases && options.output && options.sourceCommit
        ? options : null;
}

function main(argv) {
    const options = parseArguments(argv);
    if (!options) {
        process.stderr.write('Usage: node freeze-metamorphic-execution-inputs.cjs --direct <references.json> --cases <cases.json> --source-commit <40-hex> --output <new-directory>\n');
        return 64;
    }
    const bundle = buildExecutionInputBundle(
        fs.readFileSync(path.resolve(options.direct)),
        fs.readFileSync(path.resolve(options.cases)),
        options.sourceCommit
    );
    const output = writeExecutionInputBundle(options.output, bundle);
    process.stdout.write(`${bundle.bundleSha256}  ${output}\n`);
    return 0;
}

if (require.main === module) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 3;
    }
}

module.exports = {
    EXECUTION_INPUT_CAMPAIGN_ID,
    buildExecutionInputBundle,
    main,
    sha256,
    writeExecutionInputBundle
};
