import { modelStore } from '../domain/models.js';
import { InputParser } from '../domain/parser.js';
import { MetricsCalculator } from '../domain/metrics.js';

export class OptimizationService {
    constructor() {
        // No state needed, operates on store
    }

    /**
     * Parses the input for a specific run and updates the store.
     * @param {string} runId 
     * @returns {Object} { success: boolean, error: string }
     */
    parseAndSave(runId) {
        const run = modelStore.getOptRun(runId);
        if (!run) return { success: false, error: 'Run not found' };

        try {
            const results = InputParser.parse(run.rawInput);
            run.parsedData = results;

            // Compute Metrics
            // For parser data, fields are 'freq' and 'amp'. Start=0, End=1000.
            if (results.length > 0) {
                const shift = MetricsCalculator.calculateShift(results, 'freq', 0, 1000);
                const sens = MetricsCalculator.calculateSensitivity(shift, 1000);
                const ampDelta = MetricsCalculator.calculateAmplitudeDelta(results, 'amp', 0, 1000);

                run.shift = shift;
                run.sensitivity = sens;
                run.ampDelta = ampDelta;
            } else {
                run.shift = null;
                run.sensitivity = null;
                run.ampDelta = null;
            }

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    updateRawInput(runId, text) {
        const run = modelStore.getOptRun(runId);
        if (run) {
            run.rawInput = text;
        }
    }

    clearData(runId) {
        const run = modelStore.getOptRun(runId);
        if (run) {
            run.parsedData = [];
            run.rawInput = '';
        }
    }
}
