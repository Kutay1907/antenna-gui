import { TabsController } from './presentation/tabs_controller.js';
import { ResultsView } from './presentation/results_view.js';
import { StorageRepository } from './infrastructure/storage_repository.js';
import { ResultsService } from './application/results_service.js';
import { OptimizationView } from './presentation/optimization_view.js';
import { ExportImportService } from './application/export_import_service.js';

class App {
    static init() {
        console.log('App initializing...');

        const storageRepo = new StorageRepository();
        const resultsService = new ResultsService(storageRepo);
        const exportService = new ExportImportService(resultsService);

        // Load persisted data
        resultsService.loadAll();

        new TabsController(storageRepo);
        const resView = new ResultsView(resultsService);
        const optView = new OptimizationView();

        // Wire Export/Import UI
        this.bindExportImport(exportService, resView, optView);
    }

    static bindExportImport(service, resView, optView) {
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');
        const fileInput = document.getElementById('import-file-input');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                service.downloadJSON();
            });
        }

        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (evt) => {
                    const json = evt.target.result;
                    const result = service.importState(json);

                    if (result.success) {
                        alert('Import successful!');
                        // Refresh Views
                        resView.renderTable();
                        resView.switchDataset(resView.currentDatasetKey); // Force full refresh
                        if (modelStore.optRuns.length > 0) {
                            optView.selectRun(modelStore.optRuns[0].id);
                        } else {
                            optView.render();
                        }
                    } else {
                        alert('Import failed: ' + result.error);
                    }
                    fileInput.value = ''; // Reset
                };
                reader.readAsText(file);
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
