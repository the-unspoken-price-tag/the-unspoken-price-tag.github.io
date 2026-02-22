/**
 * About Popup Module
 * Manages the About page modal popup
 */

class AboutPopup {
    constructor() {
        this.popup = null;
        this.closeButton = null;
        this.openButton = null;
    }

    /**
     * Initialize the about popup
     */
    init() {
        this.popup = document.getElementById('about-popup');
        this.closeButton = document.getElementById('about-popup-close');
        this.openButton = document.getElementById('about-button');
        this.logo = document.querySelector('.site-logo');

        if (!this.popup || !this.closeButton || !this.openButton) {
            console.error('About popup elements not found');
            return;
        }

        // Event listeners
        this.openButton.addEventListener('click', () => this.open());
        this.closeButton.addEventListener('click', () => this.close());

        // Add click listener to logo
        if (this.logo) {
            this.logo.addEventListener('click', () => this.open());
            this.logo.style.cursor = 'pointer';
        }

        // Close on overlay click
        this.popup.addEventListener('click', (e) => {
            if (e.target === this.popup) {
                this.close();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }

    /**
     * Open the popup
     */
    open() {
        if (this.popup) {
            this.popup.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close the popup
     */
    close() {
        if (this.popup) {
            this.popup.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    /**
     * Check if popup is open
     * @returns {boolean}
     */
    isOpen() {
        return this.popup && this.popup.style.display === 'flex';
    }

    /**
     * Refresh popup content (called on language toggle)
     * Content is automatically updated via i18n system
     */
    refresh() {
        // Content is auto-updated via i18n system
        // No additional action needed
    }
}

// Create global instance
const aboutPopup = new AboutPopup();
