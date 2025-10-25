/**
 * Geometry Utility Functions
 *
 * Provides geometric analysis utilities for coordination chemistry including
 * shape measure interpretation and quality assessment.
 */

/**
 * Interprets continuous shape measure (CShM) values into qualitative assessments
 *
 * Converts numerical shape measure into human-readable quality descriptions
 * with associated color coding and confidence percentages.
 *
 * Quality Scale:
 * - < 0.1: Perfect (green, 100% confidence)
 * - 0.1-0.5: Excellent (green, 95%)
 * - 0.5-1.5: Very Good (light green, 90%)
 * - 1.5-3.0: Good (yellow, 80%)
 * - 3.0-7.5: Moderate (orange, 60%)
 * - 7.5-15.0: Poor (dark orange, 30%)
 * - > 15.0: Very Poor / No Match (red, 10%)
 *
 * @param {number} value - Continuous shape measure value (typically 0-100+)
 * @returns {Object} Interpretation object containing:
 *   - text: string - Qualitative description
 *   - color: string - Hex color code for visualization
 *   - confidence: number - Confidence percentage (0-100)
 *
 * @example
 * const result1 = interpretShapeMeasure(0.05);
 * // Returns: { text: "Perfect", color: "#059669", confidence: 100 }
 *
 * const result2 = interpretShapeMeasure(2.5);
 * // Returns: { text: "Good", color: "#fbbf24", confidence: 80 }
 *
 * const result3 = interpretShapeMeasure(20);
 * // Returns: { text: "Very Poor / No Match", color: "#ef4444", confidence: 10 }
 */
export function interpretShapeMeasure(value) {
    if (!isFinite(value)) return { text: "Invalid", color: "#6b7280", confidence: 0 };
    if (value < 0.1) return { text: "Perfect", color: "#059669", confidence: 100 };
    if (value < 0.5) return { text: "Excellent", color: "#10b981", confidence: 95 };
    if (value < 1.5) return { text: "Very Good", color: "#34d399", confidence: 90 };
    if (value < 3.0) return { text: "Good", color: "#fbbf24", confidence: 80 };
    if (value < 7.5) return { text: "Moderate", color: "#f59e0b", confidence: 60 };
    if (value < 15.0) return { text: "Poor", color: "#f97316", confidence: 30 };
    return { text: "Very Poor / No Match", color: "#ef4444", confidence: 10 };
}
