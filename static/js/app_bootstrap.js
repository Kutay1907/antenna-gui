import { TabsController } from './presentation/tabs_controller.js';
import { ResultsView } from './presentation/results_view.js';
import { StorageRepository } from './infrastructure/storage_repository.js';
import { ResultsService } from './application/results_service.js';
import { OptimizationView } from './presentation/optimization_view.js';

class App {
    static async init() {
        console.log('App initializing...');

        try {
            const storageRepo = new StorageRepository();
            const resultsService = new ResultsService(storageRepo);

            // Load persisted data from Supabase
            await resultsService.loadAll();

            new TabsController(storageRepo);
            new ResultsView(resultsService);
            new OptimizationView();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            alert('Application failed to start. Check console.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
