/**
 * Domain logic for calculating derived antenna metrics.
 */
export class MetricsCalculator {

    /**
     * Calculates the frequency shift between two glucose levels.
     * @param {Array} rows - The dataset rows.
     * @param {string} freqField - The field name for frequency (e.g., 's11_freq').
     * @param {number} startGlucose - The starting glucose level.
     * @param {number} endGlucose - The ending glucose level.
     * @returns {number|null} The shift in GHz (end - start), or null if not found.
     */
    static calculateShift(rows, freqField, startGlucose, endGlucose) {
        const startRow = this.findRow(rows, startGlucose);
        const endRow = this.findRow(rows, endGlucose);

        if (startRow && endRow) {
            return endRow[freqField] - startRow[freqField];
        }
        return null; // Not available
    }

    /**
     * Calculates the sensitivity (MHz / mg / dL).
     * @param {number} shiftGHz - The frequency shift in GHz.
     * @param {number} glucoseDelta - The difference in glucose levels (end - start).
     * @returns {number|null} Sensitivity in MHz/mg/dL.
     */
    static calculateSensitivity(shiftGHz, glucoseDelta) {
        if (shiftGHz === null || glucoseDelta === 0) return null;
        // Convert GHz to MHz (x1000)
        return (shiftGHz * 1000) / glucoseDelta;
    }

    /**
     * Calculates the amplitude delta between two glucose levels.
     * @param {Array} rows - The dataset rows.
     * @param {string} ampField - The field name for amplitude (e.g., 's11_amp').
     * @param {number} startGlucose - The starting glucose level.
     * @param {number} endGlucose - The ending glucose level.
     * @returns {number|null} The delta in dB, or null if not found.
     */
    static calculateAmplitudeDelta(rows, ampField, startGlucose, endGlucose) {
        const startRow = this.findRow(rows, startGlucose);
        const endRow = this.findRow(rows, endGlucose);

        if (startRow && endRow) {
            return endRow[ampField] - startRow[ampField];
        }
        return null;
    }

    /**
     * Helper to find a row by exact glucose match.
     */
    static findRow(rows, glucose) {
        return rows.find(r => Math.abs(r.glucose - glucose) < 0.1); // Small epsilon for float comparison
    }
}
