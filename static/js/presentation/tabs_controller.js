/**
 * Controls the main tab navigation.
 */
export class TabsController {
    constructor() {
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.init();
    }

    init() {
        this.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => this.handleTabClick(e));
        });
    }

    handleTabClick(event) {
        const targetTab = event.target.getAttribute('data-tab');

        // Update active class for buttons
        this.tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === targetTab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update active class for content
        this.tabContents.forEach(content => {
            if (content.id === `${targetTab}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    }
}
