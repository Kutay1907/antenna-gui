import { modelStore } from '../domain/models.js';
import { InputParser } from '../domain/parser.js';

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
