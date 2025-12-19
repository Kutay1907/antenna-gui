import { TabsController } from './presentation/tabs_controller.js';

class App {
    static init() {
        console.log('App initializing...');
        new TabsController();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
