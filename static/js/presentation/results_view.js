import { modelStore, DATASET_KEYS, DATASET_LABELS } from '../domain/models.js';
import { MetricsCalculator } from '../domain/metrics.js';

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
                <td><input type="number" step="any" value="${row.glucose}" data-index="${index}" data-field="glucose"></td>
                <td><input type="number" step="any" value="${row.s11_freq}" data-index="${index}" data-field="s11_freq"></td>
                <td><input type="number" step="any" value="${row.s11_amp}" data-index="${index}" data-field="s11_amp"></td>
                <td><input type="number" step="any" value="${row.s21_freq}" data-index="${index}" data-field="s21_freq"></td>
                <td><input type="number" step="any" value="${row.s21_amp}" data-index="${index}" data-field="s21_amp"></td>
                <td><button class="delete-btn" data-index="${index}">🗑️</button></td>
`;
            this.tableBody.appendChild(tr);
        });

        this.renderMetrics(dataset.rows);

    }

    renderMetrics(rows) {
        // Re-query the container in case it wasn't available at construction
        const container = this.metricsContainer || document.querySelector('.metrics-container');
        if (!container) return;

        // Compute S11 Metrics (0-1000 range)
        const s11FreqShift = MetricsCalculator.calculateShift(rows, 's11_freq', 0, 1000);
        const s11DbShift = MetricsCalculator.calculateAmplitudeDelta(rows, 's11_amp', 0, 1000);
        const s11Sensitivity = MetricsCalculator.calculateSensitivity(s11FreqShift, 1000);

        // Compute S21 Metrics (0-1000 range)
        const s21FreqShift = MetricsCalculator.calculateShift(rows, 's21_freq', 0, 1000);
        const s21DbShift = MetricsCalculator.calculateAmplitudeDelta(rows, 's21_amp', 0, 1000);
        const s21Sensitivity = MetricsCalculator.calculateSensitivity(s21FreqShift, 1000);

        // Compute S11 Metrics (72-600 range)
        const s11FreqShift72 = MetricsCalculator.calculateShift(rows, 's11_freq', 72, 600);
        const s11DbShift72 = MetricsCalculator.calculateAmplitudeDelta(rows, 's11_amp', 72, 600);
        const s11Sensitivity72 = MetricsCalculator.calculateSensitivity(s11FreqShift72, 600 - 72);

        // Compute S21 Metrics (72-600 range)
        const s21FreqShift72 = MetricsCalculator.calculateShift(rows, 's21_freq', 72, 600);
        const s21DbShift72 = MetricsCalculator.calculateAmplitudeDelta(rows, 's21_amp', 72, 600);
        const s21Sensitivity72 = MetricsCalculator.calculateSensitivity(s21FreqShift72, 600 - 72);

        // Render Helper - format to 4 decimal places
        // Convert GHz to MHz (*1000) for frequency shift, and MHz/mg/dL to kHz/mg/dL (*1000) for sensitivity
        const formatFreq = (val) => val !== null ? `${(val * 1000).toFixed(4)} MHz` : '<span class="na">N/A</span>';
        const formatSens = (val) => val !== null ? `${(val * 1000).toFixed(4)} kHz/mg/dL` : '<span class="na">N/A</span>';
        const formatDb = (val) => val !== null ? `${val.toFixed(4)} dB` : '<span class="na">N/A</span>';

        container.innerHTML = `
            <div class="metrics-group">
                <h4 class="metrics-group-title">S11 Metrics</h4>
                <div class="metrics-row">
                    <div class="metric-card">
                        <h5>dB Shift (0-1000)</h5>
                        <div class="metric-value">${formatDb(s11DbShift)}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Frequency Shift (0-1000)</h5>
                        <div class="metric-value">${formatFreq(s11FreqShift)}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Sensitivity (0-1000)</h5>
                        <div class="metric-value">${formatSens(s11Sensitivity)}</div>
                    </div>
                </div>
                <div class="metrics-row">
                    <div class="metric-card">
                        <h5>dB Shift (72-600)</h5>
                        <div class="metric-value">${formatDb(s11DbShift72)}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Frequency Shift (72-600)</h5>
                        <div class="metric-value">${formatFreq(s11FreqShift72)}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Sensitivity (72-600)</h5>
                        <div class="metric-value">${formatSens(s11Sensitivity72)}</div>
                    </div>
                </div>
            </div>
            <div class="metrics-group">
                <h4 class="metrics-group-title">S21 Metrics</h4>
                <div class="metrics-row">
                    <div class="metric-card">
                        <h5>dB Shift (0-1000)</h5>
                        <div class="metric-value">${formatDb(s21DbShift)}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Frequency Shift (0-1000)</h5>
                        <div class="metric-value">${formatFreq(s21FreqShift)}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Sensitivity (0-1000)</h5>
                        <div class="metric-value">${formatSens(s21Sensitivity)}</div>
                    </div>
                </div>
                <div class="metrics-row">
                    <div class="metric-card">
                        <h5>dB Shift (72-600)</h5>
                        <div class="metric-value">${formatDb(s21DbShift72)}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Frequency Shift (72-600)</h5>
                        <div class="metric-value">${formatFreq(s21FreqShift72)}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Sensitivity (72-600)</h5>
                        <div class="metric-value">${formatSens(s21Sensitivity72)}</div>
                    </div>
                </div>
            </div>
`;
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
