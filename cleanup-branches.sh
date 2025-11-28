#!/bin/bash

# Branch Cleanup Script
# This script deletes merged and stale branches from the repository
# Generated on 2025-11-28

echo "=== Q-Shape Branch Cleanup Script ==="
echo ""
echo "This will delete the following categories of branches:"
echo "1. Merged branches (already in main)"
echo "2. Stale unmerged branches (3+ weeks old)"
echo ""

# Merged branches that can be safely deleted
MERGED_BRANCHES=(
  "claude/add-version-stamp-011CUUdaB49bzbLAjqPrtfh2"
  "claude/analyze-shape-results-011CUaoSXonnGdBxc9vMePHU"
  "claude/develop-011CUon8dXWqZa1r6CuwxuuL"
  "claude/fix-ferrocene-analysis-failure-011CUon8dXWqZa1r6CuwxuuL"
  "claude/review-dev-branch-01AxCYFQSqjATmBDFFhS2TRP"
  "revert-35-claude/fix-blank-page-011CUcdAsz8QBJaFgJRque2j"
  "revert-36-claude/fix-blank-page-011CUcdAsz8QBJaFgJRque2j"
)

# Stale unmerged branches (3+ weeks old, likely abandoned)
STALE_BRANCHES=(
  "claude/critical-infinite-loop-fix-011CUUdaB49bzbLAjqPrtfh2"
  "claude/fix-auto-search-issues-011CUUdaB49bzbLAjqPrtfh2"
  "claude/fix-blank-page-011CUcdAsz8QBJaFgJRque2j"
  "claude/fix-build-errors-011CUNRaba8DGe6Yiig1EyFf"
  "claude/fix-ferrocene-analysis-failure-011CUokukaw85UJdJmjfTX6S"
  "claude/fix-html-layout-011CUSjAgN3VP7DqLHYs58PS"
  "claude/fix-responsive-layout-011CUSjAgN3VP7DqLHYs58PS"
  "claude/improve-geometry-detection-011CUcdAsz8QBJaFgJRque2j"
  "claude/prepare-deployment-011CUNRaba8DGe6Yiig1EyFf"
  "claude/refactor-phase1-011CUSjAgN3VP7DqLHYs58PS"
  "claude/update-readme-011CUSjAgN3VP7DqLHYs58PS"
)

# Function to delete branches
delete_branches() {
  local branches=("$@")
  local success_count=0
  local fail_count=0

  for branch in "${branches[@]}"; do
    echo "Deleting: $branch"
    if git push origin --delete "$branch" 2>&1; then
      ((success_count++))
      echo "✓ Deleted: $branch"
    else
      ((fail_count++))
      echo "✗ Failed to delete: $branch"
    fi
    echo ""
  done

  echo "Successfully deleted: $success_count"
  echo "Failed to delete: $fail_count"
  echo ""
}

# Confirm with user
echo "About to delete ${#MERGED_BRANCHES[@]} merged branches and ${#STALE_BRANCHES[@]} stale branches."
read -p "Do you want to proceed? (yes/no): " confirm

if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "=== Deleting Merged Branches ==="
delete_branches "${MERGED_BRANCHES[@]}"

echo "=== Deleting Stale Unmerged Branches ==="
delete_branches "${STALE_BRANCHES[@]}"

echo "=== Cleanup Complete ==="
echo "Remaining branches:"
git branch -r | grep origin/ | grep -v 'origin/main'
