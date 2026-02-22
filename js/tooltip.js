/**
 * Tooltip module for statistic information icons
 * Handles showing/hiding tooltips on hover
 */

class Tooltip {
    constructor() {
        this.tooltipElement = null;
        this.currentIcon = null;
        this.hideTimeout = null;
    }

    /**
     * Initialize tooltip functionality
     */
    init() {
        console.log('Tooltip: Initializing...');

        // Create tooltip element
        this.createTooltipElement();

        // Set up event listeners for all info icons
        this.setupInfoIcons();

        console.log('Tooltip: Initialized successfully');
    }

    /**
     * Create the tooltip DOM element
     */
    createTooltipElement() {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'stat-tooltip';
        document.body.appendChild(this.tooltipElement);
    }

    /**
     * Check if device is mobile
     */
    isMobile() {
        return window.innerWidth < 768;
    }

    /**
     * Set up event listeners for info icons
     */
    setupInfoIcons() {
        const infoIcons = document.querySelectorAll('.info-icon');
        console.log(`Tooltip: Found ${infoIcons.length} info icons`);

        infoIcons.forEach(icon => {
            // Desktop: hover events (won't trigger on touch devices)
            icon.addEventListener('mouseenter', (e) => {
                if (!this.isMobile()) {
                    this.showTooltip(e);
                }
            });
            icon.addEventListener('mousemove', (e) => {
                if (!this.isMobile()) {
                    this.updatePosition(e);
                }
            });
            icon.addEventListener('mouseleave', () => {
                if (!this.isMobile()) {
                    this.hideTooltip();
                }
            });

            // Mobile: tap events
            icon.addEventListener('click', (e) => {
                if (this.isMobile()) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (this.currentIcon === icon && this.tooltipElement.classList.contains('visible')) {
                        this.hideTooltip();
                    } else {
                        this.showTooltip(e);
                    }
                }
            });
        });

        // Hide tooltip when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (!this.isMobile() || !this.tooltipElement.classList.contains('visible')) {
                return;
            }

            // Check if click is on an info icon or its children
            const isInfoIcon = e.target.classList.contains('info-icon') ||
                               e.target.closest('.info-icon');

            if (!isInfoIcon) {
                this.hideTooltip();
            }
        });
    }

    /**
     * Show tooltip for an info icon
     */
    showTooltip(event) {
        console.log('Tooltip: Show tooltip triggered');

        // Clear any pending hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        const icon = event.currentTarget;
        this.currentIcon = icon;

        // Get tooltip text from i18n
        const tooltipKey = icon.getAttribute('data-tooltip');
        const tooltipText = i18n.translate(tooltipKey);

        console.log(`Tooltip: Key=${tooltipKey}, Text=${tooltipText}`);

        // Set tooltip content
        this.tooltipElement.textContent = tooltipText;

        // Position tooltip
        this.updatePosition(event);

        // Show tooltip with fade-in
        this.tooltipElement.classList.add('visible');
    }

    /**
     * Update tooltip position based on mouse position (or center on mobile)
     */
    updatePosition(event) {
        const padding = 10;

        // Temporarily show tooltip to get accurate dimensions
        const wasVisible = this.tooltipElement.classList.contains('visible');
        if (!wasVisible) {
            this.tooltipElement.style.visibility = 'hidden';
            this.tooltipElement.style.opacity = '1';
        }

        const tooltipRect = this.tooltipElement.getBoundingClientRect();

        // Mobile: center the tooltip on screen
        if (this.isMobile()) {
            const x = (window.innerWidth - tooltipRect.width) / 2;
            const y = (window.innerHeight - tooltipRect.height) / 2;

            this.tooltipElement.style.left = Math.max(padding, x) + 'px';
            this.tooltipElement.style.top = Math.max(padding, y) + 'px';
        } else {
            // Desktop: follow cursor with boundary detection
            let x = event.clientX + padding;
            let y = event.clientY + padding;

            // Adjust if tooltip goes off-screen (right)
            if (x + tooltipRect.width > window.innerWidth) {
                x = event.clientX - tooltipRect.width - padding;
            }

            // Adjust if tooltip goes off-screen (bottom)
            if (y + tooltipRect.height > window.innerHeight) {
                y = event.clientY - tooltipRect.height - padding;
            }

            // Apply position
            this.tooltipElement.style.left = x + 'px';
            this.tooltipElement.style.top = y + 'px';
        }

        // Restore visibility
        if (!wasVisible) {
            this.tooltipElement.style.visibility = '';
            this.tooltipElement.style.opacity = '';
        }
    }

    /**
     * Hide tooltip with fade-out
     */
    hideTooltip() {
        // Add a small delay before hiding to make the transition smooth
        this.hideTimeout = setTimeout(() => {
            this.tooltipElement.classList.remove('visible');
            this.currentIcon = null;
        }, 100);
    }

    /**
     * Refresh tooltips after language change
     */
    refresh() {
        // If a tooltip is currently visible, update its text
        if (this.currentIcon && this.tooltipElement.classList.contains('visible')) {
            const tooltipKey = this.currentIcon.getAttribute('data-tooltip');
            const tooltipText = i18n.translate(tooltipKey);
            this.tooltipElement.textContent = tooltipText;
        }
    }
}

// Create global instance
const tooltip = new Tooltip();
