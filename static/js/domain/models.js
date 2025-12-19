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
        this.rows = [
            0, 72, 216, 330, 500, 600, 1000
        ].map(g => ({
            glucose: g,
            freq: 0,
            s11: 0,
            s21: 0
        }));
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
            substrate: 'Felt', // Default
            ring_count: 2,
            h: 1,      // User Req
            t: 0.035,  // User Req
            g1: 6, g2: 8, g3: 3,
            w1: 3.57, w2: 3, w3: 3, ws: 50,
            l1: 40, l2: 40, l3: 30, l4: 30, l5: 20, l6: 20,
            lf: 40, ls: 98,
            bheight: 3, bthick: 0.5
        };
        this.rawInput = '';
        this.parsedData = []; // Array of { glucose, freq, amp }

        // Metrics
        this.shift = null;       // Total Shift (0-1000)
        this.sensitivity = null; // MHz/mg/dL
        this.ampDelta = null;    // dB
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

// Init Default Runs if empty
if (modelStore.optRuns.length === 0) {
    const jeans = modelStore.addOptRun();
    jeans.name = 'Jeans Config';
    jeans.parameters.substrate = 'Jeans';
    jeans.parameters.w1 = 4.28;

    const felt = modelStore.addOptRun();
    felt.name = 'Felt Config';
    felt.parameters.substrate = 'Felt';
    felt.parameters.w1 = 4.28;
}
