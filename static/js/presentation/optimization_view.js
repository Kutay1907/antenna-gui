import { modelStore, DATASET_KEYS, DATASET_LABELS } from '../domain/models.js';
import { OptimizationService } from '../application/optimization_service.js';
import { MetricsCalculator } from '../domain/metrics.js';

export class OptimizationView {
    constructor() {
        this.service = new OptimizationService();
        this.runsList = document.getElementById('opt-runs-list');
        this.addRunBtn = document.getElementById('add-run-btn');
        this.formContainer = document.getElementById('opt-form-container');
        this.currentRunId = null;
        this.currentSubTab = 'parameters'; // 'parameters' or 'results'

        this.init();
    }

    async init() {
        await this.service.loadAll();
        this.bindEvents();

        if (modelStore.optRuns.length > 0) {
            this.currentRunId = modelStore.optRuns[0].id;
        }
        this.render();
    }

    bindEvents() {
        if (this.addRunBtn) {
            this.addRunBtn.addEventListener('click', () => this.showAddDialog());
        }

        if (this.runsList) {
            this.runsList.addEventListener('click', (e) => {
                const item = e.target.closest('.run-item');
                if (item && !e.target.classList.contains('delete-run-btn')) {
                    this.selectRun(item.getAttribute('data-id'));
                }

                if (e.target.classList.contains('delete-run-btn')) {
                    e.stopPropagation();
                    const id = e.target.getAttribute('data-id');
                    this.deleteRun(id);
                }
            });
        }

        if (this.formContainer) {
            this.formContainer.addEventListener('input', (e) => {
                const input = e.target;
                if (input.name === 'rawInput') {
                    this.service.updateRawInput(this.currentRunId, input.value);
                } else if (input.name === 'run-name') {
                    const run = modelStore.getOptRun(this.currentRunId);
                    if (run) run.name = input.value;
                } else if (input.hasAttribute('name')) {
                    this.updateParameter(input.name, input.value);
                }
            });

            this.formContainer.addEventListener('click', (e) => {
                // Sub-tab switching
                if (e.target.classList.contains('opt-sub-tab')) {
                    this.currentSubTab = e.target.getAttribute('data-tab');
                    this.render();
                }
                // Save
                if (e.target.id === 'save-params-btn') {
                    this.handleSave();
                }
                // Apply bulk data
                if (e.target.id === 'opt-apply-bulk-btn') {
                    this.applyBulkToOptResults();
                }
            });
        }
    }

    showAddDialog() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>✨ New Configuration</h3>
                <div class="form-group">
                    <label>Configuration Name</label>
                    <input type="text" id="new-param-name" placeholder="e.g., Config A" value="Config ${modelStore.optRuns.length + 1}">
                </div>
                <div class="form-group">
                    <label>Base Dataset Type</label>
                    <select id="new-param-dataset">
                        ${DATASET_KEYS.map(k => `<option value="${k}">${DATASET_LABELS[k]}</option>`).join('')}
                    </select>
                </div>
                <p class="modal-hint">This will create a new configuration with its own results table and parameters.</p>
                <div class="modal-actions">
                    <button id="modal-cancel" class="secondary-btn">Cancel</button>
                    <button id="modal-create" class="action-btn">Create Configuration</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#new-param-name').focus();

        modal.querySelector('#modal-cancel').onclick = () => modal.remove();
        modal.querySelector('#modal-create').onclick = async () => {
            const name = modal.querySelector('#new-param-name').value.trim();
            const datasetKey = modal.querySelector('#new-param-dataset').value;

            if (!name) {
                alert('Please enter a name');
                return;
            }

            modal.remove();
            await this.addRun(name, datasetKey);
        };

        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    async addRun(name, datasetKey) {
        // Auto-set substrate based on dataset
        const isJeans = datasetKey.includes('jeans');
        const ringCount = datasetKey.includes('1ring') ? 1 : datasetKey.includes('2ring') ? 2 : 3;

        const run = await this.service.addRun(name, datasetKey);
        run.parameters.substrate = isJeans ? 'Jeans' : 'Felt';
        run.parameters.ring_count = ringCount;
        await this.service.saveRun(run.id);

        this.currentRunId = run.id;
        this.currentSubTab = 'parameters';
        this.render();
    }

    async deleteRun(id) {
        if (confirm('Delete this configuration and all its data?')) {
            await this.service.deleteRun(id);
            if (this.currentRunId === id) {
                this.currentRunId = modelStore.optRuns.length > 0 ? modelStore.optRuns[0].id : null;
            }
            this.render();
        }
    }

