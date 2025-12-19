/**
 * Constants and Data Models for the application.
 */

export const DATASET_KEYS = [
    "felt_1_ring",
    "felt_2_ring",
    "felt_3_ring",
    "jeans_1_ring",
    "jeans_2_ring",
    "jeans_3_ring"
];

export const DATASET_LABELS = {
    "felt_1_ring": "Felt 1 Ring",
    "felt_2_ring": "Felt 2 Ring",
    "felt_3_ring": "Felt 3 Ring",
    "jeans_1_ring": "Jeans 1 Ring",
    "jeans_2_ring": "Jeans 2 Ring",
    "jeans_3_ring": "Jeans 3 Ring"
};

export class DatasetResult {
    constructor(id) {
        this.id = id;
        this.rows = []; // Array of objects
    }

    addRow() {
        this.rows.push({
            glucose: 0,
            s11_freq: 0,
            s11_amp: 0,
            s21_freq: 0,
            s21_amp: 0
        });
    }

    deleteRow(index) {
        if (index >= 0 && index < this.rows.length) {
            this.rows.splice(index, 1);
        }
    }

    updateRow(index, field, value) {
        if (index >= 0 && index < this.rows.length) {
            this.rows[index][field] = parseFloat(value) || 0;
        }
    }
}

class ModelStore {
    constructor() {
        this.datasets = {};
        this.init();
    }

    init() {
        DATASET_KEYS.forEach(key => {
            this.datasets[key] = new DatasetResult(key);
        });
    }

    getDataset(key) {
        return this.datasets[key];
    }
}

// Singleton instance
export const modelStore = new ModelStore();
