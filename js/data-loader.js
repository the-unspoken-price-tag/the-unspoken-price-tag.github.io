/**
 * Data loader module
 * Fetches and parses incidents.json
 */

class DataLoader {
    constructor() {
        this.data = null;
        this.loaded = false;
        // Cache busting version - update this when data changes to force reload
        this.dataVersion = '2026-02-15-v5';
    }

    /**
     * Load data from incidents.json
     */
    async loadData() {
        try {
            // Determine correct path based on current location
            const pathPrefix = window.location.pathname.includes('/en/') ? '../' : '';
            // Add cache-busting parameter to force reload on data changes
            const response = await fetch(`${pathPrefix}data/incidents.json?v=${this.dataVersion}`);
            if (!response.ok) {
                throw new Error('Failed to load data');
            }

            this.data = await response.json();
            this.loaded = true;
            return this.data;
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError();
            throw error;
        }
    }

    /**
     * Get all deals
     */
    getDeals() {
        return this.data?.deals || [];
    }

    /**
     * Get all incidents
     */
    getIncidents() {
        return this.data?.incidents || [];
    }

    /**
     * Get metadata
     */
    getMetadata() {
        return this.data?.metadata || {};
    }

    /**
     * Get deal by ID
     */
    getDealById(dealId) {
        return this.getDeals().find(deal => deal.id === dealId);
    }

    /**
     * Get incidents for a specific deal
     */
    getIncidentsByDeal(dealId) {
        return this.getIncidents().filter(incident => incident.deal_id === dealId);
    }

    /**
     * Transform data for graph visualization
     */
    getGraphData() {
        const deals = this.getDeals();
        const incidents = this.getIncidents();

        // Separate massacre groups from individual incidents
        const massacreGroups = incidents.filter(inc => inc.is_massacre_group);
        const individualIncidents = incidents.filter(inc => !inc.is_massacre_group);

        // Create nodes
        const nodes = [];
        const links = [];

        // Gaza war deal IDs to group together
        const gazaDealIds = ['2023_november', '2025_january', '2025_october'];
        const gazaDeals = deals.filter(d => gazaDealIds.includes(d.id));
        const otherDeals = deals.filter(d => !gazaDealIds.includes(d.id));

        // Add Gaza war deal group node (shown initially)
        if (gazaDeals.length > 0) {
            // Calculate totals for the group
            const totalPrisoners = gazaDeals.reduce((sum, d) => sum + (d.num_prisoners_released || 0), 0);
            const totalIsraelis = gazaDeals.reduce((sum, d) => sum + (d.num_israelis_released || 0), 0);

            nodes.push({
                id: 'gaza_war_deals_group',
                type: 'deal-group',
                name_en: '2023-2025 Gaza War Deals',
                name_he: 'עסקאות מלחמת עזה 2023-2025',
                data: {
                    id: 'gaza_war_deals_group',
                    name_en: '2023-2025 Gaza War Deals',
                    name_he: 'עסקאות מלחמת עזה 2023-2025',
                    date: '2023-11-22', // Use earliest date
                    num_prisoners_released: totalPrisoners || null,
                    num_israelis_released: totalIsraelis,
                    description_en: `Three prisoner exchange deals during the Gaza war (2023-2025): November 2023 exchange, January 2025 Phase 1, and October 2025 Final phase. Total: ${totalIsraelis} Israelis released.`,
                    description_he: `שלוש עסקאות חילופי שבויים במהלך מלחמת עזה (2023-2025): עסקת נובמבר 2023, שלב א' ינואר 2025, ושלב סופי אוקטובר 2025. סה"כ: ${totalIsraelis} ישראלים שוחררו.`,
                    recidivism_stats: null
                },
                expanded: false,
                childDeals: gazaDeals
            });
        }

        // Add other deal nodes (not part of Gaza group)
        otherDeals.forEach(deal => {
            nodes.push({
                id: deal.id,
                type: 'deal',
                name_en: deal.name_en,
                name_he: deal.name_he,
                data: deal
            });
        });

        // Add massacre group nodes (shown initially)
        massacreGroups.forEach(massacre => {
            // Find all individual victims for this massacre
            const childIncidents = individualIncidents.filter(inc =>
                inc.casualty_type === 'indirect' &&
                inc.deal_id === massacre.deal_id &&
                inc.militant.name_en === massacre.militant.name_en
            );

            nodes.push({
                id: massacre.id,
                type: 'massacre',
                name_en: massacre.victim.name_en,
                name_he: massacre.victim.name_he,
                data: massacre,
                expanded: false,
                childIncidents: childIncidents
            });

            // Create link from deal to massacre group
            links.push({
                source: massacre.deal_id,
                target: massacre.id
            });
        });

        // Add regular incident nodes (direct casualties, not part of massacre)
        individualIncidents.forEach(incident => {
            // Skip indirect casualties that belong to a massacre group
            // (they'll be added dynamically when massacre is expanded)
            if (incident.casualty_type === 'indirect') {
                return;
            }

            nodes.push({
                id: incident.id,
                type: 'incident',
                name_en: incident.victim.name_en,
                name_he: incident.victim.name_he,
                data: incident
            });

            // Create link from deal to incident
            links.push({
                source: incident.deal_id,
                target: incident.id
            });
        });

        return { nodes, links };
    }

    /**
     * Get casualties count by type for a specific deal
     */
    getCasualtiesByType(dealId) {
        const incidents = this.getIncidentsByDeal(dealId);

        const direct = incidents.filter(inc =>
            inc.casualty_type === 'direct' &&
            inc.verified &&
            !inc.is_massacre_group
        ).length;

        const indirect = incidents.filter(inc =>
            inc.casualty_type === 'indirect' &&
            inc.verified &&
            !inc.is_massacre_group
        ).length;

        return {
            direct,
            indirect,
            total: direct + indirect
        };
    }

    /**
     * Show error message
     */
    showError() {
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.textContent = 'Error loading data. Please try again later.';
            loadingMessage.style.color = '#f44336';
        }
    }

    /**
     * Hide loading message
     */
    hideLoading() {
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
    }
}

// Create global data loader instance
const dataLoader = new DataLoader();
