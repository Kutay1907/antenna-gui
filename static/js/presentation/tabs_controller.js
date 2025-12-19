/**
 * Controls the main tab navigation.
 */
export class TabsController {
    constructor(storageRepo) {
        this.storage = storageRepo;
        this.STORAGE_KEY = 'active_tab';
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.init();
    }

    init() {
        this.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => this.handleTabClick(e));
        });

        // Restore active tab
        const savedTab = this.storage.load(this.STORAGE_KEY);
        if (savedTab) {
            this.activateTab(savedTab);
        }
    }

    handleTabClick(event) {
        const targetTab = event.target.getAttribute('data-tab');
        this.activateTab(targetTab);
    }

    activateTab(tabName) {
        this.tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.tabContents.forEach(content => {
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        this.storage.save(this.STORAGE_KEY, tabName);
    }
}
