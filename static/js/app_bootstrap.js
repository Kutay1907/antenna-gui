import { TabsController } from './presentation/tabs_controller.js';
import { ResultsView } from './presentation/results_view.js';
import { StorageRepository } from './infrastructure/storage_repository.js';
import { ResultsService } from './application/results_service.js';

class App {
    static init() {
        console.log('App initializing...');

        const storageRepo = new StorageRepository();
        const resultsService = new ResultsService(storageRepo);

        // Load persisted data
        resultsService.loadAll();

        new TabsController(storageRepo);
        new ResultsView(resultsService);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
