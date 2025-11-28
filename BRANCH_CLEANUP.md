# Branch Cleanup Analysis

**Analysis Date:** 2025-11-28
**Current Active Branch:** `claude/cleanup-branches-0143yQmy8yCxRji92Vs19ZXG`

## Summary

Found **18 branches** that should be cleaned up:
- **7 merged branches** (already in main)
- **11 stale unmerged branches** (3+ weeks old, likely abandoned)

## Branches to Delete

### Merged Branches (Safe to Delete)

These branches have been merged into main and are no longer needed:

| Branch | Last Updated | Status |
|--------|-------------|--------|
| `claude/add-version-stamp-011CUUdaB49bzbLAjqPrtfh2` | 2025-10-27 | Merged |
| `claude/analyze-shape-results-011CUaoSXonnGdBxc9vMePHU` | 2025-10-30 | Merged |
| `claude/develop-011CUon8dXWqZa1r6CuwxuuL` | 2025-11-18 | Merged |
| `claude/fix-ferrocene-analysis-failure-011CUon8dXWqZa1r6CuwxuuL` | 2025-11-05 | Merged |
| `claude/review-dev-branch-01AxCYFQSqjATmBDFFhS2TRP` | 2025-11-26 | Merged |
| `revert-35-claude/fix-blank-page-011CUcdAsz8QBJaFgJRque2j` | 2025-10-31 | Merged |
| `revert-36-claude/fix-blank-page-011CUcdAsz8QBJaFgJRque2j` | 2025-10-31 | Merged |

### Stale Unmerged Branches

These branches were not merged and are over 3 weeks old (likely abandoned):

| Branch | Last Updated | Age (days) |
|--------|-------------|-----------|
| `claude/critical-infinite-loop-fix-011CUUdaB49bzbLAjqPrtfh2` | 2025-10-25 | 34 |
| `claude/fix-auto-search-issues-011CUUdaB49bzbLAjqPrtfh2` | 2025-10-25 | 34 |
| `claude/fix-blank-page-011CUcdAsz8QBJaFgJRque2j` | 2025-11-03 | 25 |
| `claude/fix-build-errors-011CUNRaba8DGe6Yiig1EyFf` | 2025-10-22 | 37 |
| `claude/fix-ferrocene-analysis-failure-011CUokukaw85UJdJmjfTX6S` | 2025-11-05 | 23 |
| `claude/fix-html-layout-011CUSjAgN3VP7DqLHYs58PS` | 2025-10-25 | 34 |
| `claude/fix-responsive-layout-011CUSjAgN3VP7DqLHYs58PS` | 2025-10-25 | 34 |
| `claude/improve-geometry-detection-011CUcdAsz8QBJaFgJRque2j` | 2025-11-04 | 24 |
| `claude/prepare-deployment-011CUNRaba8DGe6Yiig1EyFf` | 2025-10-22 | 37 |
| `claude/refactor-phase1-011CUSjAgN3VP7DqLHYs58PS` | 2025-10-25 | 34 |
| `claude/update-readme-011CUSjAgN3VP7DqLHYs58PS` | 2025-10-25 | 34 |

## Branches to Keep

Only **2 branches** should remain:
- `main` - The main development branch
- `claude/cleanup-branches-0143yQmy8yCxRji92Vs19ZXG` - Current active branch

## How to Clean Up

### Option 1: Run the automated script

```bash
./cleanup-branches.sh
```

This will prompt for confirmation before deleting any branches.

### Option 2: Manual cleanup

Delete merged branches:
```bash
git push origin --delete claude/add-version-stamp-011CUUdaB49bzbLAjqPrtfh2
git push origin --delete claude/analyze-shape-results-011CUaoSXonnGdBxc9vMePHU
git push origin --delete claude/develop-011CUon8dXWqZa1r6CuwxuuL
git push origin --delete claude/fix-ferrocene-analysis-failure-011CUon8dXWqZa1r6CuwxuuL
git push origin --delete claude/review-dev-branch-01AxCYFQSqjATmBDFFhS2TRP
git push origin --delete revert-35-claude/fix-blank-page-011CUcdAsz8QBJaFgJRque2j
git push origin --delete revert-36-claude/fix-blank-page-011CUcdAsz8QBJaFgJRque2j
```

Delete stale branches:
```bash
git push origin --delete claude/critical-infinite-loop-fix-011CUUdaB49bzbLAjqPrtfh2
git push origin --delete claude/fix-auto-search-issues-011CUUdaB49bzbLAjqPrtfh2
git push origin --delete claude/fix-blank-page-011CUcdAsz8QBJaFgJRque2j
git push origin --delete claude/fix-build-errors-011CUNRaba8DGe6Yiig1EyFf
git push origin --delete claude/fix-ferrocene-analysis-failure-011CUokukaw85UJdJmjfTX6S
git push origin --delete claude/fix-html-layout-011CUSjAgN3VP7DqLHYs58PS
git push origin --delete claude/fix-responsive-layout-011CUSjAgN3VP7DqLHYs58PS
git push origin --delete claude/improve-geometry-detection-011CUcdAsz8QBJaFgJRque2j
git push origin --delete claude/prepare-deployment-011CUNRaba8DGe6Yiig1EyFf
git push origin --delete claude/refactor-phase1-011CUSjAgN3VP7DqLHYs58PS
git push origin --delete claude/update-readme-011CUSjAgN3VP7DqLHYs58PS
```

## Verification

After cleanup, verify with:
```bash
git branch -r
```

You should only see:
- `origin/main`
- `origin/claude/cleanup-branches-0143yQmy8yCxRji92Vs19ZXG` (current branch)