    async selectRun(id) {
        this.currentRunId = id;

        // Load results for this run from Supabase
        const run = modelStore.getOptRun(id);
        if (run) {
            const results = await this.service.loadResults(id);
            if (results) {
                run.results = results;
            }
        }

        this.render();
    }

    async handleSave() {
        const run = modelStore.getOptRun(this.currentRunId);
        if (!run) return;

        if (this.currentSubTab === 'results' && run.results) {
            // Save results to parameter_results table
            const success = await this.service.saveResults(this.currentRunId, run.results);
            if (success) {
                alert('✓ Results saved!');
            }
        } else {
            // Save parameters
            await this.service.saveRun(this.currentRunId);
            alert('✓ Parameters saved!');
        }
    }

    updateParameter(field, value) {
        const run = modelStore.getOptRun(this.currentRunId);
        if (run) {
            if (field === 'substrate' || field === 'dataset_key') {
                run.parameters[field] = value;
            } else {
                const num = parseFloat(value);
                run.parameters[field] = isNaN(num) ? 0 : num;
            }
        }
    }

    render() {
        this.renderRunsList();
        this.renderForm();
    }

    renderRunsList() {
        if (!this.runsList) return;

        let html = '';

        // Group by dataset_key
        const grouped = {};
        modelStore.optRuns.forEach(run => {
            const key = run.dataset_key || 'unknown';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(run);
        });

        Object.keys(grouped).forEach(datasetKey => {
            const label = DATASET_LABELS[datasetKey] || datasetKey;
            html += `<div class="run-group"><div class="run-group-header">${label}</div>`;

            grouped[datasetKey].forEach(run => {
                const active = run.id === this.currentRunId ? 'active' : '';
                html += `
                    <div class="run-item ${active}" data-id="${run.id}">
                        <span class="run-name">${run.name}</span>
                        <button class="delete-run-btn" data-id="${run.id}">×</button>
                    </div>
                `;
            });
            html += `</div>`;
        });

        if (modelStore.optRuns.length === 0) {
            html = '<p class="no-data">No configurations yet.<br>Click <strong>+</strong> to add one.</p>';
        }

        this.runsList.innerHTML = html;
    }

    renderForm() {
        if (!this.formContainer) return;

        const run = modelStore.getOptRun(this.currentRunId);
        if (!run) {
            this.formContainer.innerHTML = '<div class="no-selection"><p>Select a configuration from the left<br>or create a new one.</p></div>';
            return;
        }

        // Sub-tabs
        const paramActive = this.currentSubTab === 'parameters' ? 'active' : '';
        const resultsActive = this.currentSubTab === 'results' ? 'active' : '';

        let content = '';
        if (this.currentSubTab === 'parameters') {
            content = this.renderParametersContent(run);
        } else {
            content = this.renderResultsContent(run);
        }

        this.formContainer.innerHTML = `
            <div class="config-header">
                <h3>${run.name}</h3>
                <span class="config-badge">${DATASET_LABELS[run.dataset_key] || run.dataset_key}</span>
            </div>
            <div class="opt-sub-tabs">
                <button class="opt-sub-tab ${paramActive}" data-tab="parameters">📐 Parameters</button>
                <button class="opt-sub-tab ${resultsActive}" data-tab="results">📊 Results Table</button>
            </div>
            <div class="opt-tab-content">
                ${content}
            </div>
        `;
    }

    renderParametersContent(run) {
        const p = run.parameters;

        const numInput = (lbl, name, val) => `
            <div class="form-group compact">
                <label>${lbl}</label>
                <input type="number" step="any" name="${name}" value="${val}">
            </div>
        `;

        return `
            <div class="form-section">
                <h4>General</h4>
                <div class="form-row">
                    <div class="form-group compact">
                        <label>Substrate</label>
                        <input type="text" name="substrate" value="${p.substrate}" readonly>
                    </div>
                    ${numInput('Rings', 'ring_count', p.ring_count)}
                    ${numInput('h', 'h', p.h)}
                    ${numInput('t', 't', p.t)}
                </div>
            </div>

            <div class="form-section">
                <h4>Gap (G)</h4>
                <div class="form-row three-col">
                    ${numInput('G1', 'g1', p.g1)}
                    ${numInput('G2', 'g2', p.g2)}
                    ${numInput('G3', 'g3', p.g3)}
                </div>
            </div>

            <div class="form-section">
                <h4>Width (W)</h4>
                <div class="form-row four-col">
                    ${numInput('W1', 'w1', p.w1)}
                    ${numInput('W2', 'w2', p.w2)}
                    ${numInput('W3', 'w3', p.w3)}
                    ${numInput('Ws', 'ws', p.ws)}
                </div>
            </div>

            <div class="form-section">
                <h4>Length (L)</h4>
                <div class="form-row four-col">
                    ${numInput('L1', 'l1', p.l1)}
                    ${numInput('L2', 'l2', p.l2)}
                    ${numInput('L3', 'l3', p.l3)}
                    ${numInput('L4', 'l4', p.l4)}
                </div>
                <div class="form-row four-col">
                    ${numInput('L5', 'l5', p.l5)}
                    ${numInput('L6', 'l6', p.l6)}
                    ${numInput('Lf', 'lf', p.lf)}
                    ${numInput('Ls', 'ls', p.ls)}
                </div>
            </div>
            
            <div class="form-section">
                <h4>Box</h4>
                <div class="form-row">
                    ${numInput('Height', 'bheight', p.bheight)}
                    ${numInput('Thick', 'bthick', p.bthick)}
                </div>
            </div>

            <div class="form-actions">
                <button id="save-params-btn" class="action-btn">💾 Save Parameters</button>
            </div>
        `;
    }

