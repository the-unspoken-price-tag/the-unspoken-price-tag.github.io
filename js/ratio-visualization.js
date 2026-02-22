/**
 * Ratio visualization module
 * Displays proportional circle comparison of Israelis Released vs Total Casualties
 */

class RatioVisualization {
    constructor() {
        this.svg = null;
        this.width = 0;
        this.height = 0;
        this.initialized = false;
    }

    /**
     * Get translation from i18n
     */
    getTranslation(key) {
        if (typeof i18n !== 'undefined' && i18n && typeof i18n.translate === 'function') {
            return i18n.translate(key);
        }
        // Fallback translations
        const fallbacks = {
            'ratio_viz_israelis': 'Israelis Released',
            'ratio_viz_casualties': 'Israelis Murdered'
        };
        return fallbacks[key] || key;
    }

    /**
     * Initialize the visualization
     */
    init() {
        this.svg = d3.select('#ratio-viz-svg');
        if (this.svg.empty()) {
            console.error('Ratio visualization SVG element not found');
            return;
        }

        // Set up dimensions and resize handler
        this.updateDimensions();

        // If dimensions are 0, retry after a short delay
        if (this.width === 0 || this.height === 0) {
            console.warn('Container has zero dimensions, retrying...');
            setTimeout(() => this.updateDimensions(), 100);
        }

        window.addEventListener('resize', () => this.updateDimensions());

        this.initialized = true;
        console.log('Ratio visualization initialized', { width: this.width, height: this.height });
    }

    /**
     * Update dimensions based on container size
     */
    updateDimensions() {
        const container = document.getElementById('ratio-viz');
        if (!container) {
            console.error('Ratio viz container not found');
            return;
        }

        this.width = container.clientWidth;
        this.height = container.clientHeight;

        console.log('Ratio viz dimensions:', this.width, 'x', this.height);

        this.svg
            .attr('width', this.width)
            .attr('height', this.height);
    }

    /**
     * Calculate circle radius from value (using square root for area proportionality)
     */
    calculateRadius(value, maxValue, maxRadius) {
        if (value === 0) return 0;
        // For area proportionality: area = π * r²
        // So r = sqrt(value / maxValue) * maxRadius
        return Math.sqrt(value / maxValue) * maxRadius;
    }

    /**
     * Update visualization with new data
     */
    update(israelisReleased, totalCasualties) {
        if (!this.initialized) {
            console.warn('Ratio visualization not initialized');
            return;
        }

        console.log('Updating ratio visualization:', { israelisReleased, totalCasualties });

        // Update dimensions if they're not set
        if (this.width === 0 || this.height === 0) {
            this.updateDimensions();
        }

        // Check if dimensions are still invalid
        if (this.width === 0 || this.height === 0) {
            console.error('Cannot render visualization: container has zero dimensions');
            return;
        }

        // Calculate maximum radius based on container size
        const maxRadius = Math.min(this.width, this.height) * 0.3;

        // Calculate radii for both circles (area proportional to values)
        const maxValue = Math.max(israelisReleased, totalCasualties);
        const israelisRadius = this.calculateRadius(israelisReleased, maxValue, maxRadius);
        const casualtiesRadius = this.calculateRadius(totalCasualties, maxValue, maxRadius);

        console.log('Calculated radii:', { israelisRadius, casualtiesRadius, maxRadius });

        // Position circles (responsive: further apart on mobile)
        const isMobile = this.width < 768;
        const leftX = isMobile ? this.width * 0.3 : this.width * 0.38;
        const rightX = isMobile ? this.width * 0.7 : this.width * 0.62;
        const centerY = this.height * 0.6;

        // Clear existing elements
        this.svg.selectAll('*').remove();

        // Create group for the visualization
        const g = this.svg.append('g');

        // Israelis Released circle (blue)
        const israelisGroup = g.append('g')
            .attr('class', 'ratio-viz-circle ratio-circle-released');

        israelisGroup.append('circle')
            .attr('cx', leftX)
            .attr('cy', centerY)
            .attr('r', 0)
            .attr('fill', '#2196F3')
            .transition()
            .duration(800)
            .attr('r', israelisRadius);

        // Israelis label (above circle)
        israelisGroup.append('text')
            .attr('class', 'ratio-viz-label')
            .attr('x', leftX)
            .attr('y', centerY - israelisRadius - 15)
            .attr('text-anchor', 'middle')
            .attr('fill', '#2196F3')
            .attr('font-size', '14px')
            .attr('font-weight', '600')
            .attr('opacity', 0)
            .text(this.getTranslation('ratio_viz_israelis'))
            .transition()
            .duration(800)
            .attr('opacity', 1);

        // Israelis value (inside circle)
        israelisGroup.append('text')
            .attr('class', 'ratio-viz-value')
            .attr('x', leftX)
            .attr('y', centerY)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#FFFFFF')
            .attr('font-size', '18px')
            .attr('font-weight', '700')
            .attr('opacity', 0)
            .text(israelisReleased.toLocaleString())
            .transition()
            .duration(800)
            .attr('opacity', 1);

        // Total Casualties circle (red)
        const casualtiesGroup = g.append('g')
            .attr('class', 'ratio-viz-circle ratio-circle-casualties');

        casualtiesGroup.append('circle')
            .attr('cx', rightX)
            .attr('cy', centerY)
            .attr('r', 0)
            .attr('fill', '#F44336')
            .transition()
            .duration(800)
            .attr('r', casualtiesRadius);

        // Casualties label (above circle)
        casualtiesGroup.append('text')
            .attr('class', 'ratio-viz-label')
            .attr('x', rightX)
            .attr('y', centerY - casualtiesRadius - 15)
            .attr('text-anchor', 'middle')
            .attr('fill', '#F44336')
            .attr('font-size', '14px')
            .attr('font-weight', '600')
            .attr('opacity', 0)
            .text(this.getTranslation('ratio_viz_casualties'))
            .transition()
            .duration(800)
            .attr('opacity', 1);

        // Casualties value (inside circle)
        casualtiesGroup.append('text')
            .attr('class', 'ratio-viz-value')
            .attr('x', rightX)
            .attr('y', centerY)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#FFFFFF')
            .attr('font-size', '18px')
            .attr('font-weight', '700')
            .attr('opacity', 0)
            .text(totalCasualties.toLocaleString())
            .transition()
            .duration(800)
            .attr('opacity', 1);
    }

    /**
     * Update labels when language changes
     */
    updateLabels() {
        if (!this.initialized) {
            return;
        }

        // Select and update labels by their parent group class
        this.svg.select('.ratio-circle-released .ratio-viz-label')
            .text(this.getTranslation('ratio_viz_israelis'));

        this.svg.select('.ratio-circle-casualties .ratio-viz-label')
            .text(this.getTranslation('ratio_viz_casualties'));
    }
}

// Create global ratio visualization instance
const ratioVisualization = new RatioVisualization();
