import { TabsController } from './presentation/tabs_controller.js';
import { ResultsView } from './presentation/results_view.js';

class App {
    static init() {
        console.log('App initializing...');
        new TabsController();
        new ResultsView();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
