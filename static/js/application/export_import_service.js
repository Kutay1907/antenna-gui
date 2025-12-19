import { modelStore, DATASET_KEYS } from '../domain/models.js';

export class ExportImportService {
    constructor(resultsService) {
        this.resultsService = resultsService;
    }

    exportState() {
        const state = {
            version: 1,
            timestamp: new Date().toISOString(),
            datasets: {},
            optRuns: modelStore.optRuns.map(run => {
                // Ensure we export all properties including metrics
                return { ...run };
            })
        };

        // Export Datasets
        DATASET_KEYS.forEach(key => {
            const ds = modelStore.getDataset(key);
            if (ds) {
                state.datasets[key] = ds.rows;
            }
        });

        return JSON.stringify(state, null, 2);
    }

    importState(jsonString) {
        try {
            const state = JSON.parse(jsonString);

            // Basic Schema Check
            if (!state.version || !state.datasets) {
                return { success: false, error: 'Invalid JSON schema: Missing version or datasets.' };
            }

            // Restore Datasets
            DATASET_KEYS.forEach(key => {
                if (Array.isArray(state.datasets[key])) {
                    const ds = modelStore.getDataset(key);
                    ds.rows = state.datasets[key];
                }
            });

            // Restore Optimization Runs
            if (Array.isArray(state.optRuns)) {
                modelStore.optRuns = []; // Clear existing
                state.optRuns.forEach(r => {
                    const newRun = modelStore.addOptRun();
                    // Restore properties
                    newRun.id = r.id || newRun.id;
                    newRun.name = r.name || newRun.name;
                    newRun.parameters = r.parameters || newRun.parameters;
                    newRun.rawInput = r.rawInput || '';
                    newRun.parsedData = r.parsedData || [];
                    newRun.shift = r.shift || null;
                    newRun.sensitivity = r.sensitivity || null;
                    newRun.ampDelta = r.ampDelta || null;
                });
            }

            // Persist changes
            this.resultsService.saveAll(); // Save datasets

            // Persist Opt runs? Requirements say no peristence for opt yet in Stage 06, 
            // but for Stage 09 import, we effectively load them into memory.

            return { success: true };
        } catch (e) {
            console.error(e);
            return { success: false, error: 'JSON Parse Error: ' + e.message };
        }
    }

    downloadJSON(filename = 'antenna_gui_state.json') {
        const json = this.exportState();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
