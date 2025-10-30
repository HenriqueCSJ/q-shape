#!/bin/bash

echo "================================================================================"
echo "Q-SHAPE ENHANCED INTENSIVE ANALYSIS - COMPLETE TEST SUITE"
echo "================================================================================"
echo ""

# Counter for passed/failed tests
PASSED=0
FAILED=0

# Function to run test
run_test() {
    local test_file=$1
    local test_name=$2

    echo ""
    echo "Running: $test_name"
    echo "--------------------------------------------------------------------------------"

    if node "$test_file"; then
        ((PASSED++))
        echo "✅ $test_name: PASSED"
    else
        ((FAILED++))
        echo "❌ $test_name: FAILED"
    fi

    echo ""
}

# Run all tests
run_test "tests/test-ring-detection.js" "Ring Detection Unit Tests"
run_test "tests/test-metal-detection.js" "Metal Detection Tests"
run_test "tests/test-ferrocene.js" "Ferrocene Intensive Analysis"
run_test "tests/test-normal-complexes.js" "Normal Coordination Complexes (False Positive Prevention)"

# Summary
echo ""
echo "================================================================================"
echo "TEST SUITE SUMMARY"
echo "================================================================================"
echo ""
echo "Tests Passed: $PASSED"
echo "Tests Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED!"
    echo ""
    echo "The Enhanced Intensive Analysis system is fully validated:"
    echo "  ✅ Metal detection (H atoms excluded)"
    echo "  ✅ Ring detection (planarity, bonds, centroids)"
    echo "  ✅ Hapticity recognition (η³, η⁵-Cp, η⁶-benzene)"
    echo "  ✅ Ferrocene analysis (eclipsed & staggered)"
    echo "  ✅ No false positives on normal complexes"
    echo "  ✅ Sandwich structure detection"
    echo "  ✅ Geometric validation (180° linear)"
    echo ""
    echo "🏆 Q-Shape is ready for π-coordinated ligand analysis!"
    echo ""
    exit 0
else
    echo "⚠️  SOME TESTS FAILED"
    echo "Please review the output above for details."
    echo ""
    exit 1
fi
