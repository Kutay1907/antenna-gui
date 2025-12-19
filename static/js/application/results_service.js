import { modelStore, DATASET_KEYS, DatasetResult } from '../domain/models.js';

export class ResultsService {
    constructor(storageRepo) {
        this.storage = storageRepo;
        this.STORAGE_KEY = 'results_data';
    }

    /**
     * Loads all datasets from storage into the modelStore.
     * Only overrides if saved data has rows for that key.
     */
    loadAll() {
        const data = this.storage.load(this.STORAGE_KEY);
        if (data) {
            DATASET_KEYS.forEach(key => {
                const dataset = modelStore.getDataset(key);
                // Only apply if there's actual data with rows
                if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
                    dataset.rows = data[key];
                }
                // If no saved data or empty, keep the default rows from DatasetResult constructor
            });
        }
    }

    /**
     * Saves all datasets from the modelStore to storage.
     */
    saveAll() {
        const data = {};
        DATASET_KEYS.forEach(key => {
            const dataset = modelStore.getDataset(key);
            data[key] = dataset.rows;
        });
        this.storage.save(this.STORAGE_KEY, data);
    }

    /**
     * Resets all datasets to default rows (0, 72, 216, 330, 500, 600, 1000).
     */
    clearAllData() {
        // Reinitialize all datasets with fresh defaults
        DATASET_KEYS.forEach(key => {
            const dataset = modelStore.getDataset(key);
            dataset.rows = [0, 72, 216, 330, 500, 600, 1000].map(g => ({
                glucose: g,
                s11_freq: 0, s11_amp: 0,
                s21_freq: 0, s21_amp: 0
            }));
        });
        this.saveAll();
    }
}