    renderResultsContent(run) {
        const defaultGlucose = [0, 72, 216, 330, 500, 600, 1000];

        if (!run.results) {
            run.results = defaultGlucose.map(g => ({
                glucose: g,
                s11_freq: 0, s11_amp: 0,
                s21_freq: 0, s21_amp: 0
            }));
        }

        let tableRows = '';
        run.results.forEach((row, idx) => {
            tableRows += `
                <tr>
                    <td><input type="number" value="${row.glucose}" data-idx="${idx}" data-field="glucose" class="result-input"></td>
                    <td><input type="number" step="any" value="${row.s11_freq}" data-idx="${idx}" data-field="s11_freq" class="result-input"></td>
                    <td><input type="number" step="any" value="${row.s11_amp}" data-idx="${idx}" data-field="s11_amp" class="result-input"></td>
                    <td><input type="number" step="any" value="${row.s21_freq}" data-idx="${idx}" data-field="s21_freq" class="result-input"></td>
                    <td><input type="number" step="any" value="${row.s21_amp}" data-idx="${idx}" data-field="s21_amp" class="result-input"></td>
                </tr>
            `;
        });

        return `
            <div class="form-section">
                <h4>📥 Paste Data (Auto-fills Rows)</h4>
                <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                    <textarea id="opt-bulk-paste" style="flex:1; height: 80px; font-family: monospace; padding: 8px;" placeholder="(7.314, -34.16548)&#10;(7.32, -34.18422)&#10;..."></textarea>
                    <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center;">
                        <label style="font-weight: normal;"><input type="radio" name="opt-target-param" value="s11" checked> S11</label>
                        <label style="font-weight: normal;"><input type="radio" name="opt-target-param" value="s21"> S21</label>
                        <button id="opt-apply-bulk-btn" class="action-btn small">Apply</button>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h4>S-Parameter Results for ${run.name}</h4>
                <table class="results-table compact">
                    <thead>
                        <tr>
                            <th>Glucose (mg/dL)</th>
                            <th>S11 Freq (GHz)</th>
                            <th>S11 Amp (dB)</th>
                            <th>S21 Freq (GHz)</th>
                            <th>S21 Amp (dB)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>

            <div class="metrics-section">
                <h3 class="metrics-title">Derived Metrics</h3>
                ${this.renderOptMetrics(run.results)}
            </div>

            <div class="form-actions">
                <button id="save-params-btn" class="action-btn">💾 Save Results</button>
            </div>
        `;
    }

    renderOptMetrics(rows) {
        if (!rows || rows.length === 0) {
            return '<div class="metrics-container"><p class="na">No data available</p></div>';
        }

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

        return `
            <div class="metrics-container">
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
            </div>
        `;
    }

    applyBulkToOptResults() {
        const run = modelStore.getOptRun(this.currentRunId);
        if (!run || !run.results) return;

        const text = document.getElementById('opt-bulk-paste').value;
        const isS11 = document.querySelector('input[name="opt-target-param"][value="s11"]').checked;

        // Parse (freq, amp) format
        const regex = /\(\s*([\d\.-]+)\s*,\s*([\d\.-]+)\s*\)/g;
        const parsed = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            parsed.push({
                freq: parseFloat(match[1]),
                amp: parseFloat(match[2])
            });
        }

        if (parsed.length === 0) {
            alert('No valid (freq, amp) data found.');
            return;
        }

        let count = 0;
        run.results.forEach((row, i) => {
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

        this.render();
        alert(`Applied data to ${count} rows.`);
    }
}
