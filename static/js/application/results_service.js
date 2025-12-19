import { modelStore, DATASET_KEYS } from '../domain/models.js';

export class ResultsService {
    constructor(storageRepo) {
        this.storage = storageRepo;
        this.STORAGE_KEY = 'results_data';
    }

    /**
     * Loads all datasets from storage into the modelStore.
     */
    loadAll() {
        const data = this.storage.load(this.STORAGE_KEY);
        if (data) {
            DATASET_KEYS.forEach(key => {
                const dataset = modelStore.getDataset(key);
                if (data[key] && Array.isArray(data[key])) {
                    dataset.rows = data[key];
                }
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
     * Clears all dataset rows and updates storage.
     */
    clearAllData() {
        DATASET_KEYS.forEach(key => {
            const dataset = modelStore.getDataset(key);
            dataset.rows = [];
        });
        this.saveAll();
    }
}
