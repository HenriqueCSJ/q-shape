#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const CRITICAL_GATES = Object.freeze({
    'src/services/algorithms/kabsch.js': Object.freeze({
        branches: 95,
        functions: 100,
        lines: 95,
        statements: 95
    }),
    'src/services/shapeAnalysis/shapeCalculator.js': Object.freeze({
        branches: 90,
        functions: 100,
        lines: 95,
        statements: 95
    })
});

function normalizePath(value) {
    return String(value).replace(/\\/g, '/');
}

function findCoverageEntry(summary, sourcePath) {
    const suffix = `/${normalizePath(sourcePath)}`;
    const matches = Object.entries(summary).filter(([key]) =>
        key !== 'total' && normalizePath(key).endsWith(suffix)
    );
    if (matches.length !== 1) {
        throw new Error(
            `Expected exactly one coverage entry for ${sourcePath}; found ${matches.length}`
        );
    }
    return matches[0][1];
}

function checkCriticalCoverage(summary, gates = CRITICAL_GATES) {
    const failures = [];
    const observed = {};

    for (const [sourcePath, thresholds] of Object.entries(gates)) {
        const entry = findCoverageEntry(summary, sourcePath);
        observed[sourcePath] = {};
        for (const [metric, threshold] of Object.entries(thresholds)) {
            const percentage = entry?.[metric]?.pct;
            if (typeof percentage !== 'number' || !Number.isFinite(percentage)) {
                throw new Error(`Missing finite ${metric} coverage for ${sourcePath}`);
            }
            observed[sourcePath][metric] = percentage;
            if (percentage < threshold) {
                failures.push({ sourcePath, metric, percentage, threshold });
            }
        }
    }

    return { observed, failures };
}

function main(argv) {
    if (argv.length !== 1) {
        process.stderr.write(
            'Usage: node scripts/check-critical-coverage.cjs <coverage-summary.json>\n'
        );
        return 64;
    }

    const summaryPath = path.resolve(argv[0]);
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const result = checkCriticalCoverage(summary);

    for (const [sourcePath, metrics] of Object.entries(result.observed)) {
        process.stdout.write(
            `${sourcePath}: ` +
            Object.entries(metrics).map(([metric, value]) => `${metric}=${value}%`).join(', ') +
            '\n'
        );
    }

    if (result.failures.length > 0) {
        for (const failure of result.failures) {
            process.stderr.write(
                `${failure.sourcePath} ${failure.metric}: ${failure.percentage}% < ${failure.threshold}%\n`
            );
        }
        return 1;
    }

    process.stdout.write('Critical numerical-kernel coverage gates passed.\n');
    return 0;
}

if (require.main === module) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (error) {
        process.stderr.write(`Coverage gate failed: ${error.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = {
    CRITICAL_GATES,
    checkCriticalCoverage,
    findCoverageEntry,
    normalizePath
};
