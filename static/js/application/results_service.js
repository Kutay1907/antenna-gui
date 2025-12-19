import { modelStore, DATASET_KEYS } from '../domain/models.js';
import { supabase } from '../infrastructure/supabase_client.js';

export class ResultsService {
    constructor(storageRepo) {
        this.storage = storageRepo; // Keep for fallback
        this.STORAGE_KEY = 'results_data';
    }

    /**
     * Loads all datasets from Supabase into the modelStore.
     */
    async loadAll() {
        try {
            const { data, error } = await supabase
                .from('results')
                .select('*')
                .order('glucose', { ascending: true });

            if (error) {
                console.error('Supabase load error:', error);
                // Fallback to localStorage
                this.loadFromLocalStorage();
                return;
            }

            if (data && data.length > 0) {
                // Group by dataset_key
                DATASET_KEYS.forEach(key => {
                    const dataset = modelStore.getDataset(key);
                    const rows = data.filter(r => r.dataset_key === key);
                    if (rows.length > 0) {
                        dataset.rows = rows.map(r => ({
                            id: r.id,
                            glucose: r.glucose,
                            s11_freq: r.s11_freq || 0,
                            s11_amp: r.s11_amp || 0,
                            s21_freq: r.s21_freq || 0,
                            s21_amp: r.s21_amp || 0
                        }));
                    }
                });
            }
        } catch (err) {
            console.error('Failed to load from Supabase:', err);
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        const data = this.storage.load(this.STORAGE_KEY);
        if (data) {
            DATASET_KEYS.forEach(key => {
                const dataset = modelStore.getDataset(key);
                if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
                    dataset.rows = data[key];
                }
            });
        }
    }

    /**
     * Saves all datasets to Supabase.
     */
    async saveAll() {
        try {
            // Prepare all rows for insert (without id, let Supabase generate)
            const allRows = [];
            DATASET_KEYS.forEach(key => {
                const dataset = modelStore.getDataset(key);
                dataset.rows.forEach(row => {
                    allRows.push({
                        dataset_key: key,
                        glucose: row.glucose,
                        s11_freq: row.s11_freq || 0,
                        s11_amp: row.s11_amp || 0,
                        s21_freq: row.s21_freq || 0,
                        s21_amp: row.s21_amp || 0
                    });
                });
            });

            // Delete all existing rows first
            const { error: deleteError } = await supabase
                .from('results')
                .delete()
                .gte('glucose', 0); // This matches all rows

            if (deleteError) {
                console.error('Supabase delete error:', deleteError);
            }

            // Insert all rows
            if (allRows.length > 0) {
                const { data, error } = await supabase.from('results').insert(allRows);
                if (error) {
                    console.error('Supabase insert error:', error);
                    alert('Failed to save to database: ' + error.message);
                } else {
                    console.log('Saved to Supabase:', allRows.length, 'rows');
                }
            }
        } catch (err) {
            console.error('Failed to save to Supabase:', err);
            alert('Failed to save: ' + err.message);
        }

        // Also save to localStorage as backup
        const data = {};
        DATASET_KEYS.forEach(key => {
            const dataset = modelStore.getDataset(key);
            data[key] = dataset.rows;
        });
        this.storage.save(this.STORAGE_KEY, data);
    }

    /**
     * Resets all datasets to default rows.
     */
    async clearAllData() {
        // Delete from Supabase
        try {
            const { error } = await supabase.from('results').delete().gte('glucose', 0);
            if (error) {
                console.error('Failed to clear Supabase:', error);
            }
        } catch (err) {
            console.error('Failed to clear Supabase:', err);
        }

        // Reinitialize all datasets with fresh defaults
        DATASET_KEYS.forEach(key => {
            const dataset = modelStore.getDataset(key);
            dataset.rows = [0, 72, 216, 330, 500, 600, 1000].map(g => ({
                glucose: g,
                s11_freq: 0, s11_amp: 0,
                s21_freq: 0, s21_amp: 0
            }));
        });
        await this.saveAll();
    }
}
