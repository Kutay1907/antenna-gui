/**
 * Parses raw text input into structured frequency/amplitude data
 * and maps it to glucose levels.
 */
export class InputParser {

    /**
     * Parses the input string.
     * Expected format: "Freq Amp", "Freq, Amp", "(Freq, Amp)", etc.
     * @param {string} text - Multiline input text.
     * @returns {Array} Array of { glucose, freq, amp } objects.
     * @throws {Error} If parsing fails.
     */
    static parse(text) {
        if (!text || text.trim() === '') {
            return [];
        }

        const lines = text.trim().split('\n');
        const parsedRows = [];

        lines.forEach((line, index) => {
            const cleanLine = line.trim();
            if (cleanLine === '') return;

            // Remove parens and split by comma or space
            const parts = cleanLine.replace(/[()]/g, '').split(/[\s,]+/);

            // Filter empty parts (e.g. trailing spaces)
            const values = parts.filter(p => p !== '').map(parseFloat);

            if (values.length !== 2 || isNaN(values[0]) || isNaN(values[1])) {
                throw new Error(`Line ${index + 1}: Invalid format. Expected "Freq Amp". Found: "${cleanLine}"`);
            }

            parsedRows.push({
                freq: values[0],
                amp: values[1]
            });
        });

        if (parsedRows.length === 0) return [];

        return this.mapGlucose(parsedRows);
    }

    /**
     * Maps parsed rows to glucose levels linearly (0 to 1000).
     */
    static mapGlucose(rows) {
        const N = rows.length;
        if (N === 1) {
            // Edge case: 1 row. Map to 0? Or just leave as is. Requirement says map first to 0, last to 1000.
            return [{ ...rows[0], glucose: 0 }];
        }

        return rows.map((row, i) => {
            const glucose = (1000 * i) / (N - 1);
            return {
                ...row,
                glucose: Math.round(glucose * 100) / 100
            };
        });
    }

    /**
     * Parses bulk (freq, amp) data.
     * Format: ( 7.314, -34.16548 )
     * Returns array of { freq, amp }
     */
    static parseBulkData(text) {
        const regex = /\(\s*([\d\.-]+)\s*,\s*([\d\.-]+)\s*\)/g;
        const results = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            results.push({
                freq: parseFloat(match[1]),
                amp: parseFloat(match[2])
            });
        }
        return results;
    }
}
