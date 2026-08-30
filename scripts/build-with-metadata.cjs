'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');

const readGitSha = () => {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: repositoryRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch {
        return '';
    }
};

process.env.REACT_APP_BUILD_DATE = process.env.REACT_APP_BUILD_DATE || new Date().toISOString();
process.env.REACT_APP_GIT_SHA = process.env.REACT_APP_GIT_SHA || readGitSha();

console.log(`Q-Shape build timestamp: ${process.env.REACT_APP_BUILD_DATE}`);
console.log(`Q-Shape source revision: ${process.env.REACT_APP_GIT_SHA || 'unavailable'}`);

require('react-scripts/scripts/build');
