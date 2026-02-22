/**
 * Internationalization (i18n) module
 * Handles language switching between English and Hebrew
 */

class I18n {
    constructor() {
        this.currentLang = 'he';
        this.translations = {};
        this.loadedLanguages = new Set();
    }

    /**
     * Initialize i18n system
     */
    async init() {
        // Use pre-detected language from inline script
        const savedLang = window.__initialLang || localStorage.getItem('language') || 'he';

        // Check if Hebrew translations are inlined
        if (window.__inlineTranslations && window.__inlineTranslations.he) {
            this.translations.he = window.__inlineTranslations.he;
            this.loadedLanguages.add('he');
        }

        // Load English (only fetched if user switches language)
        await this.loadLanguage('en');

        // Load Hebrew from network if not already inlined
        if (!this.loadedLanguages.has('he')) {
            await this.loadLanguage('he');
        }

        // Set initial language
        await this.setLanguage(savedLang);

        // No need for popstate listener since we navigate between pages

        // Show content now that translations are applied
        document.body.classList.remove('i18n-loading');
        document.body.classList.add('i18n-ready');
    }

    /**
     * Load language translations from JSON file
     */
    async loadLanguage(lang) {
        if (this.loadedLanguages.has(lang)) {
            return;
        }

        try {
            // Determine correct path based on current location
            const pathPrefix = window.location.pathname.includes('/en/') ? '../' : '';
            const cacheBuster = '2026-02-25-v1'; // Update this when translations change
            const response = await fetch(`${pathPrefix}locales/${lang}.json?v=${cacheBuster}`);
            if (!response.ok) {
                throw new Error(`Failed to load ${lang}.json`);
            }
            this.translations[lang] = await response.json();
            this.loadedLanguages.add(lang);
        } catch (error) {
            console.error(`Error loading language ${lang}:`, error);
        }
    }

    /**
     * Set current language and update UI
     */
    async setLanguage(lang) {
        if (!this.loadedLanguages.has(lang)) {
            await this.loadLanguage(lang);
        }

        this.currentLang = lang;

        // Update HTML lang and dir attributes
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';

        // Save preference
        localStorage.setItem('language', lang);

        // Update URL to match language
        this.updateURL(lang);

        // Update all text
        this.updateText();

        // Update meta tags
        this.updateMetaTags();

        // Update graph node labels
        if (typeof graph !== 'undefined' && graph.updateLabels) {
            graph.updateLabels();
        }

        // Update language toggle button
        this.updateLanguageButton();

        // Ensure content is visible (handles language toggle after init)
        document.body.classList.remove('i18n-loading');
        document.body.classList.add('i18n-ready');

        // Send analytics pageview if gtag is available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_view', {
                page_path: window.location.pathname,
                page_title: document.title,
                language: lang
            });
        }
    }

    /**
     * Toggle between English and Hebrew
     */
    async toggleLanguage() {
        const newLang = this.currentLang === 'en' ? 'he' : 'en';
        await this.setLanguage(newLang);
    }

    /**
     * Update all text elements with data-i18n attribute
     */
    updateText() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translate(key);

            if (translation) {
                // Check if this element contains HTML or just text
                if (key.includes('_content')) {
                    element.innerHTML = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });
    }

    /**
     * Update language toggle button text
     */
    updateLanguageButton() {
        const button = document.getElementById('language-label');
        if (button) {
            button.textContent = this.currentLang === 'en' ? 'עברית' : 'English';
        }
    }

    /**
     * Update document title and meta tags based on current language
     */
    updateMetaTags() {
        const title = this.translate('site_title');
        const description = this.translate('meta_description') || this.translate('site_subtitle');

        // Update document title
        document.title = title;

        // Update meta description
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.setAttribute('content', description);
        }

        // Update Open Graph title
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            ogTitle.setAttribute('content', title);
        }

        // Update Open Graph description
        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) {
            ogDescription.setAttribute('content', description);
        }

        // Update Open Graph URL
        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) {
            ogUrl.setAttribute('content', window.location.href);
        }

        // Update Twitter title
        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) {
            twitterTitle.setAttribute('content', title);
        }

        // Update Twitter description
        const twitterDescription = document.querySelector('meta[name="twitter:description"]');
        if (twitterDescription) {
            twitterDescription.setAttribute('content', description);
        }
    }

    /**
     * Extract language from URL path
     */
    getLanguageFromURL() {
        const path = window.location.pathname;
        if (path.includes('/en/') || path.endsWith('/en')) {
            return 'en';
        }
        return 'he';
    }

    /**
     * Update URL to match current language (navigate between pages)
     */
    updateURL(lang) {
        const currentPath = window.location.pathname;
        const isOnEnglishPage = currentPath.includes('/en/') || currentPath.endsWith('/en');
        const isOnHebrewPage = !isOnEnglishPage;

        if (lang === 'en' && isOnHebrewPage) {
            // Navigate to English page
            window.location.href = '/en/';
        } else if (lang === 'he' && isOnEnglishPage) {
            // Navigate to Hebrew page
            window.location.href = '/';
        }
        // If already on the correct page, do nothing (language was toggled via localStorage)
    }

    // Hash-based routing methods removed - we now use page navigation

    /**
     * Get translation for a key
     */
    translate(key) {
        const translation = this.translations[this.currentLang]?.[key];
        return translation || key;
    }

    /**
     * Get current language code
     */
    getCurrentLanguage() {
        return this.currentLang;
    }

    /**
     * Check if current language is RTL
     */
    isRTL() {
        return this.currentLang === 'he';
    }
}

// Create global i18n instance
const i18n = new I18n();
