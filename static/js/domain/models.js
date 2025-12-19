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

export class OptRun {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.parameters = {
            substrate: 'Felt',
            ring_count: 1,
            h: 0,
            g1: 0, g2: 0, g3: 0,
            w1: 0, w2: 0, w3: 0, ws: 0,
            l1: 0, l2: 0, l3: 0, l4: 0, l5: 0, l6: 0, lf: 0, ls: 0,
            bheight: 0, bthick: 0
        };
    }
}

class ModelStore {
    constructor() {
        this.datasets = {};
        this.optRuns = [];
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

    addOptRun() {
        const id = Date.now().toString();
        const name = `Run ${this.optRuns.length + 1}`;
        const run = new OptRun(id, name);
        this.optRuns.push(run);
        return run;
    }

    deleteOptRun(id) {
        this.optRuns = this.optRuns.filter(r => r.id !== id);
    }

    getOptRun(id) {
        return this.optRuns.find(r => r.id === id);
    }
}

// Singleton instance
export const modelStore = new ModelStore();
