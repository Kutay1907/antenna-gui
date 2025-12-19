import { modelStore } from '../domain/models.js';
import { InputParser } from '../domain/parser.js';
import { MetricsCalculator } from '../domain/metrics.js';
import { supabase } from '../infrastructure/supabase_client.js';

export class OptimizationService {
    constructor() {
        // No state needed, operates on store
    }

    /**
     * Loads all parameter sets from Supabase.
     */
    async loadAll() {
        try {
            const { data, error } = await supabase
                .from('parameters')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase load parameters error:', error);
                return;
            }

            // Clear and repopulate modelStore.optRuns
            modelStore.optRuns = [];
            if (data && data.length > 0) {
                data.forEach(row => {
                    const run = {
                        id: row.id,
                        name: row.name,
                        dataset_key: row.dataset_key,
                        parameters: {
                            substrate: row.substrate || 'Felt',
                            ring_count: row.ring_count || 2,
                            h: row.h || 1,
                            t: row.t || 0.035,
                            g1: row.g1 || 6, g2: row.g2 || 8, g3: row.g3 || 3,
                            w1: row.w1 || 3.57, w2: row.w2 || 3, w3: row.w3 || 3, ws: row.ws || 50,
                            l1: row.l1 || 40, l2: row.l2 || 40, l3: row.l3 || 30,
                            l4: row.l4 || 30, l5: row.l5 || 20, l6: row.l6 || 20,
                            lf: row.lf || 40, ls: row.ls || 98,
                            bheight: row.bheight || 3, bthick: row.bthick || 0.5
                        },
                        rawInput: '',
                        parsedData: [],
                        shift: null,
                        sensitivity: null,
                        ampDelta: null
                    };
                    modelStore.optRuns.push(run);
                });
            }
        } catch (err) {
            console.error('Failed to load parameters:', err);
        }
    }

    /**
     * Saves a parameter set to Supabase.
     */
    async saveRun(runId) {
        const run = modelStore.getOptRun(runId);
        if (!run) return;

        const p = run.parameters;
        const row = {
            id: run.id,
            name: run.name,
            dataset_key: run.dataset_key || 'felt_1ring',
            substrate: p.substrate,
            ring_count: p.ring_count,
            h: p.h, t: p.t,
            g1: p.g1, g2: p.g2, g3: p.g3,
            w1: p.w1, w2: p.w2, w3: p.w3, ws: p.ws,
            l1: p.l1, l2: p.l2, l3: p.l3, l4: p.l4, l5: p.l5, l6: p.l6,
            lf: p.lf, ls: p.ls,
            bheight: p.bheight, bthick: p.bthick
        };

        try {
            const { error } = await supabase.from('parameters').upsert(row);
            if (error) {
                console.error('Supabase save parameter error:', error);
                alert('Failed to save parameter: ' + error.message);
            } else {
                console.log('Saved parameter:', run.name);
            }
        } catch (err) {
            console.error('Failed to save parameter:', err);
        }
    }

    /**
     * Creates a new parameter set.
     */
    async addRun(name, datasetKey) {
        const id = crypto.randomUUID();
        const run = {
            id: id,
            name: name || `Config ${modelStore.optRuns.length + 1}`,
            dataset_key: datasetKey || 'felt_1ring',
            parameters: {
                substrate: 'Felt',
                ring_count: 2,
                h: 1, t: 0.035,
                g1: 6, g2: 8, g3: 3,
                w1: 3.57, w2: 3, w3: 3, ws: 50,
                l1: 40, l2: 40, l3: 30, l4: 30, l5: 20, l6: 20,
                lf: 40, ls: 98,
                bheight: 3, bthick: 0.5
            },
            rawInput: '',
            parsedData: [],
            shift: null,
            sensitivity: null,
            ampDelta: null
        };
        modelStore.optRuns.push(run);
        await this.saveRun(id);
        return run;
    }

    /**
     * Deletes a parameter set from Supabase.
     */
    async deleteRun(id) {
        try {
            const { error } = await supabase.from('parameters').delete().eq('id', id);
            if (error) {
                console.error('Failed to delete parameter:', error);
            }
            modelStore.deleteOptRun(id);
        } catch (err) {
            console.error('Failed to delete parameter:', err);
        }
    }

    /**
     * Parses the input for a specific run and updates the store.
     */
    parseAndSave(runId) {
        const run = modelStore.getOptRun(runId);
        if (!run) return { success: false, error: 'Run not found' };

        try {
            const results = InputParser.parse(run.rawInput);
            run.parsedData = results;

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
