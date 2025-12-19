import { modelStore, DATASET_KEYS, DATASET_LABELS } from '../domain/models.js';
import { OptimizationService } from '../application/optimization_service.js';

export class OptimizationView {
    constructor() {
        this.service = new OptimizationService();
        this.runsList = document.getElementById('opt-runs-list');
        this.addRunBtn = document.getElementById('add-run-btn');
        this.formContainer = document.getElementById('opt-form-container');
        this.currentRunId = null;

        this.init();
    }

    async init() {
        // Load from Supabase first
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
                if (e.target.id === 'parse-btn') {
                    this.handleParse();
                } else if (e.target.id === 'clear-input-btn') {
                    this.handleClearInput();
                } else if (e.target.id === 'save-params-btn') {
                    this.handleSave();
                }
            });
        }
    }

    showAddDialog() {
        const name = prompt('Enter name for new parameter set:', 'Config ' + (modelStore.optRuns.length + 1));
        if (!name) return;

        // Show dataset selector
        let datasetOptions = '';
        DATASET_KEYS.forEach(key => {
            datasetOptions += `${key}: ${DATASET_LABELS[key]}\n`;
        });
        const datasetKey = prompt('Enter dataset key:\n' + datasetOptions, 'felt_1ring');
        if (!datasetKey || !DATASET_KEYS.includes(datasetKey)) {
            alert('Invalid dataset key');
            return;
        }

        this.addRun(name, datasetKey);
    }

    async addRun(name, datasetKey) {
        const run = await this.service.addRun(name, datasetKey);
        this.currentRunId = run.id;
        this.render();
    }

    async deleteRun(id) {
        if (confirm('Delete this parameter set?')) {
            await this.service.deleteRun(id);
            if (this.currentRunId === id) {
                this.currentRunId = modelStore.optRuns.length > 0 ? modelStore.optRuns[0].id : null;
            }
            this.render();
        }
    }

    selectRun(id) {
        this.currentRunId = id;
        this.render();
    }

    async handleSave() {
        await this.service.saveRun(this.currentRunId);
        alert('Parameters saved!');
    }

    handleParse() {
        const result = this.service.parseAndSave(this.currentRunId);
        if (result.success) {
            this.render();
        } else {
            alert('Parsing Error: ' + result.error);
        }
    }

    handleClearInput() {
        if (confirm('Clear input data?')) {
            this.service.clearData(this.currentRunId);
            this.render();
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
            html = '<p class="no-data">No parameter sets. Click + to add.</p>';
        }

        this.runsList.innerHTML = html;
    }

    renderForm() {
        if (!this.formContainer) return;

        const run = modelStore.getOptRun(this.currentRunId);
        if (!run) {
            this.formContainer.innerHTML = '<p class="no-selection">No parameter set selected.</p>';
            return;
        }

        const p = run.parameters;

        const numInput = (lbl, name, val) => `
            <div class="form-group">
                <label>${lbl}</label>
                <input type="number" step="any" name="${name}" value="${val}">
            </div>
        `;

        let tableRows = '';
        if (run.parsedData && run.parsedData.length > 0) {
            run.parsedData.forEach(row => {
                tableRows += `<tr>
                    <td>${row.glucose}</td>
                    <td>${row.freq}</td>
                    <td>${row.amp}</td>
                </tr>`;
            });
        } else {
            tableRows = '<tr><td colspan="3" class="text-center">No data parsed</td></tr>';
        }

        this.formContainer.innerHTML = `
            <div class="form-section">
                <h4>Parameter Set Info</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" name="run-name" value="${run.name}">
                    </div>
                    <div class="form-group">
                        <label>Dataset</label>
                        <select name="dataset_key">
                            ${DATASET_KEYS.map(k => `<option value="${k}" ${k === run.dataset_key ? 'selected' : ''}>${DATASET_LABELS[k]}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h4>General</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Substrate</label>
                        <input type="text" name="substrate" value="${p.substrate}">
                    </div>
                    ${numInput('Ring Count', 'ring_count', p.ring_count)}
                    ${numInput('h', 'h', p.h)}
                    ${numInput('t (Copper)', 't', p.t)}
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
                <h4>Optional</h4>
                <div class="form-row">
                    ${numInput('Bheight', 'bheight', p.bheight)}
                    ${numInput('Bthick', 'bthick', p.bthick)}
                </div>
            </div>

            <div class="form-section">
                <button id="save-params-btn" class="action-btn">💾 Save Parameters</button>
            </div>
            
            <div class="form-section">
                <h4>Input Data (Freq Amp pairs)</h4>
                <div class="input-parser-container">
                    <div class="input-area">
                        <textarea name="rawInput" placeholder="Paste pairs here (e.g. 2.45 -10)...">${run.rawInput || ''}</textarea>
                        <div class="parser-actions">
                            <button id="parse-btn" class="action-btn">Parse</button>
                            <button id="clear-input-btn" class="secondary-btn">Clear</button>
                        </div>
                    </div>
                    <div class="preview-area">
                        <table class="preview-table">
                            <thead>
                                <tr>
                                    <th>Glucose (Calc)</th>
                                    <th>Freq</th>
                                    <th>Amp</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
}
