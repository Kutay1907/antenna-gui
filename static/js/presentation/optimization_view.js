import { modelStore } from '../domain/models.js';

export class OptimizationView {
    constructor() {
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
            this.formContainer.addEventListener('input', (e) => {
                const input = e.target;
                if (input.hasAttribute('name')) {
                    this.updateParameter(input.name, input.value);
                }
            });
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
        modelStore.optRuns.forEach(run => {
            const active = run.id === this.currentRunId ? 'active' : '';
            html += `
                <div class="run-item ${active}" data-id="${run.id}">
                    <span class="run-name">${run.name}</span>
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
        `;
    }
}
