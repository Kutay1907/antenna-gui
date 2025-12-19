import { modelStore, DATASET_KEYS, DATASET_LABELS } from '../domain/models.js';

export class ResultsView {
    constructor(resultsService) {
        this.resultsService = resultsService;
        this.currentDatasetKey = DATASET_KEYS[0]; // Default to first
        this.subTabsContainer = document.querySelector('.sub-tabs');
        this.tableBody = document.querySelector('#results-table-body');
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

        // Clear Data
        const clearBtn = document.getElementById('clear-data-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all results data?')) {
                    this.resultsService.clearAllData();
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

        // Render Rows
        this.tableBody.innerHTML = '';
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
    }

    addRow() {
        const dataset = modelStore.getDataset(this.currentDatasetKey);
        dataset.addRow();
        this.resultsService.saveAll(); // Auto-save
        this.renderTable();
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
        this.resultsService.saveAll(); // Auto-save
    }
}
