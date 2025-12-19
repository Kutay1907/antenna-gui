import { modelStore, DATASET_KEYS, DATASET_LABELS } from '../domain/models.js';
import { MetricsCalculator } from '../domain/metrics.js';
import { ChartsView } from './charts_view.js';
import { InputParser } from '../domain/parser.js';
import { Validators } from '../domain/validators.js';

export class ResultsView {
    constructor(resultsService) {
        this.resultsService = resultsService;
        this.currentDatasetKey = DATASET_KEYS[0]; // Default to first
        this.subTabsContainer = document.querySelector('.sub-tabs');
        this.tableBody = document.querySelector('#results-table-body');
        this.metricsContainer = document.querySelector('.metrics-container'); // Need to add this to HTML first
        this.selectedDatasetTitle = document.getElementById('selected-dataset-title');

        this.chartsView = new ChartsView();

        this.init();
    }

    init() {
        this.renderSubTabs();
        this.bindEvents();
        this.renderTable();
    }

    bindEvents() {
        // Sub-tab switching
        if (this.subTabsContainer) {
            this.subTabsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.sub-tab-button');
                if (btn) {
                    const key = btn.getAttribute('data-key');
                    this.switchDataset(key);
                }
            });
        }

        // Add Row
        const addBtn = document.getElementById('add-row-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addRow());
        }

        // Table actions (delegation)
        if (this.tableBody) {
            this.tableBody.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    this.deleteRow(idx);
                }
            });

            this.tableBody.addEventListener('input', (e) => {
                const input = e.target;
                if (input.tagName === 'INPUT') {
                    const idx = parseInt(input.getAttribute('data-index'));
                    const field = input.getAttribute('data-field');
                    this.updateRow(idx, field, input.value);
                }
            });
        }

        // Clear Data (Reinitialize with default rows)
        const clearBtn = document.getElementById('clear-data-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all results data? The 7 glucose rows will be reset to zero.')) {
                    // Reinitialize all datasets with default rows
                    modelStore.init();
                    this.resultsService.saveAll();
                    this.renderTable();
                }
            });
        }
    }

    renderSubTabs() {
        if (!this.subTabsContainer) return;

        let html = '';
        DATASET_KEYS.forEach(key => {
            const active = key === this.currentDatasetKey ? 'active' : '';
            html += `<button class="sub-tab-button ${active}" data-key="${key}">${DATASET_LABELS[key]}</button>`;
        });
        this.subTabsContainer.innerHTML = html;
    }

    switchDataset(key) {
        if (modelStore.getDataset(key)) {
            this.currentDatasetKey = key;
            this.renderSubTabs();
            this.renderTable();
        }
    }

    renderTable() {
        const dataset = modelStore.getDataset(this.currentDatasetKey);
        if (!dataset) return;

        // Update Title
        if (this.selectedDatasetTitle) {
            this.selectedDatasetTitle.textContent = DATASET_LABELS[this.currentDatasetKey];
        }

        // Bulk Parser UI
        const parserHtml = `
            <div class="form-section">
                <h4>Bulk Data Import (Paste S-Parameter Data)</h4>
                <div style="display: flex; gap: 16px; align-items: start;">
                    <textarea id="bulk-paste-area" placeholder="( 7.314, -34.16548 )&#10;( 7.32, -34.18422 )&#10;..." style="width: 300px; height: 100px; font-family: monospace; padding: 8px;"></textarea>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <label><input type="radio" name="target-param" value="s11" checked> S11 (Freq, dB)</label>
                        <label><input type="radio" name="target-param" value="s21"> S21 (Freq, dB)</label>
                        <button id="apply-bulk-btn" class="action-btn small">Apply to Table</button>
                    </div>
                </div>
                <small style="color: #666;">Pastes data into rows sequentially (1st line -> 0mg, 2nd -> 72mg, etc.)</small>
            </div>
        `;

        // Render Rows (Prepend Parser)
        this.tableBody.innerHTML = '';

        // This is a bit hacky to inject the parser, but we need a container. 
        // Ideally index.html should have a container. 
        // Let's prepend it to the table container in the DOM if not exists?
        // Actually, let's just use the existing structure and maybe add a slot in index.html or just rely on the user manually handling it?
        // The user wants it "in the results section".
        // Let's try to find a place. The tableBody is inside <tbody>. checking renderTable context.
        // renderTable clears tableBody (tbody). We can't put divs in tbody.
        // We need to inject this form OUTSIDE the table.
        // Let's use a dedicated container in index.html or create one dynamically.

        this.renderBulkUI();

        dataset.rows.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
    < td ><input type="number" step="any" value="${row.glucose}" data-index="${index}" data-field="glucose"></td>
                <td><input type="number" step="any" value="${row.s11_freq}" data-index="${index}" data-field="s11_freq"></td>
                <td><input type="number" step="any" value="${row.s11_amp}" data-index="${index}" data-field="s11_amp"></td>
                <td><input type="number" step="any" value="${row.s21_freq}" data-index="${index}" data-field="s21_freq"></td>
                <td><input type="number" step="any" value="${row.s21_amp}" data-index="${index}" data-field="s21_amp"></td>
                <td><button class="delete-btn" data-index="${index}">🗑️</button></td>
`;
            this.tableBody.appendChild(tr);
        });

        this.renderMetrics(dataset.rows);
        this.chartsView.render(dataset.rows);
    }

    renderMetrics(rows) {
        if (!this.metricsContainer) return;

        // Compute Metrics
        const s11ShiftTotal = MetricsCalculator.calculateShift(rows, 's11_freq', 0, 1000);
        const s21ShiftTotal = MetricsCalculator.calculateShift(rows, 's21_freq', 0, 1000);
        const s11ShiftMid = MetricsCalculator.calculateShift(rows, 's11_freq', 72, 600);

        const s11Sensitivity = MetricsCalculator.calculateSensitivity(s11ShiftTotal, 1000); // 1000 - 0

        const s11AmpDelta = MetricsCalculator.calculateAmplitudeDelta(rows, 's11_amp', 0, 1000);
        const s21AmpDelta = MetricsCalculator.calculateAmplitudeDelta(rows, 's21_amp', 0, 1000);

        // Render Helper
        const formatVal = (val, unit, factor = 1) => val !== null ? `${(val * factor).toFixed(4)} ${unit} ` : '<span class="na">N/A</span>';

        this.metricsContainer.innerHTML = `
    < div class="metric-card" >
                <h4>Total S11 Shift (0-1000)</h4>
                <div class="metric-value">${formatVal(s11ShiftTotal, 'GHz')}</div>
            </div >
            <div class="metric-card">
                <h4>Total S21 Shift (0-1000)</h4>
                <div class="metric-value">${formatVal(s21ShiftTotal, 'GHz')}</div>
            </div>
            <div class="metric-card">
                <h4>S11 Shift (72-600)</h4>
                <div class="metric-value">${formatVal(s11ShiftMid, 'GHz')}</div>
            </div>
            <div class="metric-card">
                <h4>S11 Sensitivity (0-1000)</h4>
                <div class="metric-value">${formatVal(s11Sensitivity, 'MHz/mg/dL')}</div>
            </div>
            <div class="metric-card">
                <h4>S11 Amp Delta</h4>
                <div class="metric-value">${formatVal(s11AmpDelta, 'dB')}</div>
            </div>
            <div class="metric-card">
                <h4>S21 Amp Delta</h4>
                <div class="metric-value">${formatVal(s21AmpDelta, 'dB')}</div>
            </div>
`;
    }

    addRow() {
        const glInput = document.getElementById('new-row-glucose');
        const frInput = document.getElementById('new-row-freq');
        const s11Input = document.getElementById('new-row-s11');
        const s21Input = document.getElementById('new-row-s21');

        // Validation
        const glVal = Validators.validateGlucose(glInput.value);
        if (!glVal.valid) {
            alert(`Invalid Glucose: ${glVal.message} `);
            return;
        }

        const frVal = Validators.validateFrequency(frInput.value);
        if (!frVal.valid) {
            alert(`Invalid Frequency: ${frVal.message} `);
            return;
        }

        const s11Val = Validators.validateAmplitude(s11Input.value);
        const s21Val = Validators.validateAmplitude(s21Input.value);

        if (!s11Val.valid || !s21Val.valid) {
            alert('S-Parameters must be valid numbers');
            return;
        }

        const dataset = modelStore.getDataset(this.currentDatasetKey);
        dataset.addRow({
            glucose: parseFloat(glInput.value),
            freq: parseFloat(frInput.value),
            s11: parseFloat(s11Input.value),
            s21: parseFloat(s21Input.value)
        });

        this.resultsService.saveAll(); // Auto-save
        this.renderTable();

        // Clear inputs
        glInput.value = '';
        frInput.value = '';
        s11Input.value = '';
        s21Input.value = '';
        glInput.focus();
    }

    deleteRow(index) {
        const dataset = modelStore.getDataset(this.currentDatasetKey);
        dataset.deleteRow(index);
        this.resultsService.saveAll(); // Auto-save
        this.renderTable();
    }

    updateRow(index, field, value) {
        const dataset = modelStore.getDataset(this.currentDatasetKey);
        dataset.updateRow(index, field, value);
        this.resultsService.saveAll(); // Async, fire-and-forget
        // Re-render metrics and charts on update
        this.renderMetrics(dataset.rows);
        this.chartsView.render(dataset.rows);
    }

    renderBulkUI() {
        let container = document.getElementById('bulk-import-container');
        if (!container) {
            const tableContainer = document.querySelector('.table-container');
            if (!tableContainer) return;
            container = document.createElement('div');
            container.id = 'bulk-import-container';
            tableContainer.parentNode.insertBefore(container, tableContainer);
        }

        container.innerHTML = `
            <div class="form-section">
                <h4>Paste Data (Auto-fills Rows)</h4>
                <div style="display: flex; gap: 16px;">
                    <textarea id="bulk-paste-area" style="flex:1; height: 80px; font-family: monospace; padding: 8px;" placeholder="(7.314, -34.16548)&#10;(7.32, -34.18422)&#10;..."></textarea>
                    <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center;">
                        <label style="font-weight: normal;"><input type="radio" name="target-param" value="s11" checked> S11</label>
                        <label style="font-weight: normal;"><input type="radio" name="target-param" value="s21"> S21</label>
                        <button id="apply-bulk-btn" class="action-btn small">Apply</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('apply-bulk-btn').onclick = () => this.applyBulkData();
    }

    applyBulkData() {
        const text = document.getElementById('bulk-paste-area').value;
        const isS11 = document.querySelector('input[name="target-param"][value="s11"]').checked;
        const parsed = InputParser.parseBulkData(text);

        if (parsed.length === 0) {
            alert('No valid (freq, amp) data found.');
            return;
        }

        const dataset = modelStore.getDataset(this.currentDatasetKey);

        let count = 0;
        dataset.rows.forEach((row, i) => {
            if (i < parsed.length) {
                if (isS11) {
                    row.s11_freq = parsed[i].freq;
                    row.s11_amp = parsed[i].amp;
                } else {
                    row.s21_freq = parsed[i].freq;
                    row.s21_amp = parsed[i].amp;
                }
                count++;
            }
        });

        this.resultsService.saveAll();
        this.renderTable();
        alert(`Applied data to ${count} rows.`);
    }
}
