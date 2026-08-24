#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
    CAMPAIGN_CASES_SHA256,
    normalizeReferenceDocument
} = require('./qshape-metamorphic-worker.cjs');

const CAMPAIGN_ID = 'qshape-metamorphic-adversarial-v1';
const DIRECT_REFERENCES_SHA256 =
    '170c444f035f4a67dc5388a03a23b27ba2ed1a96e3a1ec2e7f95c4d203f49787';
const DIRECT_PACKAGE_MANIFEST_SHA256 =
    '5ae614626fef9d60991d7c51804913e166d9b99c3163f10847a66f0b105260ca';
const EXPECTED_REFERENCE_COUNT = 87;
const EXPECTED_CASES_PER_REFERENCE = 33;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function sha256Buffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function parentKey(cn, code, index) {
    return `${cn}\u0000${code}\u0000${index}`;
}

function buildParentBindings(casesDocument) {
    assert(casesDocument?.schema_version === 1, 'cases schema_version must be 1');
    assert(casesDocument?.campaign_id === CAMPAIGN_ID, 'cases campaign_id mismatch');
    assert(casesDocument?.count === 2871, 'cases count mismatch');
    assert(Array.isArray(casesDocument.cases) && casesDocument.cases.length === casesDocument.count,
        'cases array count mismatch');

    const bindings = new Map();
    for (const item of casesDocument.cases) {
        const key = parentKey(item.cn, item.parent_reference_code, item.parent_reference_index);
        const observed = {
            cn: item.cn,
            qshape_code: item.parent_reference_code,
            qshape_index: item.parent_reference_index,
            qshape_name: item.source_name,
            qshape_point_group: item.reference_point_group,
            qshape_chirality: item.reference_chirality,
            parent_reference_fingerprint_sha256: item.parent_reference_fingerprint_sha256,
            cases: 1
        };
        assert(typeof observed.qshape_point_group === 'string' && observed.qshape_point_group.length > 0,
            `${item.case_id} lacks reference point group`);
        assert(['achiral', 'chiral'].includes(observed.qshape_chirality),
            `${item.case_id} has invalid reference chirality`);
        assert(/^[0-9a-f]{64}$/.test(observed.parent_reference_fingerprint_sha256),
            `${item.case_id} has invalid reference fingerprint`);

        if (!bindings.has(key)) {
            bindings.set(key, observed);
            continue;
        }
        const expected = bindings.get(key);
        for (const field of [
            'cn',
            'qshape_code',
            'qshape_index',
            'qshape_name',
            'qshape_point_group',
            'qshape_chirality',
            'parent_reference_fingerprint_sha256'
        ]) {
            assert(expected[field] === observed[field],
                `inconsistent ${field} for ${item.cn}/${item.parent_reference_code}`);
        }
        expected.cases += 1;
    }
    assert(bindings.size === EXPECTED_REFERENCE_COUNT, 'parent reference census is not 87');
    for (const binding of bindings.values()) {
        assert(binding.cases === EXPECTED_CASES_PER_REFERENCE,
            `${binding.qshape_code} has ${binding.cases} cases instead of 33`);
    }
    return bindings;
}

function buildMetamorphicReferenceDocument(directDocument, casesDocument, source = {}) {
    assert(directDocument?.schema_version === 2, 'direct references schema_version must be 2');
    assert(directDocument?.count === EXPECTED_REFERENCE_COUNT, 'direct reference count mismatch');
    assert(Array.isArray(directDocument.by_cn) && directDocument.by_cn.length === 11,
        'direct reference CN census mismatch');
    const bindings = buildParentBindings(casesDocument);
    const consumed = new Set();
    const output = clone(directDocument);

    output.source_cases_sha256 = source.casesSha256 || CAMPAIGN_CASES_SHA256;
    output.metamorphic_binding = {
        campaign_id: CAMPAIGN_ID,
        source_positive_cases_sha256: source.casesSha256 || CAMPAIGN_CASES_SHA256,
        source_direct_references_sha256: source.directReferencesSha256 || DIRECT_REFERENCES_SHA256,
        source_direct_package_manifest_sha256: DIRECT_PACKAGE_MANIFEST_SHA256,
        policy: 'point group, chirality, and parent fingerprint copied from the frozen 33-case parent binding; coordinates and code/index map retained byte-semantically from the certified direct-parity inventory'
    };
    output.by_cn = output.by_cn.map(group => ({
        ...group,
        references: group.references.map(reference => {
            const key = parentKey(group.cn, reference.qshape_code, reference.qshape_index);
            const binding = bindings.get(key);
            assert(binding, `missing frozen parent binding for CN${group.cn}/${reference.qshape_code}`);
            assert(reference.qshape_name === binding.qshape_name,
                `reference name mismatch for CN${group.cn}/${reference.qshape_code}`);
            consumed.add(key);
            return {
                ...reference,
                qshape_point_group: binding.qshape_point_group,
                qshape_chirality: binding.qshape_chirality,
                metamorphic_parent_reference_fingerprint_sha256:
                    binding.parent_reference_fingerprint_sha256
            };
        })
    }));
    assert(consumed.size === bindings.size, 'not every frozen parent binding was consumed');
    validateMetamorphicReferenceDocument(output, casesDocument);
    return output;
}

