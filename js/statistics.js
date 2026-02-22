/**
 * Statistics dashboard module
 * Displays summary statistics from the data
 */

class Statistics {
    constructor() {
        this.animated = false;
    }

    /**
     * Update all statistics
     */
    update(data, animate = false) {
        const metadata = data.metadata;
        const deals = data.deals;
        const incidents = data.incidents;

        console.log('Statistics update called with:', {
            deals: deals.length,
            incidents: incidents.length,
            animate
        });

        // Calculate total prisoners released
        const totalPrisoners = deals.reduce((sum, deal) => sum + (deal.num_prisoners_released || 0), 0);

        // Calculate total Israelis released
        const totalIsraelis = deals.reduce((sum, deal) => sum + (deal.num_israelis_released || 0), 0);

        // Calculate total unverified casualties from recidivism statistics
        const totalClaimedCasualties = deals.reduce((sum, deal) => {
            if (deal.recidivism_stats && deal.recidivism_stats.claimed_israeli_casualties) {
                return sum + deal.recidivism_stats.claimed_israeli_casualties;
            }
            return sum;
        }, 0);

        // Calculate verified casualties (both direct and indirect)
        const verifiedCasualties = incidents.filter(inc =>
            (inc.casualty_type === 'direct' || inc.casualty_type === 'indirect') &&
            inc.verified &&
            !inc.is_massacre_group
        ).length;

        // Update stats
        this.updateStat('stat-deals', metadata.total_deals);
        this.updateStat('stat-prisoners', totalPrisoners);
        this.updateStat('stat-verified-casualties', verifiedCasualties);
        this.updateStat('stat-claimed-casualties', totalClaimedCasualties);
        this.updateStat('stat-released', totalIsraelis);

        // Update ratio
        this.updateRatio(totalIsraelis, verifiedCasualties, totalClaimedCasualties);

        // Update ratio tile
        this.updateRatioTile(totalIsraelis, verifiedCasualties, totalClaimedCasualties);

        // Animate numbers on first load or when explicitly requested
        if (!this.animated || animate) {
            this.animateStats();
            this.animated = true;
        } else {
            // Update values immediately without animation
            this.updateStatsImmediate();
        }

        // Update last updated date
        this.updateLastUpdatedDate(metadata.last_verification);
    }

    /**
     * Update a single stat value
     */
    updateStat(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.setAttribute('data-value', value);
        }
    }

    /**
     * Update stats immediately without animation
     */
    updateStatsImmediate() {
        const statElements = document.querySelectorAll('.stat-value');
        statElements.forEach(element => {
            // Skip the ratio element - it has custom HTML
            if (element.id === 'stat-ratio') return;

            const targetValue = parseInt(element.getAttribute('data-value')) || 0;
            element.textContent = targetValue.toLocaleString();
        });
    }

    /**
     * Animate stat numbers counting up
     */
    animateStats() {
        const statElements = document.querySelectorAll('.stat-value');

        statElements.forEach(element => {
            // Skip the ratio element - it has custom HTML
            if (element.id === 'stat-ratio') return;

            const targetValue = parseInt(element.getAttribute('data-value')) || 0;
            const duration = 1000; // 1 second
            const startTime = performance.now();

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function (ease-out)
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const currentValue = Math.floor(easeOut * targetValue);

                element.textContent = currentValue.toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    element.textContent = targetValue.toLocaleString();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    /**
     * Update last updated date in footer
     */
    updateLastUpdatedDate(dateString) {
        const element = document.getElementById('last-updated-date');
        if (element && dateString) {
            const date = new Date(dateString);
            const formatted = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            element.textContent = formatted;
        }
    }

    /**
     * Calculate the ratio of casualties per Israeli released
     */
    calculateRatio(totalIsraelis, verifiedCasualties, claimedCasualties) {
        const totalCasualties = verifiedCasualties + claimedCasualties;
        return totalIsraelis === 0 ? 0 : totalCasualties / totalIsraelis;
    }

    /**
     * Update ratio display and visualization
     */
    updateRatio(totalIsraelis, verifiedCasualties, claimedCasualties) {
        // Calculate ratio
        const ratio = this.calculateRatio(totalIsraelis, verifiedCasualties, claimedCasualties);

        // Format ratio: remove trailing zero if second decimal is 0 (e.g., 7.10 → 7.1)
        const formattedRatio = ratio.toFixed(2).replace(/0$/, '');

        // Update ratio text display
        const ratioValueElement = document.getElementById('ratio-value');
        if (ratioValueElement) {
            ratioValueElement.textContent = formattedRatio;
        }

        // Update quote ratio value
        const ratioQuoteValueElement = document.getElementById('ratio-quote-value');
        if (ratioQuoteValueElement) {
            ratioQuoteValueElement.textContent = formattedRatio;
        }

        // Update visualization
        const totalCasualties = verifiedCasualties + claimedCasualties;
        if (typeof ratioVisualization !== 'undefined' && ratioVisualization.initialized) {
            ratioVisualization.update(totalIsraelis, totalCasualties);
        }
    }

    /**
     * Update ratio tile in statistics grid
     */
    updateRatioTile(totalIsraelis, verifiedCasualties, claimedCasualties) {
        const ratio = this.calculateRatio(totalIsraelis, verifiedCasualties, claimedCasualties);
        const ratioElement = document.getElementById('stat-ratio');

        if (ratioElement) {
            // Format ratio: remove trailing zero if second decimal is 0 (e.g., 7.10 → 7.1)
            const formattedRatio = ratio.toFixed(2).replace(/0$/, '');

            // Create HTML with colored spans: "1 : X"
            ratioElement.innerHTML = `
                <span class="stat-ratio-released">1</span>
                <span class="stat-ratio-separator">:</span>
                <span class="stat-ratio-casualties">${formattedRatio}</span>
            `;
        }
    }
}

// Create global statistics instance
const statistics = new Statistics();
