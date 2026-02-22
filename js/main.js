/**
 * Main application entry point
 * Initializes all modules and coordinates app startup
 */

class App {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize application
     */
    async init() {
        try {
            // Step 1: Initialize i18n
            await i18n.init();

            // Step 2: Load data
            await dataLoader.loadData();

            // Step 3: Hide loading message
            dataLoader.hideLoading();

            // Step 3.5: Initialize ratio visualization
            ratioVisualization.init();

            // Step 4: Update statistics
            statistics.update(dataLoader.data);

            // Step 5: Initialize graph
            graph.init();

            // Step 6: Render graph
            const graphData = dataLoader.getGraphData();
            if (graphData.nodes.length > 0) {
                graph.render(graphData);
            } else {
                graph.showEmptyState();
            }

            // Step 7: Initialize popups
            popup.init();
            dealPopup.init();
            aboutPopup.init();

            // Step 8: Initialize tooltips
            tooltip.init();

            // Step 9: Set up event listeners
            this.setupEventListeners();

            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Language toggle
        const languageToggle = document.getElementById('language-toggle');
        if (languageToggle) {
            languageToggle.addEventListener('click', async () => {
                await i18n.toggleLanguage();
                // Update ratio visualization labels
                ratioVisualization.updateLabels();
                // Update graph labels
                graph.updateLabels();
                // Update popups if open
                popup.refresh();
                dealPopup.refresh();
                aboutPopup.refresh();
                // Update tooltips
                tooltip.refresh();
            });
        }

        // Reset filters button
        const resetFiltersBtn = document.getElementById('reset-filters-btn');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                graph.resetFilters();
            });
        }
    }

}

// Create and initialize app when DOM is ready
const app = new App();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}
