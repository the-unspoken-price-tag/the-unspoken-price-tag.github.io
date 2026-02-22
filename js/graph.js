/**
 * D3.js graph visualization module
 * Creates force-directed graph of deals and incidents
 */

class Graph {
    constructor() {
        this.svg = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.width = 0;
        this.height = 0;
        this.filteredNodes = new Set(); // Track filtered out deal nodes
        this.filteredIncidents = new Set(); // Track filtered out incident nodes
        this.contextMenu = null; // Context menu element
        this.lastWidth = window.innerWidth; // Track for resize detection
        this.container = null; // Store container reference for zoom
        this.defaultZoomTransform = null; // Store default zoom transform for restoration
        this.zoomBehavior = null; // Store zoom behavior for programmatic zoom
        this.touchTimer = null; // Timer for long-press detection
        this.touchStartPos = null; // Store touch start position
        this.longPressTriggered = false; // Flag to indicate long-press was triggered
    }

    /**
     * Detect if current device is mobile
     */
    isMobileDevice() {
        return window.innerWidth < 768;
    }

    /**
     * Initialize graph
     */
    init(containerSelector = '#graph-svg') {
        this.svg = d3.select(containerSelector);
        this.updateDimensions();

        // Create context menu
        this.createContextMenu();

        // Handle window resize with debouncing
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const wasResizeToMobile = this.lastWidth >= 768 && window.innerWidth < 768;
                const wasResizeToDesktop = this.lastWidth < 768 && window.innerWidth >= 768;
                this.lastWidth = window.innerWidth;

                this.updateDimensions();

                // If resizing to mobile and massacre is expanded, collapse it
                if (wasResizeToMobile) {
                    this.collapseAllMassacres();
                }

                // Re-apply initial zoom if crossing mobile threshold
                if (wasResizeToMobile || wasResizeToDesktop) {
                    this.applyInitialZoom(true); // Animate on resize
                } else {
                    this.restart();
                }

                // Update zoom boundaries after resize
                this.updateZoomBehavior();
            }, 250);
        });

        // Hide context menu on any click
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });
    }

    /**
     * Update SVG dimensions based on container
     */
    updateDimensions() {
        const container = document.getElementById('graph-container');
        if (container) {
            this.width = container.clientWidth;
            this.height = Math.max(600, window.innerHeight * 0.6);
            this.svg
                .attr('width', this.width)
                .attr('height', this.height);
        }
    }

    /**
     * Apply initial zoom based on device type
     * @param {boolean} animate - Whether to animate the transition (default: false)
     */
    applyInitialZoom(animate = false) {
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.container.attr('transform', event.transform);
                this.updateNodeVisibility(event.transform.k);
            });

        // Set initial translate extent
        const bounds = this.calculateBoundingBox();
        zoom.translateExtent([
            [bounds.minX, bounds.minY],
            [bounds.maxX, bounds.maxY]
        ]);

        this.svg.call(zoom);
        this.zoomBehavior = zoom; // Store for programmatic zoom

        const isMobile = this.isMobileDevice();
        const initialScale = isMobile ? 0.35 : 0.7;

        // Desktop: slightly left of center
        // Mobile: centered on Shalit (which is at startX = width/2)
        // Note: spacing multiplier matches render() - 2x on mobile, 0.45x on desktop
        const spacing = isMobile ? 2 : 0.45;
        const centerX = isMobile
            ? this.width / 2  // Centered on Shalit at screen center
            : this.width / 2 - this.width * 0.03;     // Slightly left of center
        const centerY = this.height / 2;

        const initialTransform = d3.zoomIdentity
            .translate(this.width / 2, this.height / 2)
            .scale(initialScale)
            .translate(-centerX, -centerY);

        this.defaultZoomTransform = initialTransform; // Store for restoration

        // Always apply the transform immediately to avoid visual jump on first load
        // Using a 1ms transition as a workaround to ensure proper rendering timing
        this.svg.transition()
            .duration(animate ? 750 : 1)
            .call(zoom.transform, initialTransform);

        // Update node visibility (will be called by zoom handler, but ensure it's applied)
        this.updateNodeVisibility(initialScale);
    }

    /**
     * Create context menu element
     */
    createContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.id = 'node-context-menu';
        this.contextMenu.className = 'context-menu';
        this.contextMenu.style.display = 'none';
        document.body.appendChild(this.contextMenu);
    }

    /**
     * Show context menu at position
     */
    showContextMenu(x, y, nodeData) {
        // Get translated text
        let removeText = 'Remove node'; // Default fallback

        if (typeof i18n !== 'undefined') {
            const currentLang = i18n.getCurrentLanguage();
            const translated = i18n.translate('remove_node');

            console.log('Context menu translation:', {
                currentLang: currentLang,
                requestedKey: 'remove_node',
                translatedValue: translated,
                translationsLoaded: !!i18n.translations[currentLang]
            });

            // Use translated text if it's different from the key (meaning translation was found)
            if (translated !== 'remove_node') {
                removeText = translated;
            } else if (currentLang === 'he') {
                // Hardcoded fallback for Hebrew if translation not loaded
                removeText = 'הסר צומת';
                console.warn('Using hardcoded Hebrew fallback');
            }
        } else {
            console.error('i18n not available');
        }

        this.contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="remove">
                ${removeText}
            </div>
        `;

        // Position context menu accounting for viewport
        const menuWidth = 150;
        const menuHeight = 40;
        const maxX = window.innerWidth - menuWidth;
        const maxY = window.innerHeight - menuHeight;

        this.contextMenu.style.left = Math.min(x, maxX) + 'px';
        this.contextMenu.style.top = Math.min(y, maxY) + 'px';
        this.contextMenu.style.display = 'block';

        // Add click handler for menu item
        const menuItem = this.contextMenu.querySelector('[data-action="remove"]');
        menuItem.onclick = (e) => {
            e.stopPropagation();
            this.filterNode(nodeData);
            this.hideContextMenu();
        };
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
        }
    }

    /**
     * Handle touch start for long-press detection (iOS support)
     */
    handleTouchStart(event, nodeData) {
        // Stop propagation to prevent drag/zoom from interfering
        event.stopPropagation();

        // Reset long-press flag
        this.longPressTriggered = false;

        // Store touch position immediately (event won't be valid in setTimeout)
        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;

        this.touchStartPos = {
            x: touchX,
            y: touchY
        };

        console.log('Touch start on node:', nodeData.id, 'at', touchX, touchY);

        // Set timer for long-press (500ms)
        this.touchTimer = setTimeout(() => {
            console.log('Long press triggered for node:', nodeData.id);

            // Mark that long-press was triggered
            this.longPressTriggered = true;

            // Show context menu using stored coordinates
            this.showContextMenu(touchX, touchY, nodeData);

            // Vibrate if available (haptic feedback)
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 500);
    }

    /**
     * Handle touch end/cancel to clear long-press timer
     */
    handleTouchEnd(event) {
        console.log('Touch end, longPressTriggered:', this.longPressTriggered);

        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
            console.log('Cleared touch timer (touch ended before 500ms)');
        }

        // If long-press was triggered, prevent the click event from firing
        if (this.longPressTriggered) {
            event.preventDefault();
            event.stopPropagation();
            console.log('Prevented click after long-press');

            // Reset flag after a short delay
            setTimeout(() => {
                this.longPressTriggered = false;
            }, 100);
        }
    }

    /**
     * Handle touch move to cancel long-press if user moves finger
     */
    handleTouchMove(event) {
        if (!this.touchStartPos || !this.touchTimer) return;

        const moveThreshold = 10; // pixels
        const touch = event.touches[0];
        const deltaX = Math.abs(touch.clientX - this.touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - this.touchStartPos.y);

        // If user moved finger too much, cancel long-press
        if (deltaX > moveThreshold || deltaY > moveThreshold) {
            console.log('Touch moved too much, canceling long-press');
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }
    }

    /**
     * Attach touch handlers to a node element using native DOM API
     * This ensures passive:false so we can preventDefault
     */
    attachTouchHandlers(element, nodeData) {
        if (!element) {
            console.error('attachTouchHandlers: element is null');
            return;
        }

        const self = this;

        try {
            element.addEventListener('touchstart', function(event) {
                self.handleTouchStart(event, nodeData);
            }, { passive: false });

            element.addEventListener('touchend', function(event) {
                self.handleTouchEnd(event);
            }, { passive: false });

            element.addEventListener('touchmove', function(event) {
                self.handleTouchMove(event);
            }, { passive: false });
        } catch (error) {
            console.error('Error attaching touch handlers:', error);
        }
    }

    /**
     * Filter (remove) a node from the graph
     */
    filterNode(nodeData) {
        console.log('Filtering node:', nodeData);

        // Handle different node types
        if (nodeData.type === 'deal' || nodeData.type === 'deal-group') {
            // Add deal to filtered set
            this.filteredNodes.add(nodeData.id);

            // If this is a deal-group, also add all child deal IDs
            if (nodeData.type === 'deal-group' && nodeData.childDeals) {
                nodeData.childDeals.forEach(childDeal => {
                    this.filteredNodes.add(childDeal.id);
                    console.log('Also filtering child deal:', childDeal.id);
                });
            }
        } else if (nodeData.type === 'incident' || nodeData.type === 'victim' || nodeData.type === 'massacre') {
            // Add incident to filtered incidents set
            this.filteredIncidents.add(nodeData.id);
            console.log('Filtering incident/massacre node:', nodeData.id);

            // If this is a massacre, also add all child victim IDs
            if (nodeData.type === 'massacre' && nodeData.childIncidents) {
                console.log('Massacre has', nodeData.childIncidents.length, 'child incidents');
                nodeData.childIncidents.forEach(childIncident => {
                    this.filteredIncidents.add(childIncident.id);
                    console.log('Also filtering child incident:', childIncident.id);
                });
            }

            // If this is a victim node (expanded from massacre), also mark the parent massacre
            if (nodeData.type === 'victim' && nodeData.data) {
                this.filteredIncidents.add(nodeData.data.id);
                console.log('Also filtering victim data ID:', nodeData.data.id);
            }
        }

        console.log('Filtered nodes:', Array.from(this.filteredNodes));
        console.log('Filtered incidents:', Array.from(this.filteredIncidents));

        // Update node visibility
        this.updateFilteredVisibility();

        // Update statistics with filtered deals
        this.updateStatisticsWithFilters();

        // Show reset button
        this.showResetButton();

        // Update zoom boundaries after filtering
        this.updateZoomBehavior();
    }

    /**
     * Reset all filters
     */
    resetFilters() {
        // Clear filtered nodes and incidents
        this.filteredNodes.clear();
        this.filteredIncidents.clear();

        // Update node visibility
        this.updateFilteredVisibility();

        // Update statistics without filters
        this.updateStatisticsWithFilters();

        // Hide reset button
        this.hideResetButton();

        // Update zoom boundaries after reset
        this.updateZoomBehavior();
    }

    /**
     * Update node visibility based on filters
     */
    updateFilteredVisibility() {
        if (!this.nodeSelection) return;

        const self = this;
        this.nodeSelection.each(function(d) {
            const node = d3.select(this);
            const isDealFiltered = self.filteredNodes.has(d.id) ||
                                  (d.data && self.filteredNodes.has(d.data.deal_id)) ||
                                  (d.parentGroup && self.filteredNodes.has(d.parentGroup));
            const isIncidentFiltered = self.filteredIncidents.has(d.id) ||
                                      (d.parentMassacre && self.filteredIncidents.has(d.parentMassacre));

            if (isDealFiltered || isIncidentFiltered) {
                node.style('display', 'none');
            } else if (!d.hidden) {
                node.style('display', 'block');
            }
        });

        // Also update link visibility
        if (this.linkSelection) {
            this.linkSelection.each(function(d) {
                const link = d3.select(this);
                const sourceDealFiltered = self.filteredNodes.has(d.source.id) ||
                                          (d.source.parentGroup && self.filteredNodes.has(d.source.parentGroup));
                const sourceIncidentFiltered = self.filteredIncidents.has(d.source.id) ||
                                              (d.source.parentMassacre && self.filteredIncidents.has(d.source.parentMassacre));
                const targetDealFiltered = self.filteredNodes.has(d.target.id) ||
                                          (d.target.data && self.filteredNodes.has(d.target.data.deal_id)) ||
                                          (d.target.parentGroup && self.filteredNodes.has(d.target.parentGroup));
                const targetIncidentFiltered = self.filteredIncidents.has(d.target.id) ||
                                              (d.target.parentMassacre && self.filteredIncidents.has(d.target.parentMassacre));

                if (sourceDealFiltered || sourceIncidentFiltered || targetDealFiltered || targetIncidentFiltered) {
                    link.style('display', 'none');
                } else {
                    const sourceHidden = d.source.hidden;
                    const targetHidden = d.target.hidden;
                    link.style('display', (sourceHidden || targetHidden) ? 'none' : 'block');
                }
            });
        }
    }

    /**
     * Update statistics with current filters
     */
    updateStatisticsWithFilters() {
        if (typeof dataLoader !== 'undefined' && typeof statistics !== 'undefined') {
            const filteredData = this.getFilteredData();
            if (filteredData) {
                console.log('Updating statistics with filtered data:', {
                    deals: filteredData.deals.length,
                    incidents: filteredData.incidents.length,
                    metadata: filteredData.metadata
                });
                statistics.update(filteredData, false); // Don't animate
            } else {
                console.error('Failed to get filtered data');
            }
        } else {
            console.error('dataLoader or statistics not available');
        }
    }

    /**
     * Get data excluding filtered nodes
     */
    getFilteredData() {
        if (typeof dataLoader === 'undefined' || !dataLoader.data) {
            console.error('dataLoader.data not available');
            return null;
        }

        const data = dataLoader.data;
        console.log('Original data:', {
            deals: data.deals.length,
            incidents: data.incidents.length
        });
        console.log('Filtered node IDs:', Array.from(this.filteredNodes));
        console.log('Filtered incident IDs:', Array.from(this.filteredIncidents));

        // Check which claimed casualty incidents are filtered
        // These are special aggregate incidents representing unverified casualties
        const claimedCasualtiesMap = new Map(); // dealId -> total to subtract
        this.filteredIncidents.forEach(incidentId => {
            const incident = data.incidents.find(inc => inc.id === incidentId);
            if (incident && incidentId.includes('_claimed_')) {
                const dealId = incident.deal_id;
                // For these special incidents, we need to get the deal's total claimed casualties
                // since each represents the entire count for that deal
                const deal = data.deals.find(d => d.id === dealId);
                if (deal && deal.recidivism_stats && deal.recidivism_stats.claimed_israeli_casualties) {
                    const claimedCount = deal.recidivism_stats.claimed_israeli_casualties;
                    claimedCasualtiesMap.set(dealId, claimedCount);
                    console.log('Filtering claimed casualty:', incidentId, 'from deal:', dealId, 'count:', claimedCount);
                }
            }
        });

        // Filter out deals that have been filtered, and adjust recidivism stats for claimed casualties
        const filteredDeals = data.deals
            .filter(deal => !this.filteredNodes.has(deal.id))
            .map(deal => {
                // If this deal has filtered claimed casualties, adjust the recidivism stats
                const filteredClaimedCount = claimedCasualtiesMap.get(deal.id) || 0;
                if (filteredClaimedCount > 0 && deal.recidivism_stats) {
                    console.log('Adjusting deal', deal.id, 'claimed casualties from',
                        deal.recidivism_stats.claimed_israeli_casualties, 'by', filteredClaimedCount);

                    return {
                        ...deal,
                        recidivism_stats: {
                            ...deal.recidivism_stats,
                            claimed_israeli_casualties: Math.max(0,
                                (deal.recidivism_stats.claimed_israeli_casualties || 0) - filteredClaimedCount
                            )
                        }
                    };
                }
                return deal;
            });

        // Filter out incidents that:
        // 1. Belong to a filtered deal
        // 2. Have been individually filtered
        const filteredIncidents = data.incidents.filter(inc => {
            const dealFiltered = this.filteredNodes.has(inc.deal_id);
            const incidentFiltered = this.filteredIncidents.has(inc.id);
            const shouldExclude = dealFiltered || incidentFiltered;

            if (shouldExclude) {
                console.log('Excluding incident:', inc.id, 'dealFiltered:', dealFiltered, 'incidentFiltered:', incidentFiltered);
            }

            return !shouldExclude;
        });

        console.log('Filtered data:', {
            deals: filteredDeals.length,
            incidents: filteredIncidents.length,
            excludedIncidents: data.incidents.length - filteredIncidents.length
        });

        return {
            ...data,
            deals: filteredDeals,
            incidents: filteredIncidents,
            metadata: {
                ...data.metadata,
                total_deals: filteredDeals.length
            }
        };
    }

    /**
     * Show reset filter button
     */
    showResetButton() {
        const resetBtn = document.getElementById('reset-filters-btn');
        if (resetBtn && (this.filteredNodes.size > 0 || this.filteredIncidents.size > 0)) {
            resetBtn.style.display = 'block';
        }
    }

    /**
     * Hide reset filter button
     */
    hideResetButton() {
        const resetBtn = document.getElementById('reset-filters-btn');
        if (resetBtn && this.filteredNodes.size === 0 && this.filteredIncidents.size === 0) {
            resetBtn.style.display = 'none';
        }
    }

    /**
     * Render graph with data
     */
    render(graphData) {
        console.log('Graph render() called, isMobile:', this.isMobileDevice());
        const isMobile = this.isMobileDevice();

        // Include all nodes on both mobile and desktop
        this.nodes = graphData.nodes;
        this.links = graphData.links;
        console.log('Nodes:', this.nodes.length, 'Links:', this.links.length);

        // Clear existing content
        this.svg.selectAll('*').remove();

        // Create container group
        this.container = this.svg.append('g');

        // Create arrow markers for links
        const g = this.container;
        this.svg.append('defs').selectAll('marker')
            .data(['end'])
            .enter().append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 25)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#999');

        // Create links
        const link = g.append('g')
            .selectAll('line')
            .data(this.links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-width', 2);

        // Create nodes
        const node = g.append('g')
            .selectAll('g')
            .data(this.nodes)
            .enter().append('g')
            .attr('class', d => `node node-${d.type}`);

        // Only apply drag behavior on desktop (not on mobile/touch devices)
        if (!isMobile) {
            node.call(this.drag());
        }

        // Add circles to nodes
        node.append('circle')
            .attr('r', d => this.getNodeRadius(d))
            .attr('fill', d => {
                if (d.type === 'deal') return '#2196F3';
                if (d.type === 'deal-group') return '#2196F3';
                if (d.type === 'massacre') return '#F44336';
                return '#F44336';
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

        // Add count labels inside circles
        node.append('text')
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('class', 'node-count')
            .style('fill', '#fff')
            .style('font-weight', 'bold')
            .style('font-size', d => {
                const radius = this.getNodeRadius(d);
                if (d.type === 'victim') {
                    // Victim nodes get very small font
                    return '6px';
                }
                // Scale font size with node radius (min 10px, max 18px)
                return Math.max(10, Math.min(18, radius * 0.35)) + 'px';
            })
            .style('pointer-events', 'none')
            .text(d => this.getNodeCount(d));

        // Add name labels below nodes
        node.append('text')
            .attr('dy', d => {
                const baseOffset = this.getNodeRadius(d);
                // On mobile, add extra spacing for deal nodes
                const extraOffset = isMobile && (d.type === 'deal' || d.type === 'deal-group') ? 28 : 18;
                return baseOffset + extraOffset;
            })
            .attr('text-anchor', 'middle')
            .attr('class', 'node-label')
            .text(d => {
                const lang = i18n.getCurrentLanguage();
                return lang === 'en' ? d.name_en : d.name_he;
            });


        // Add click handler for incident nodes (collapse massacre and open popup)
        node.filter(d => d.type === 'incident')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                this.collapseAllMassacres();
                popup.open(d.data);
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event.clientX, event.clientY, d);
            })
            .each((d, i, nodes) => {
                // Add touch handlers using native DOM API on mobile
                if (isMobile) {
                    this.attachTouchHandlers(nodes[i], d);
                }
            });

        // Add click handler for deal nodes (collapse massacre and open popup)
        node.filter(d => d.type === 'deal')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                this.collapseAllMassacres();
                dealPopup.open(d.data);
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event.clientX, event.clientY, d);
            })
            .each((d, i, nodes) => {
                // Add touch handlers using native DOM API on mobile
                if (isMobile) {
                    this.attachTouchHandlers(nodes[i], d);
                }
            });

        // Add click handler for deal-group nodes (expand/collapse)
        node.filter(d => d.type === 'deal-group')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                this.collapseAllMassacres();
                this.toggleDealGroup(d);
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event.clientX, event.clientY, d);
            })
            .each((d, i, nodes) => {
                // Add touch handlers using native DOM API on mobile
                if (isMobile) {
                    this.attachTouchHandlers(nodes[i], d);
                }
            });

        // Add click handler for massacre nodes
        node.filter(d => d.type === 'massacre')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();

                // October 7 massacre always opens popup first (desktop gets expand button)
                if (d.id === 'oct7_massacre_group') {
                    this.collapseAllMassacres();
                    popup.open(d.data, d);
                } else {
                    this.toggleMassacreExpansion(d);
                }
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event.clientX, event.clientY, d);
            })
            .each((d, i, nodes) => {
                // Add touch handlers using native DOM API on mobile
                if (isMobile) {
                    this.attachTouchHandlers(nodes[i], d);
                }
            });

        // Add click handler for victim nodes (show popup without collapsing)
        node.filter(d => d.type === 'victim')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                popup.open(d.data);
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event.clientX, event.clientY, d);
            })
            .each((d, i, nodes) => {
                // Add touch handlers using native DOM API on mobile
                if (isMobile) {
                    this.attachTouchHandlers(nodes[i], d);
                }
            });

        // Add click handler for SVG background to collapse everything
        this.svg.on('click', () => {
            this.collapseAllMassacres();
            this.collapseDealGroup();
        });

        // Add hover effects
        node.on('mouseenter', (event, d) => {
            const baseRadius = this.getNodeRadius(d);
            d3.select(event.currentTarget).select('circle')
                .transition()
                .duration(200)
                .attr('r', baseRadius * 1.15);
        })
        .on('mouseleave', (event, d) => {
            const baseRadius = this.getNodeRadius(d);
            d3.select(event.currentTarget).select('circle')
                .transition()
                .duration(200)
                .attr('r', baseRadius);
        });

        // Position deal nodes: main deals at center, others in outer ring
        const dealNodes = this.nodes.filter(d => d.type === 'deal' || d.type === 'deal-group');
        dealNodes.sort((a, b) => new Date(a.data.date) - new Date(b.data.date));

        // Main deals to show at center (Jibril 1985, Tannenbaum 2004, Shalit 2011)
        const mainDealIds = ['jibril_agreement', 'tannenbaum_exchange', 'gilad_shalit'];
        const mainDeals = dealNodes.filter(d => mainDealIds.includes(d.id));
        const otherDeals = dealNodes.filter(d => !mainDealIds.includes(d.id));

        // Position main deals: Shalit at center, Jibril and Tannenbaum on sides
        // Mobile: wider spacing (1.7x) for more focused view
        // Desktop: moderate spacing (0.45x) for balanced layout
        const spacing = this.width * (isMobile ? 1.7 : 0.45);
        const startX = this.width / 2; // Start at center

        mainDeals.forEach((deal, i) => {
            let offset;
            // Same layout on both mobile and desktop: Shalit center, Jibril left, Tannenbaum right
            if (deal.id === 'gilad_shalit') {
                offset = 0; // Center
            } else if (deal.id === 'jibril_agreement') {
                offset = -1; // Left of center
            } else if (deal.id === 'tannenbaum_exchange') {
                offset = 0.75; // Right of center, slightly closer
            } else {
                offset = i * 2; // Other deals spread out (fallback)
            }

            deal.x = startX + offset * spacing;
            deal.y = this.height / 2;
            deal.fx = startX + offset * spacing;
            deal.fy = this.height / 2;
            deal.isMainDeal = true;
        });

        // Position other deals surrounding the main deals
        // Mobile: circular arrangement far out
        // Desktop: rectangular arrangement for structured layout
        if (isMobile) {
            // Mobile: elliptical arrangement - horizontal radius large, vertical compressed
            const horizontalRadius = Math.max(this.width, this.height) * 2.0;
            const verticalRadius = horizontalRadius * 0.4; // Compression factor
            const angleStep = (2 * Math.PI) / otherDeals.length;
            otherDeals.forEach((deal, i) => {
                const angle = i * angleStep;
                deal.x = this.width / 2 + horizontalRadius * Math.cos(angle);
                deal.y = this.height / 2 + verticalRadius * Math.sin(angle);

                deal.fx = deal.x;
                deal.fy = deal.y;
                deal.isMainDeal = false;
            });
        } else {
            // Desktop: two horizontal stripes (top and bottom)
            const stripeWidth = this.width * 1.1;
            const verticalOffset = this.height * 0.58; // Distance from center
            const centerX = this.width / 2;
            const centerY = this.height / 2;

            // Split deals into top and bottom stripes
            const dealsPerStripe = Math.ceil(otherDeals.length / 2);

            otherDeals.forEach((deal, i) => {
                const isTopStripe = i < dealsPerStripe;
                const indexInStripe = isTopStripe ? i : i - dealsPerStripe;
                const totalInStripe = isTopStripe ? dealsPerStripe : (otherDeals.length - dealsPerStripe);

                // Position evenly along the stripe
                const spacing = stripeWidth / (totalInStripe + 1);
                deal.x = centerX - stripeWidth / 2 + spacing * (indexInStripe + 1);
                deal.y = isTopStripe ? centerY - verticalOffset : centerY + verticalOffset;

                // Special adjustment: Move Gaza deals group upward
                if (deal.id && (deal.id.includes('gaza') || deal.id === 'gaza_deals_group')) {
                    deal.y -= this.height * 0.25; // Move up by 25% of viewport height
                }

                deal.fx = deal.x;
                deal.fy = deal.y;
                deal.isMainDeal = false;
            });
        }

        // Position incident and massacre nodes in a circle around their deal
        const incidentNodes = this.nodes.filter(d => d.type === 'incident' || d.type === 'massacre');
        const incidentsByDeal = {};

        // Group incidents by deal
        incidentNodes.forEach(incident => {
            const link = this.links.find(l => l.target === incident.id || l.target.id === incident.id);
            if (link) {
                const dealId = typeof link.source === 'string' ? link.source : link.source.id;
                if (!incidentsByDeal[dealId]) {
                    incidentsByDeal[dealId] = [];
                }
                incidentsByDeal[dealId].push(incident);
            }
        });

        // Position incidents radially around each deal
        Object.keys(incidentsByDeal).forEach(dealId => {
            const deal = dealNodes.find(d => d.id === dealId);
            const incidents = incidentsByDeal[dealId];

            // Adjust radius based on device and node type
            let radius;
            const hasOct7Massacre = incidents.some(inc => inc.id === 'oct7_massacre_group');

            if (isMobile) {
                // Mobile: different radii based on deal
                if (hasOct7Massacre) {
                    // October 7 massacre: furthest out
                    radius = 240;
                } else if (dealId === 'jibril_agreement' || dealId === 'tannenbaum_exchange') {
                    // Jibril and Tannenbaum incidents: medium distance
                    radius = 150;
                } else {
                    // Other Shalit incidents: close to center
                    radius = 100;
                }
            } else {
                // Desktop: October 7 further out, others at shorter distance
                if (hasOct7Massacre) {
                    // October 7 massacre: further out to avoid clutter
                    radius = 210;
                } else {
                    // Other incidents: shorter radius for tighter layout
                    radius = 140;
                }
            }

            const angleStep = (2 * Math.PI) / incidents.length;

            incidents.forEach((incident, i) => {
                const angle = i * angleStep;
                incident.x = deal.x + radius * Math.cos(angle);
                incident.y = deal.y + radius * Math.sin(angle);
            });
        });

        // No force simulation - use pre-calculated positions for both mobile and desktop
        // Manually resolve link source/target IDs to node objects
        // (D3's forceLink normally does this, but we're skipping simulation)
        const nodeById = new Map(this.nodes.map(n => [n.id, n]));
        this.links.forEach(link => {
            if (typeof link.source === 'string') {
                link.source = nodeById.get(link.source) || link.source;
            }
            if (typeof link.target === 'string') {
                link.target = nodeById.get(link.target) || link.target;
            }
        });

        // Position nodes and links directly at calculated positions (no animation)
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);

        // Set simulation to null since we're not using it
        this.simulation = null;

        // Store references for updates
        this.linkSelection = link;
        this.nodeSelection = node;

        // Apply initial zoom after nodes are created
        this.applyInitialZoom();

        // Update zoom boundaries after initial render (with delay to ensure zoom is applied)
        setTimeout(() => this.updateZoomBehavior(), 100);
    }

    /**
     * Update node visibility based on filters
     * Note: Zoom-based visibility is disabled - all nodes remain visible at all zoom levels
     */
    updateNodeVisibility(scale) {
        if (!this.nodeSelection) return;

        const isMobile = this.isMobileDevice();
        const self = this;

        this.nodeSelection.each(function(d) {
            const node = d3.select(this);

            // Skip visibility updates for filtered nodes
            const isDealFiltered = self.filteredNodes.has(d.id) ||
                                  (d.data && self.filteredNodes.has(d.data.deal_id)) ||
                                  (d.parentGroup && self.filteredNodes.has(d.parentGroup));
            const isIncidentFiltered = self.filteredIncidents.has(d.id) ||
                                      (d.parentMassacre && self.filteredIncidents.has(d.parentMassacre));
            if (isDealFiltered || isIncidentFiltered) return;

            // Both mobile and desktop: Disable zoom-based visibility
            // All visible nodes stay visible at all zoom levels
            // Users can manually filter nodes via right-click if desired
            return;
        });

        // Also update link visibility
        if (this.linkSelection) {
            this.linkSelection.each(function(d) {
                const link = d3.select(this);

                // Skip visibility updates for links to/from filtered nodes
                const sourceDealFiltered = self.filteredNodes.has(d.source.id) ||
                                          (d.source.parentGroup && self.filteredNodes.has(d.source.parentGroup));
                const sourceIncidentFiltered = self.filteredIncidents.has(d.source.id) ||
                                              (d.source.parentMassacre && self.filteredIncidents.has(d.source.parentMassacre));
                const targetDealFiltered = self.filteredNodes.has(d.target.id) ||
                                          (d.target.data && self.filteredNodes.has(d.target.data.deal_id)) ||
                                          (d.target.parentGroup && self.filteredNodes.has(d.target.parentGroup));
                const targetIncidentFiltered = self.filteredIncidents.has(d.target.id) ||
                                              (d.target.parentMassacre && self.filteredIncidents.has(d.target.parentMassacre));
                if (sourceDealFiltered || sourceIncidentFiltered || targetDealFiltered || targetIncidentFiltered) return;

                // Both mobile and desktop: Disable zoom-based visibility for links
                return;
            });
        }
    }

    /**
     * Drag behavior for nodes
     */
    drag() {
        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active && this.simulation) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active && this.simulation) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }

    /**
     * Get count to display on node
     */
    getNodeCount(d) {
        if (d.type === 'deal' || d.type === 'deal-group') {
            // Blue nodes: show number of released Israelis
            return d.data.num_israelis_released || 0;
        } else if (d.type === 'massacre') {
            // Massacre group: show number of child incidents
            return (d.childIncidents && d.childIncidents.length) || 0;
        } else if (d.type === 'incident' || d.type === 'victim') {
            // Check if this is an unverified casualties node by ID
            if (d.data && d.data.id === 'jibril_claimed_001') {
                return 178;
            }
            if (d.data && d.data.id === 'tannenbaum_claimed_001') {
                return 231;
            }
            // Regular incident: 1 victim
            return 1;
        }
        return 0;
    }

    /**
     * Calculate node radius based on count (non-linear scaling)
     * Regular node (count=1) = base radius (20)
     * October 7 (count=1164) = 4x base radius (80)
     */
    getNodeRadius(d) {
        if (d.type === 'victim') {
            // Victim nodes stay small
            return 6;
        }

        // For all other nodes (deals, incidents, massacre), scale by count
        const count = this.getNodeCount(d);
        const baseRadius = 20;

        // Treat count=0 as count=1 (minimum size)
        const effectiveCount = Math.max(1, count);

        // Non-linear scaling: radius = baseRadius * count^0.197
        // This gives: count=1 → r=20, count=1164 → r=80
        const radius = baseRadius * Math.pow(effectiveCount, 0.197);

        return radius;
    }

    /**
     * Calculate bounding box around all visible nodes
     * @returns {Object} { minX, maxX, minY, maxY }
     */
    calculateBoundingBox() {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let visibleCount = 0;

        // Iterate through all nodes
        this.nodes.forEach(node => {
            // Skip filtered nodes
            const isDealFiltered = this.filteredNodes.has(node.id) ||
                                  (node.data && this.filteredNodes.has(node.data.deal_id)) ||
                                  (node.parentGroup && this.filteredNodes.has(node.parentGroup));
            const isIncidentFiltered = this.filteredIncidents.has(node.id) ||
                                      (node.parentMassacre && this.filteredIncidents.has(node.parentMassacre));

            // Skip hidden nodes
            if (node.hidden || isDealFiltered || isIncidentFiltered) {
                return;
            }

            visibleCount++;
            const radius = this.getNodeRadius(node);

            // Include node with its radius
            minX = Math.min(minX, node.x - radius);
            maxX = Math.max(maxX, node.x + radius);
            minY = Math.min(minY, node.y - radius);
            maxY = Math.max(maxY, node.y + radius);
        });

        // Check if expanded massacre victim container exists
        const victimContainer = this.container ? this.container.select('.victim-container') : null;
        if (victimContainer && !victimContainer.empty()) {
            const rect = victimContainer.select('rect');
            const x = parseFloat(rect.attr('x'));
            const y = parseFloat(rect.attr('y'));
            const width = parseFloat(rect.attr('width'));
            const height = parseFloat(rect.attr('height'));

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x + width);
            minY = Math.min(minY, y - 50); // Extra padding above for container label
            maxY = Math.max(maxY, y + height);
        }

        // Edge case: no visible nodes
        if (visibleCount === 0) {
            return {
                minX: -this.width,
                maxX: this.width * 2,
                minY: -this.height,
                maxY: this.height * 2
            };
        }

        // Calculate padding
        const isMobile = this.isMobileDevice();
        const basePadding = isMobile ? 150 : 100;
        const viewportPadding = Math.max(this.width, this.height) * 0.1;
        const padding = Math.max(basePadding, viewportPadding);
        const labelPadding = 50;

        // Apply padding
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding + labelPadding; // Extra padding below for labels

        // Enforce minimum bounding box size (500x500)
        const currentWidth = maxX - minX;
        const currentHeight = maxY - minY;

        if (currentWidth < 500) {
            const centerX = (minX + maxX) / 2;
            minX = centerX - 250;
            maxX = centerX + 250;
        }

        if (currentHeight < 500) {
            const centerY = (minY + maxY) / 2;
            minY = centerY - 250;
            maxY = centerY + 250;
        }

        return { minX, maxX, minY, maxY };
    }

    /**
     * Update zoom behavior's translate extent without changing current view
     */
    updateZoomBehavior() {
        if (!this.zoomBehavior) return;

        const bounds = this.calculateBoundingBox();

        this.zoomBehavior.translateExtent([
            [bounds.minX, bounds.minY],
            [bounds.maxX, bounds.maxY]
        ]);

        this.svg.call(this.zoomBehavior);
    }

    /**
     * Update node labels (e.g., after language change)
     */
    updateLabels() {
        if (this.nodeSelection) {
            this.nodeSelection.select('.node-label')
                .text(d => {
                    const lang = i18n.getCurrentLanguage();
                    return lang === 'en' ? d.name_en : d.name_he;
                });
        }

        // Update victim container label if expanded
        this.updateVictimContainerLabel();
    }

    /**
     * Restart simulation
     */
    restart() {
        if (this.simulation) {
            this.simulation
                .force('center', d3.forceCenter(this.width / 2, this.height / 2))
                .alpha(1)
                .restart();

            // Reapply visibility after restart
            const currentTransform = d3.zoomTransform(this.svg.node());
            this.updateNodeVisibility(currentTransform.k);
        }
    }

    /**
     * Show empty state message
     */
    showEmptyState() {
        const container = document.getElementById('graph-container');
        const message = document.createElement('div');
        message.id = 'empty-state-message';
        message.className = 'empty-state';
        message.textContent = i18n.translate('no_data');
        container.appendChild(message);
    }

    /**
     * Toggle massacre expansion (expand or collapse)
     */
    toggleMassacreExpansion(massacreNode) {
        if (massacreNode.expanded) {
            this.collapseMassacre(massacreNode);
        } else {
            this.expandMassacre(massacreNode);
        }
    }

    /**
     * Expand massacre node to show all individual victims
     */
    expandMassacre(massacreNode) {
        console.log('Expanding massacre node:', massacreNode.id);
        massacreNode.expanded = true;

        const childIncidents = massacreNode.childIncidents || [];
        console.log('Child incidents:', childIncidents.length);

        if (childIncidents.length === 0) return;

        // Hide only the massacre node itself (keep other nodes visible)
        massacreNode.hidden = true;

        // Calculate grid layout for victim nodes
        const gridSize = Math.ceil(Math.sqrt(childIncidents.length));
        const spacing = 110; // Large spacing to prevent name overlap

        // Position the grid in a separate area to the right of the main graph
        // This ensures victim nodes don't overlap with existing nodes
        const gridWidth = (gridSize - 1) * spacing;
        const gridHeight = (gridSize - 1) * spacing;

        // Place grid to the right of the canvas with padding
        const startX = this.width * 1.5;
        const startY = this.height / 2 - gridHeight / 2;

        // Create new nodes for victims with fixed positions in grid
        const newNodes = [];

        childIncidents.forEach((incident, idx) => {
            const row = Math.floor(idx / gridSize);
            const col = idx % gridSize;

            const victimNode = {
                id: incident.id,
                type: 'victim',
                name_en: incident.victim.name_en,
                name_he: incident.victim.name_he,
                data: incident,
                parentMassacre: massacreNode.id,
                hidden: false,
                // Fixed positions - both fx/fy and x/y to prevent any movement
                fx: startX + col * spacing,
                fy: startY + row * spacing,
                x: startX + col * spacing,
                y: startY + row * spacing
            };

            newNodes.push(victimNode);
        });

        // Add victim nodes
        this.nodes.push(...newNodes);

        // Create visual container instead of individual links
        this.createVictimContainer(startX, startY, gridWidth, gridHeight, massacreNode.id);

        // Stop the simulation to prevent any movement
        if (this.simulation) {
            this.simulation.stop();
        }

        // Update visualization
        this.updateVisualization();

        // Focus/zoom on the victim nodes area
        this.zoomToVictimNodes(startX, startY, gridWidth, gridHeight);

        // Update zoom boundaries to include victim nodes
        this.updateZoomBehavior();
    }

    /**
     * Create visual container for victim nodes (instead of individual links)
     * Shows grouping relationship to Shalit deal without cluttering with lines
     */
    createVictimContainer(startX, startY, gridWidth, gridHeight, massacreId) {
        // Calculate container bounds with padding
        const padding = 70;
        const containerX = startX - padding;
        const containerY = startY - padding;
        const containerWidth = gridWidth + padding * 2;
        const containerHeight = gridHeight + padding * 2;

        // Create SVG group for container (positioned below nodes)
        const containerGroup = this.container.insert('g', ':first-child')
            .attr('class', 'victim-container')
            .attr('data-massacre-id', massacreId)
            .style('opacity', 0); // Start invisible for fade-in

        // Add background rectangle
        containerGroup.append('rect')
            .attr('class', 'victim-container-bg')
            .attr('x', containerX)
            .attr('y', containerY)
            .attr('width', containerWidth)
            .attr('height', containerHeight)
            .attr('rx', 12)
            .attr('ry', 12)
            .attr('fill', 'rgba(244, 67, 54, 0.08)')
            .attr('stroke', '#F44336')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .attr('opacity', 0.7);

        // Add header label
        const lang = i18n.getCurrentLanguage();
        const labelText = lang === 'en'
            ? 'October 7 victims'
            : 'קורבנות 7 באוקטובר';

        const labelX = containerX + containerWidth / 2;
        const labelY = containerY - 15;

        containerGroup.append('text')
            .attr('class', 'massacre-container-label')
            .attr('x', labelX)
            .attr('y', labelY)
            .attr('text-anchor', 'middle')
            .attr('font-size', '16px')
            .attr('font-weight', '600')
            .attr('fill', '#C62828')
            .text(labelText);

        // Add connection line from label to Shalit deal
        const shalitDeal = this.nodes.find(n => n.id === 'gilad_shalit');
        if (shalitDeal) {
            containerGroup.append('line')
                .attr('class', 'victim-container-connector')
                .attr('x1', labelX)
                .attr('y1', labelY)
                .attr('x2', shalitDeal.x)
                .attr('y2', shalitDeal.y)
                .attr('stroke', '#999')
                .attr('stroke-width', 2)
                .attr('opacity', 0.6);
        }

        // Fade in animation
        containerGroup.transition()
            .duration(300)
            .style('opacity', 1);
    }

    /**
     * Remove victim container when collapsing
     */
    removeVictimContainer() {
        this.container.selectAll('.victim-container')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .remove();
    }

    /**
     * Update container label text when language changes
     */
    updateVictimContainerLabel() {
        // Check if container exists (may not exist during initialization)
        if (!this.container) return;

        const lang = i18n.getCurrentLanguage();
        const labelText = lang === 'en'
            ? 'October 7 victims'
            : 'קורבנות 7 באוקטובר';

        this.container.selectAll('.massacre-container-label')
            .text(labelText);
    }

    /**
     * Zoom to focus on victim nodes area
     */
    zoomToVictimNodes(startX, startY, gridWidth, gridHeight) {
        if (!this.zoomBehavior || !this.svg) return;

        // Add padding around the grid (increased to account for container and label)
        const padding = 150;
        const centerX = startX + gridWidth / 2;
        const centerY = startY + gridHeight / 2;

        // Calculate scale to fit the grid area with padding
        const scaleX = this.width / (gridWidth + padding * 2);
        const scaleY = this.height / (gridHeight + padding * 2);
        const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in more than 1:1

        // Create transform to center on the victim grid
        const transform = d3.zoomIdentity
            .translate(this.width / 2, this.height / 2)
            .scale(scale)
            .translate(-centerX, -centerY);

        // Animate the zoom transition
        this.svg.transition()
            .duration(750)
            .call(this.zoomBehavior.transform, transform);
    }

    /**
     * Collapse massacre node to show all nodes again
     */
    collapseMassacre(massacreNode) {
        console.log('Collapsing massacre node:', massacreNode.id);
        massacreNode.expanded = false;

        // Show only the massacre node again
        massacreNode.hidden = false;

        // Remove victim nodes
        this.nodes = this.nodes.filter(n => n.parentMassacre !== massacreNode.id);

        // Remove victim container
        this.removeVictimContainer();

        // Restart simulation for normal view
        if (this.simulation) {
            this.simulation.alpha(0.3).restart();
        }

        // Update visualization
        this.updateVisualization();

        // Restore default zoom
        this.restoreDefaultZoom();

        // Update zoom boundaries after collapse (delay to wait for container removal animation)
        setTimeout(() => this.updateZoomBehavior(), 250);
    }

    /**
     * Restore the default zoom level
     */
    restoreDefaultZoom() {
        if (!this.zoomBehavior || !this.svg || !this.defaultZoomTransform) return;

        this.svg.transition()
            .duration(750)
            .call(this.zoomBehavior.transform, this.defaultZoomTransform);
    }

    /**
     * Collapse all expanded massacre nodes
     */
    collapseAllMassacres() {
        const expandedMassacres = this.nodes.filter(n => n.type === 'massacre' && n.expanded);
        expandedMassacres.forEach(massacre => this.collapseMassacre(massacre));
    }

    /**
     * Toggle deal group expansion
     */
    toggleDealGroup(groupNode) {
        if (groupNode.expanded) {
            this.collapseDealGroup();
        } else {
            this.expandDealGroup(groupNode);
        }
    }

    /**
     * Expand deal group to show individual deals
     */
    expandDealGroup(groupNode) {
        console.log('Expanding deal group:', groupNode.id);
        groupNode.expanded = true;

        const childDeals = groupNode.childDeals || [];
        console.log('Child deals:', childDeals.length);

        if (childDeals.length === 0) return;

        // Hide the group node
        groupNode.hidden = true;

        // Calculate positions for the three deals in a horizontal line
        const centerX = groupNode.x;
        const centerY = groupNode.y;
        const isMobile = this.isMobileDevice();
        const spacing = isMobile ? 300 : 200; // Wider spacing on mobile to prevent clutter

        // Create nodes for the three child deals
        const newNodes = [];
        childDeals.forEach((deal, idx) => {
            const dealNode = {
                id: deal.id,
                type: 'deal',
                name_en: deal.name_en,
                name_he: deal.name_he,
                data: deal,
                parentGroup: groupNode.id,
                hidden: false,
                isMainDeal: true, // Treat expanded deals as main deals
                // Position in a horizontal line
                x: centerX + (idx - 1) * spacing,
                y: centerY,
                fx: centerX + (idx - 1) * spacing,
                fy: centerY
            };

            newNodes.push(dealNode);
        });

        // Add deal nodes to the graph
        this.nodes.push(...newNodes);

        // Stop simulation to prevent unwanted movement
        if (this.simulation) {
            this.simulation.stop();
        }

        // Update visualization
        this.updateVisualization();

        // Update zoom boundaries after expansion
        this.updateZoomBehavior();
    }

    /**
     * Collapse deal group
     */
    collapseDealGroup() {
        const groupNode = this.nodes.find(n => n.type === 'deal-group');
        if (!groupNode || !groupNode.expanded) return;

        console.log('Collapsing deal group:', groupNode.id);

        // Find the expanded child deals to calculate their center position
        const childNodes = this.nodes.filter(n => n.parentGroup === groupNode.id);

        // Calculate center position of expanded deals
        if (childNodes.length > 0) {
            const centerX = childNodes.reduce((sum, n) => sum + n.x, 0) / childNodes.length;
            const centerY = childNodes.reduce((sum, n) => sum + n.y, 0) / childNodes.length;

            // Set group node position to the center of where the expanded deals were
            groupNode.x = centerX;
            groupNode.y = centerY;
            groupNode.fx = centerX;
            groupNode.fy = centerY;
        }

        groupNode.expanded = false;
        groupNode.hidden = false;

        // Remove child deal nodes
        this.nodes = this.nodes.filter(n => n.parentGroup !== groupNode.id);

        // Restart simulation with lower alpha to minimize movement
        if (this.simulation) {
            this.simulation.alpha(0.1).restart();
        }

        // Update visualization
        this.updateVisualization();

        // Update zoom boundaries after collapse
        this.updateZoomBehavior();
    }

    /**
     * Update visualization with current nodes and links
     */
    updateVisualization() {
        // Get the container group
        const g = this.svg.select('g');

        // Update links using D3 enter/exit pattern
        const link = g.select('g').selectAll('line.link')
            .data(this.links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);

        link.exit().remove();

        const linkEnter = link.enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-width', 1);

        this.linkSelection = link.merge(linkEnter);

        // Hide links to/from hidden nodes
        this.linkSelection.style('display', d => {
            const sourceHidden = d.source.hidden;
            const targetHidden = d.target.hidden;
            return (sourceHidden || targetHidden) ? 'none' : 'block';
        });

        // Update nodes using D3 enter/exit pattern
        const node = g.selectAll('g.node')
            .data(this.nodes, d => d.id);

        node.exit().remove();

        const nodeEnter = node.enter().append('g')
            .attr('class', d => `node node-${d.type}`);

        // Apply drag only to non-victim nodes and only on desktop
        const isMobile = this.isMobileDevice();
        if (!isMobile) {
            nodeEnter.filter(d => d.type !== 'victim')
                .call(this.drag());
        }

        // Add circles to new nodes
        nodeEnter.append('circle')
            .attr('r', d => this.getNodeRadius(d))
            .attr('fill', d => {
                if (d.type === 'deal') return '#2196F3';
                if (d.type === 'deal-group') return '#2196F3';
                return '#F44336';
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);

        // Add count labels inside circles
        nodeEnter.append('text')
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('class', 'node-count')
            .style('fill', '#fff')
            .style('font-weight', 'bold')
            .style('font-size', d => {
                const radius = this.getNodeRadius(d);
                if (d.type === 'victim') {
                    // Victim nodes get very small font
                    return '6px';
                }
                // Scale font size with node radius (min 10px, max 18px)
                return Math.max(10, Math.min(18, radius * 0.35)) + 'px';
            })
            .style('pointer-events', 'none')
            .text(d => this.getNodeCount(d));

        // Add name labels below nodes
        nodeEnter.append('text')
            .attr('dy', d => {
                const isMobile = this.isMobileDevice();
                const baseOffset = this.getNodeRadius(d);
                // On mobile, add extra spacing for deal nodes
                const extraOffset = isMobile && (d.type === 'deal' || d.type === 'deal-group') ? 28 : 18;
                return baseOffset + extraOffset;
            })
            .attr('text-anchor', 'middle')
            .attr('class', d => d.type === 'victim' ? 'node-label victim-label' : 'node-label')
            .style('font-size', d => d.type === 'victim' ? '8px' : '12px')
            .text(d => {
                const lang = i18n.getCurrentLanguage();
                return lang === 'en' ? d.name_en : d.name_he;
            });

        // Add click handlers for victim and incident nodes
        nodeEnter.filter(d => d.type === 'victim' || d.type === 'incident')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                popup.open(d.data);
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event.clientX, event.clientY, d);
            })
            .each((d, i, nodes) => {
                // Add touch handlers using native DOM API on mobile
                if (isMobile) {
                    this.attachTouchHandlers(nodes[i], d);
                }
            });

        // Add click handlers for deal nodes (including dynamically added ones)
        nodeEnter.filter(d => d.type === 'deal')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                this.collapseAllMassacres();
                dealPopup.open(d.data);
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event.clientX, event.clientY, d);
            })
            .each((d, i, nodes) => {
                // Add touch handlers using native DOM API on mobile
                if (isMobile) {
                    this.attachTouchHandlers(nodes[i], d);
                }
            });

        // Add click handlers for deal-group nodes
        nodeEnter.filter(d => d.type === 'deal-group')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                this.collapseAllMassacres();
                this.toggleDealGroup(d);
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event.clientX, event.clientY, d);
            })
            .each((d, i, nodes) => {
                // Add touch handlers using native DOM API on mobile
                if (isMobile) {
                    this.attachTouchHandlers(nodes[i], d);
                }
            });

        this.nodeSelection = node.merge(nodeEnter);

        // Apply visibility based on hidden property
        this.nodeSelection.style('display', d => d.hidden ? 'none' : 'block');

        // Update simulation with new data (desktop only)
        if (this.simulation) {
            this.simulation.nodes(this.nodes);
            this.simulation.force('link').links(this.links);

            // Restart simulation with low alpha for smooth transition
            this.simulation.alpha(0.3).restart();

            // Update positions on tick
            this.simulation.on('tick', () => {
                this.linkSelection
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                this.nodeSelection.attr('transform', d => `translate(${d.x},${d.y})`);
            });
        } else {
            // Mobile: Manually resolve link source/target IDs to node objects if needed
            const nodeById = new Map(this.nodes.map(n => [n.id, n]));
            this.links.forEach(link => {
                if (typeof link.source === 'string') {
                    link.source = nodeById.get(link.source) || link.source;
                }
                if (typeof link.target === 'string') {
                    link.target = nodeById.get(link.target) || link.target;
                }
            });

            // Mobile: No simulation - update positions directly
            this.linkSelection
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            this.nodeSelection.attr('transform', d => `translate(${d.x},${d.y})`);
        }
    }
}

// Create global graph instance
const graph = new Graph();
