/**
 * Incident popup modal module
 * Shows detailed information about an incident
 */

class Popup {
    constructor() {
        this.popup = null;
        this.closeButton = null;
        this.currentIncident = null;
        this.currentNodeRef = null;
    }

    /**
     * Initialize popup
     */
    init() {
        this.popup = document.getElementById('incident-popup');
        this.closeButton = document.getElementById('popup-close');

        // Close button click
        this.closeButton.addEventListener('click', () => this.close());

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
     * Open popup with incident data
     */
    open(incident, nodeRef = null) {
        this.currentIncident = incident;
        this.currentNodeRef = nodeRef;
        this.populate(incident);
        this.handleExpansionButton(incident, nodeRef);
        this.popup.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    /**
     * Close popup
     */
    close() {
        this.popup.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
        this.currentIncident = null;
        this.currentNodeRef = null;
    }

    /**
     * Check if popup is open
     */
    isOpen() {
        return this.popup.style.display === 'flex';
    }

    /**
     * Populate popup with incident data
     */
    populate(incident) {
        const lang = i18n.getCurrentLanguage();

        // Victim information
        const victimName = lang === 'en' ? incident.victim.name_en : incident.victim.name_he;
        const victimNameBilingual = `${incident.victim.name_en} (${incident.victim.name_he})`;
        document.getElementById('popup-victim-name').textContent = victimNameBilingual;

        // Victim age
        if (incident.victim.age) {
            document.getElementById('popup-victim-age').textContent = incident.victim.age;
            document.getElementById('popup-victim-age-container').style.display = 'block';
        } else {
            document.getElementById('popup-victim-age-container').style.display = 'none';
        }

        // Victim date
        const date = new Date(incident.victim.date_of_death);
        const formattedDate = date.toLocaleDateString(lang === 'en' ? 'en-US' : 'he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('popup-victim-date').textContent = formattedDate;

        // Victim location
        document.getElementById('popup-victim-location').textContent = incident.victim.location;

        // Victim description
        const description = lang === 'en' ? incident.victim.description_en : incident.victim.description_he;
        const descriptionElement = document.getElementById('popup-victim-description');
        if (description) {
            descriptionElement.textContent = description;
            descriptionElement.style.display = 'block';
        } else {
            descriptionElement.style.display = 'none';
        }

        // Militant information
        const militantName = lang === 'en' ? incident.militant.name_en : incident.militant.name_he;
        const militantNameBilingual = `${incident.militant.name_en} (${incident.militant.name_he})`;
        document.getElementById('popup-militant-name').textContent = militantNameBilingual;

        // Militant age
        if (incident.militant.age_at_release) {
            document.getElementById('popup-militant-age').textContent = incident.militant.age_at_release;
            document.getElementById('popup-militant-age-container').style.display = 'block';
        } else {
            document.getElementById('popup-militant-age-container').style.display = 'none';
        }

        // Militant affiliation
        if (incident.militant.affiliation) {
            document.getElementById('popup-militant-affiliation').textContent = incident.militant.affiliation;
            document.getElementById('popup-militant-affiliation-container').style.display = 'block';
        } else {
            document.getElementById('popup-militant-affiliation-container').style.display = 'none';
        }

        // Deal name
        const deal = dataLoader.getDealById(incident.deal_id);
        const dealName = deal ? (lang === 'en' ? deal.name_en : deal.name_he) : incident.deal_id;
        document.getElementById('popup-deal-name').textContent = dealName;

        // Sources
        this.populateSources(incident.sources);
    }

    /**
     * Populate sources list
     */
    populateSources(sources) {
        const sourcesList = document.getElementById('popup-sources-list');
        sourcesList.innerHTML = '';

        sources.forEach(source => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = source.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = `${source.publisher} - ${source.title}`;
            li.appendChild(link);
            sourcesList.appendChild(li);
        });
    }

    /**
     * Handle expansion button visibility and click handler
     */
    handleExpansionButton(incident, nodeRef) {
        const expansionBtn = document.getElementById('popup-expand-victims-btn');
        if (!expansionBtn) return;

        const isOct7Massacre = nodeRef && nodeRef.id === 'oct7_massacre_group';
        const isDesktop = window.innerWidth >= 768;

        if (isOct7Massacre && isDesktop) {
            expansionBtn.style.display = 'block';

            // Remove old listeners to prevent duplicates
            const newBtn = expansionBtn.cloneNode(true);
            expansionBtn.parentNode.replaceChild(newBtn, expansionBtn);

            // Add click handler
            newBtn.addEventListener('click', () => {
                this.close();
                graph.expandMassacre(nodeRef);
            });
        } else {
            expansionBtn.style.display = 'none';
        }
    }

    /**
     * Refresh popup content (e.g., after language change)
     */
    refresh() {
        if (this.currentIncident) {
            this.populate(this.currentIncident);
            this.handleExpansionButton(this.currentIncident, this.currentNodeRef);
        }
    }
}

// Create global popup instance
const popup = new Popup();

/**
 * Deal popup modal module
 * Shows detailed information about a deal including recidivism statistics
 */

class DealPopup {
    constructor() {
        this.popup = null;
        this.closeButton = null;
        this.currentDeal = null;
    }

    /**
     * Initialize popup
     */
    init() {
        this.popup = document.getElementById('deal-popup');
        this.closeButton = document.getElementById('deal-popup-close');

        // Close button click
        this.closeButton.addEventListener('click', () => this.close());

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
     * Open popup with deal data
     */
    open(deal) {
        this.currentDeal = deal;
        this.populate(deal);
        this.popup.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    /**
     * Close popup
     */
    close() {
        this.popup.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
        this.currentDeal = null;
    }

    /**
     * Check if popup is open
     */
    isOpen() {
        return this.popup.style.display === 'flex';
    }

    /**
     * Populate popup with deal data
     */
    populate(deal) {
        const lang = i18n.getCurrentLanguage();

        // Deal name (bilingual)
        const dealName = `${deal.name_en} (${deal.name_he})`;
        document.getElementById('deal-popup-name').textContent = dealName;

        // Deal date
        const date = new Date(deal.date);
        const formattedDate = date.toLocaleDateString(lang === 'en' ? 'en-US' : 'he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('deal-popup-date').textContent = formattedDate;

        // Prisoners released
        const prisonersReleased = deal.num_prisoners_released !== null && deal.num_prisoners_released !== undefined
            ? deal.num_prisoners_released.toLocaleString()
            : i18n.translate('unknown') || 'Unknown';
        document.getElementById('deal-popup-prisoners').textContent = prisonersReleased;

        // Israelis released
        const israelisReleased = deal.num_israelis_released !== null && deal.num_israelis_released !== undefined
            ? deal.num_israelis_released.toLocaleString()
            : i18n.translate('unknown') || 'Unknown';
        document.getElementById('deal-popup-israelis').textContent = israelisReleased;

        // Description
        const description = lang === 'en' ? deal.description_en : deal.description_he;
        const descriptionElement = document.getElementById('deal-popup-description');
        if (description) {
            descriptionElement.textContent = description;
            descriptionElement.style.display = 'block';
        } else {
            descriptionElement.style.display = 'none';
        }

        // Sources (if available)
        if (deal.sources && deal.sources.length > 0) {
            this.populateDealSources(deal.sources);
            document.getElementById('deal-popup-sources-container').style.display = 'block';
        } else {
            document.getElementById('deal-popup-sources-container').style.display = 'none';
        }

        // Recidivism statistics
        if (deal.recidivism_stats) {
            this.populateRecidivismStats(deal.recidivism_stats, lang);
            document.getElementById('deal-popup-recidivism-section').style.display = 'block';
        } else {
            document.getElementById('deal-popup-recidivism-section').style.display = 'none';
        }
    }

    /**
     * Populate deal sources list
     */
    populateDealSources(sources) {
        const sourcesList = document.getElementById('deal-popup-sources-list');
        sourcesList.innerHTML = '';

        sources.forEach(source => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = source.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = `${source.publisher} - ${source.title}`;
            li.appendChild(link);
            sourcesList.appendChild(li);
        });
    }

    /**
     * Populate recidivism statistics
     */
    populateRecidivismStats(stats, lang) {
        // Recidivism rate
        if (stats.recidivism_rate !== null && stats.recidivism_rate !== undefined) {
            document.getElementById('deal-popup-recidivism-rate').textContent = `${stats.recidivism_rate}%`;
            document.getElementById('deal-popup-recidivism-rate-container').style.display = 'block';
        } else {
            document.getElementById('deal-popup-recidivism-rate-container').style.display = 'none';
        }

        // Prisoners returned to terrorism
        if (stats.prisoners_returned_to_terrorism !== null && stats.prisoners_returned_to_terrorism !== undefined) {
            document.getElementById('deal-popup-prisoners-returned').textContent = stats.prisoners_returned_to_terrorism.toLocaleString();
            document.getElementById('deal-popup-prisoners-returned-container').style.display = 'block';
        } else {
            document.getElementById('deal-popup-prisoners-returned-container').style.display = 'none';
        }

        // Unverified casualties
        if (stats.claimed_israeli_casualties !== null && stats.claimed_israeli_casualties !== undefined) {
            document.getElementById('deal-popup-claimed-casualties').textContent = stats.claimed_israeli_casualties.toLocaleString();
            document.getElementById('deal-popup-claimed-casualties-container').style.display = 'block';
        } else {
            document.getElementById('deal-popup-claimed-casualties-container').style.display = 'none';
        }

        // Get casualty counts
        const casualties = dataLoader.getCasualtiesByType(this.currentDeal.id);
        const verifiedTotal = casualties.total;

        // Verified casualties (merged)
        if (verifiedTotal > 0) {
            document.getElementById('deal-popup-verified-casualties').textContent = verifiedTotal.toLocaleString();
            document.getElementById('deal-popup-verified-casualties-container').style.display = 'block';
        } else {
            document.getElementById('deal-popup-verified-casualties-container').style.display = 'none';
        }

        // Source organization
        if (stats.source_organization) {
            document.getElementById('deal-popup-source-org').textContent = stats.source_organization;
            document.getElementById('deal-popup-source-org-container').style.display = 'block';
        } else {
            document.getElementById('deal-popup-source-org-container').style.display = 'none';
        }

        // Citation
        if (stats.source_citation) {
            const citationElement = document.getElementById('deal-popup-citation');
            // Check if citation contains a URL
            const urlMatch = stats.source_citation.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                const url = urlMatch[1];
                const textBeforeUrl = stats.source_citation.substring(0, urlMatch.index).trim();
                citationElement.innerHTML = '';
                if (textBeforeUrl) {
                    citationElement.appendChild(document.createTextNode(textBeforeUrl + ' '));
                }
                const link = document.createElement('a');
                link.href = url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = '[Source]';
                citationElement.appendChild(link);
            } else {
                citationElement.textContent = stats.source_citation;
            }
            document.getElementById('deal-popup-citation-container').style.display = 'block';
        } else {
            document.getElementById('deal-popup-citation-container').style.display = 'none';
        }

        // Additional notes
        const notes = lang === 'en' ? stats.notes_en : stats.notes_he;
        if (notes) {
            document.getElementById('deal-popup-notes').textContent = notes;
            document.getElementById('deal-popup-notes-container').style.display = 'block';
        } else {
            document.getElementById('deal-popup-notes-container').style.display = 'none';
        }
    }

    /**
     * Refresh popup content (e.g., after language change)
     */
    refresh() {
        if (this.currentDeal) {
            this.populate(this.currentDeal);
        }
    }
}

// Create global deal popup instance
const dealPopup = new DealPopup();