function validateMetamorphicReferenceDocument(document, casesDocument = null) {
    assert(document?.schema_version === 2, 'references schema_version must be 2');
    assert(document?.count === EXPECTED_REFERENCE_COUNT, 'references count mismatch');
    assert(document?.source_cases_sha256 === CAMPAIGN_CASES_SHA256,
        'top-level metamorphic cases hash binding mismatch');
    assert(document?.metamorphic_binding?.campaign_id === CAMPAIGN_ID,
        'metamorphic campaign binding mismatch');
    assert(document?.metamorphic_binding?.source_positive_cases_sha256 === CAMPAIGN_CASES_SHA256,
        'metamorphic cases hash binding mismatch');
    assert(document?.metamorphic_binding?.source_direct_references_sha256 === DIRECT_REFERENCES_SHA256,
        'direct references hash binding mismatch');
    assert(document?.metamorphic_binding?.source_direct_package_manifest_sha256 ===
        DIRECT_PACKAGE_MANIFEST_SHA256, 'direct manifest hash binding mismatch');

    const inventory = normalizeReferenceDocument(document);
    assert(inventory.reduce((sum, group) => sum + group.count, 0) === EXPECTED_REFERENCE_COUNT,
        'normalized reference census mismatch');
    const bindingMap = casesDocument ? buildParentBindings(casesDocument) : null;
    for (const group of document.by_cn) {
        for (const reference of group.references) {
            assert(typeof reference.qshape_point_group === 'string' && reference.qshape_point_group.length > 0,
                `${reference.qshape_code} lacks qshape_point_group`);
            assert(['achiral', 'chiral'].includes(reference.qshape_chirality),
                `${reference.qshape_code} has invalid qshape_chirality`);
            assert(/^[0-9a-f]{64}$/.test(reference.metamorphic_parent_reference_fingerprint_sha256),
                `${reference.qshape_code} has invalid metamorphic parent fingerprint`);
            if (bindingMap) {
                const expected = bindingMap.get(parentKey(group.cn, reference.qshape_code, reference.qshape_index));
                assert(expected?.qshape_point_group === reference.qshape_point_group,
                    `${reference.qshape_code} point-group binding mismatch`);
                assert(expected?.qshape_chirality === reference.qshape_chirality,
                    `${reference.qshape_code} chirality binding mismatch`);
                assert(expected?.parent_reference_fingerprint_sha256 ===
                    reference.metamorphic_parent_reference_fingerprint_sha256,
                `${reference.qshape_code} fingerprint binding mismatch`);
            }
        }
    }
    return true;
}

function parseArguments(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index];
        const value = argv[index + 1];
        if (!key?.startsWith('--') || value === undefined) return null;
        options[key.slice(2)] = value;
    }
    return options.direct && options.cases && options.output ? options : null;
}

function main(argv) {
    const options = parseArguments(argv);
    if (!options) {
        process.stderr.write('Usage: node prepare-metamorphic-references.cjs --direct <references.json> --cases <cases.json> --output <references.json>\n');
        return 64;
    }
    const directPath = path.resolve(options.direct);
    const casesPath = path.resolve(options.cases);
    const outputPath = path.resolve(options.output);
    assert(fs.statSync(directPath).isFile(), 'direct references path is not a regular file');
    assert(fs.statSync(casesPath).isFile(), 'cases path is not a regular file');
    assert(!fs.existsSync(outputPath), 'output path already exists');
    const directBytes = fs.readFileSync(directPath);
    const casesBytes = fs.readFileSync(casesPath);
    const directSha256 = sha256Buffer(directBytes);
    const casesSha256 = sha256Buffer(casesBytes);
    assert(directSha256 === DIRECT_REFERENCES_SHA256, 'certified direct references SHA-256 mismatch');
    assert(casesSha256 === CAMPAIGN_CASES_SHA256, 'frozen metamorphic cases SHA-256 mismatch');
    const document = buildMetamorphicReferenceDocument(
        JSON.parse(directBytes.toString('utf8')),
        JSON.parse(casesBytes.toString('utf8')),
        { directReferencesSha256: directSha256, casesSha256 }
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, { flag: 'wx' });
    process.stdout.write(`${sha256Buffer(fs.readFileSync(outputPath))}  ${outputPath}\n`);
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
    CAMPAIGN_ID,
    DIRECT_PACKAGE_MANIFEST_SHA256,
    DIRECT_REFERENCES_SHA256,
    buildMetamorphicReferenceDocument,
    buildParentBindings,
    main,
    sha256Buffer,
    validateMetamorphicReferenceDocument
};
