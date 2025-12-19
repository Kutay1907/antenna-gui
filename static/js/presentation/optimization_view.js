import { modelStore } from '../domain/models.js';
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

    init() {
        this.bindEvents();
        // Create initial run if empty
        if (modelStore.optRuns.length === 0) {
            this.addRun();
        } else {
            this.currentRunId = modelStore.optRuns[0].id;
            this.render();
        }
    }

    bindEvents() {
        if (this.addRunBtn) {
            this.addRunBtn.addEventListener('click', () => this.addRun());
        }

        if (this.runsList) {
            this.runsList.addEventListener('click', (e) => {
                // Select Run
                const item = e.target.closest('.run-item');
                if (item) {
                    this.selectRun(item.getAttribute('data-id'));
                }

                // Delete Run
                if (e.target.classList.contains('delete-run-btn')) {
                    e.stopPropagation(); // Prevent select
                    const id = e.target.getAttribute('data-id');
                    this.deleteRun(id);
                }
            });
        }

        if (this.formContainer) {
            // Input delegation
            this.formContainer.addEventListener('input', (e) => {
                const input = e.target;
                if (input.name === 'rawInput') {
                    this.service.updateRawInput(this.currentRunId, input.value);
                } else if (input.hasAttribute('name')) {
                    this.updateParameter(input.name, input.value);
                }
            });

            // Button delegation
            this.formContainer.addEventListener('click', (e) => {
                if (e.target.id === 'parse-btn') {
                    this.handleParse();
                } else if (e.target.id === 'clear-input-btn') {
                    this.handleClearInput();
                }
            });
        }
    }

    handleParse() {
        const result = this.service.parseAndSave(this.currentRunId);
        if (result.success) {
            this.render(); // Re-render to show table
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

    addRun() {
        const run = modelStore.addOptRun();
        this.currentRunId = run.id;
        this.render();
    }

    deleteRun(id) {
        if (confirm('Delete this run?')) {
            modelStore.deleteOptRun(id);
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

    updateParameter(field, value) {
        const run = modelStore.getOptRun(this.currentRunId);
        if (run) {
            if (field === 'substrate') {
                run.parameters[field] = value;
            } else {
                run.parameters[field] = parseFloat(value) || 0;
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

        // Sort runs by sensitivity descending
        const sortedRuns = [...modelStore.optRuns].sort((a, b) => {
            const sA = a.sensitivity || -Infinity;
            const sB = b.sensitivity || -Infinity;
            return sB - sA;
        });

        sortedRuns.forEach(run => {
            const active = run.id === this.currentRunId ? 'active' : '';

            let badge = '';
            if (run.sensitivity !== null) {
                // Show Sens and Shift. S = Sens, Sh = Shift
                badge = `<div class="run-metrics">
                            <small>Sens: ${run.sensitivity.toFixed(4)}</small>
                            <small>Shift: ${run.shift.toFixed(4)}</small>
                         </div>`;
            } else {
                badge = `<div class="run-metrics"><small>No Data</small></div>`;
            }

            html += `
                <div class="run-item ${active}" data-id="${run.id}">
                    <div class="run-info">
                        <span class="run-name">${run.name}</span>
                        ${badge}
                    </div>
                    <button class="delete-run-btn" data-id="${run.id}">×</button>
                </div>
            `;
        });
        this.runsList.innerHTML = html;
    }

    renderForm() {
        if (!this.formContainer) return;

        const run = modelStore.getOptRun(this.currentRunId);
        if (!run) {
            this.formContainer.innerHTML = '<p class="no-selection">No run selected.</p>';
            return;
        }

        const p = run.parameters;

        // Helper to generate input
        const numInput = (lbl, name, val) => `
            <div class="form-group">
                <label>${lbl}</label>
                <input type="number" step="any" name="${name}" value="${val}">
            </div>
        `;

        // Render Data Table rows
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
                <h4>General</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Substrate</label>
                        <input type="text" name="substrate" value="${p.substrate}">
                    </div>
                    ${numInput('Ring Count', 'ring_count', p.ring_count)}
                    ${numInput('h', 'h', p.h)}
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
                <h4>Input Logic (Freq Amp pairs)</h4>
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
