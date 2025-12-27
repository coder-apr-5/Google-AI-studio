/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANNA BAZAAR - AGMARKNET MANDI DATA SCRAPER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Inject into Agmarknet 2.0 portal via Requestly to sync live Mandi 
 *          pricing data directly to Anna Bazaar's Firestore database.
 * 
 * Requestly Configuration:
 * - URL Pattern: https://agmarknet.gov.in/daily-price-and-arrival-report*
 * - Rule Type: "Insert Script"
 * - Load Time: "After Page Load"
 * 
 * @author Anna Bazaar Team - Calcutta Hacks 2025
 * @version 1.0.0
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════
    
    const CONFIG = {
        // Firebase Firestore REST API endpoint
        FIRESTORE_PROJECT: 'annabazaarhackspire',
        FIRESTORE_BASE_URL: 'https://firestore.googleapis.com/v1/projects/annabazaarhackspire/databases/(default)/documents',
        COLLECTION_NAME: 'mandiPrices',
        
        // Agmarknet DOM Selectors
        SELECTORS: {
            TABLE: '#cphBody_GridArrivalData',
            TABLE_BODY: '#cphBody_GridArrivalData tbody',
            STATE_DROPDOWN: '#cphBody_ddlState',
            DISTRICT_DROPDOWN: '#cphBody_ddlDistrict',
            GO_BUTTON: '#cphBody_btnGo',
            COMMODITY_DROPDOWN: '#cphBody_ddlCommodity',
        },
        
        // Column indices (0-based) - Agmarknet table structure
        COLUMNS: {
            SL_NO: 0,
            STATE: 1,
            DISTRICT: 2,
            MARKET: 3,
            COMMODITY: 4,
            VARIETY: 5,
            GRADE: 6,
            MIN_PRICE: 7,
            MAX_PRICE: 8,
            MODAL_PRICE: 9,
            DATE: 10,
        },
        
        // Styling
        COLORS: {
            PRIMARY: '#13EC1E',
            PRIMARY_DARK: '#0BBF14',
            SUCCESS: '#22c55e',
            ERROR: '#ef4444',
            WARNING: '#f59e0b',
            SYNCING: '#3b82f6',
        },
        
        // Timing
        DEBOUNCE_MS: 500,
        TOAST_DURATION_MS: 4000,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // UTILITY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Generate a deterministic document ID for deduplication
     */
    function generateDocId(state, district, market, commodity) {
        const sanitize = (str) => str
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        
        return `${sanitize(state)}_${sanitize(district)}_${sanitize(market)}_${sanitize(commodity)}`;
    }

    /**
     * Parse price string to number (handles Indian number format with commas)
     */
    function parsePrice(priceStr) {
        if (!priceStr || priceStr.trim() === '' || priceStr === 'NR') {
            return null;
        }
        const cleaned = priceStr.replace(/,/g, '').replace(/₹/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    /**
     * Get selected text from a dropdown
     */
    function getDropdownText(selector) {
        const dropdown = document.querySelector(selector);
        if (!dropdown) return '';
        return dropdown.options[dropdown.selectedIndex]?.text?.trim() || '';
    }

    /**
     * Get selected value from a dropdown
     */
    function getDropdownValue(selector) {
        const dropdown = document.querySelector(selector);
        if (!dropdown) return '';
        return dropdown.value?.trim() || '';
    }

    /**
     * Format date to ISO string
     */
    function formatDate(dateStr) {
        if (!dateStr) return new Date().toISOString();
        try {
            // Agmarknet uses DD/MM/YYYY format
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                return new Date(`${year}-${month}-${day}`).toISOString();
            }
            return new Date(dateStr).toISOString();
        } catch {
            return new Date().toISOString();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UI COMPONENTS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Inject custom styles
     */
    function injectStyles() {
        const styleId = 'anna-bazaar-scraper-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            /* Floating Sync Button */
            #anna-bazaar-sync-container {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 99999;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            }

            #anna-bazaar-sync-btn {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 14px 24px;
                background: linear-gradient(135deg, ${CONFIG.COLORS.PRIMARY} 0%, ${CONFIG.COLORS.PRIMARY_DARK} 100%);
                color: white;
                border: none;
                border-radius: 50px;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 8px 32px rgba(19, 236, 30, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            #anna-bazaar-sync-btn:hover {
                transform: translateY(-3px) scale(1.02);
                box-shadow: 0 12px 40px rgba(19, 236, 30, 0.5), 0 8px 20px rgba(0, 0, 0, 0.2);
            }

            #anna-bazaar-sync-btn:active {
                transform: translateY(-1px) scale(0.98);
            }

            #anna-bazaar-sync-btn.syncing {
                background: linear-gradient(135deg, ${CONFIG.COLORS.SYNCING} 0%, #2563eb 100%);
                cursor: wait;
                animation: pulse 1.5s infinite;
            }

            #anna-bazaar-sync-btn.success {
                background: linear-gradient(135deg, ${CONFIG.COLORS.SUCCESS} 0%, #16a34a 100%);
            }

            #anna-bazaar-sync-btn.error {
                background: linear-gradient(135deg, ${CONFIG.COLORS.ERROR} 0%, #dc2626 100%);
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            .anna-sync-icon {
                width: 20px;
                height: 20px;
                fill: currentColor;
            }

            .anna-sync-icon.spinning {
                animation: spin 1s linear infinite;
            }

            /* Status Badge */
            #anna-bazaar-status {
                position: fixed;
                bottom: 90px;
                right: 24px;
                z-index: 99998;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(12px);
                color: white;
                padding: 12px 20px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 500;
                display: none;
                align-items: center;
                gap: 10px;
                max-width: 320px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            #anna-bazaar-status.visible {
                display: flex;
                animation: slideIn 0.3s ease-out;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            /* Toast Notifications */
            #anna-bazaar-toast-container {
                position: fixed;
                top: 24px;
                right: 24px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .anna-toast {
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(12px);
                color: white;
                padding: 16px 24px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                animation: toastIn 0.4s ease-out;
                border-left: 4px solid ${CONFIG.COLORS.PRIMARY};
                max-width: 400px;
            }

            .anna-toast.success {
                border-left-color: ${CONFIG.COLORS.SUCCESS};
            }

            .anna-toast.error {
                border-left-color: ${CONFIG.COLORS.ERROR};
            }

            .anna-toast.warning {
                border-left-color: ${CONFIG.COLORS.WARNING};
            }

            @keyframes toastIn {
                from {
                    opacity: 0;
                    transform: translateX(100px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            /* Row Highlighting */
            .anna-synced-row {
                background: linear-gradient(90deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%) !important;
                transition: background 0.5s ease;
            }

            .anna-synced-row td {
                position: relative;
            }

            .anna-synced-row td::after {
                content: '';
                position: absolute;
                left: 0;
                bottom: 0;
                width: 100%;
                height: 2px;
                background: linear-gradient(90deg, ${CONFIG.COLORS.SUCCESS}, transparent);
            }

            .anna-sync-error-row {
                background: linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%) !important;
            }

            /* Progress Bar */
            #anna-progress-container {
                position: fixed;
                bottom: 150px;
                right: 24px;
                z-index: 99997;
                width: 280px;
                display: none;
            }

            #anna-progress-container.visible {
                display: block;
            }

            #anna-progress-label {
                color: white;
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 8px;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            }

            #anna-progress-bar {
                width: 100%;
                height: 8px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                overflow: hidden;
                box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
            }

            #anna-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, ${CONFIG.COLORS.PRIMARY}, ${CONFIG.COLORS.SUCCESS});
                border-radius: 4px;
                transition: width 0.3s ease;
                width: 0%;
            }

            /* Brand Badge */
            #anna-brand-badge {
                position: fixed;
                bottom: 24px;
                left: 24px;
                z-index: 99996;
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(30, 30, 30, 0.9) 100%);
                backdrop-filter: blur(12px);
                padding: 10px 16px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                gap: 10px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }

            #anna-brand-badge .logo {
                width: 28px;
                height: 28px;
                background: linear-gradient(135deg, ${CONFIG.COLORS.PRIMARY} 0%, ${CONFIG.COLORS.PRIMARY_DARK} 100%);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 16px;
            }

            #anna-brand-badge .text {
                color: white;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.3px;
            }

            #anna-brand-badge .subtext {
                color: rgba(255, 255, 255, 0.6);
                font-size: 10px;
                font-weight: 500;
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Create the floating sync button and UI elements
     */
    function createSyncUI() {
        // Remove existing UI if any
        const existingContainer = document.getElementById('anna-bazaar-sync-container');
        if (existingContainer) existingContainer.remove();

        // Main sync button container
        const container = document.createElement('div');
        container.id = 'anna-bazaar-sync-container';
        container.innerHTML = `
            <button id="anna-bazaar-sync-btn" title="Sync Mandi data to Anna Bazaar">
                <svg class="anna-sync-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                <span>Anna Bazaar Sync</span>
            </button>
        `;
        document.body.appendChild(container);

        // Status badge
        const status = document.createElement('div');
        status.id = 'anna-bazaar-status';
        document.body.appendChild(status);

        // Toast container
        const toastContainer = document.createElement('div');
        toastContainer.id = 'anna-bazaar-toast-container';
        document.body.appendChild(toastContainer);

        // Progress bar
        const progress = document.createElement('div');
        progress.id = 'anna-progress-container';
        progress.innerHTML = `
            <div id="anna-progress-label">Syncing...</div>
            <div id="anna-progress-bar">
                <div id="anna-progress-fill"></div>
            </div>
        `;
        document.body.appendChild(progress);

        // Brand badge
        const badge = document.createElement('div');
        badge.id = 'anna-brand-badge';
        badge.innerHTML = `
            <div class="logo">🌾</div>
            <div>
                <div class="text">Anna Bazaar</div>
                <div class="subtext">Mandi Data Sync Active</div>
            </div>
        `;
        document.body.appendChild(badge);

        // Attach click handler
        document.getElementById('anna-bazaar-sync-btn').addEventListener('click', handleSyncClick);
    }

    /**
     * Show a toast notification
     */
    function showToast(message, type = 'info') {
        const container = document.getElementById('anna-bazaar-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `anna-toast ${type}`;
        
        const icons = {
            info: '📊',
            success: '✅',
            error: '❌',
            warning: '⚠️',
        };

        toast.innerHTML = `
            <span style="font-size: 18px;">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.TOAST_DURATION_MS);
    }

    /**
     * Update status badge
     */
    function updateStatus(message, show = true) {
        const status = document.getElementById('anna-bazaar-status');
        if (!status) return;

        if (show) {
            status.innerHTML = `<span>🔄</span><span>${message}</span>`;
            status.classList.add('visible');
        } else {
            status.classList.remove('visible');
        }
    }

    /**
     * Update progress bar
     */
    function updateProgress(current, total, show = true) {
        const container = document.getElementById('anna-progress-container');
        const label = document.getElementById('anna-progress-label');
        const fill = document.getElementById('anna-progress-fill');

        if (!container || !label || !fill) return;

        if (show) {
            container.classList.add('visible');
            const percentage = Math.round((current / total) * 100);
            label.textContent = `Syncing ${current} of ${total} records (${percentage}%)`;
            fill.style.width = `${percentage}%`;
        } else {
            container.classList.remove('visible');
            fill.style.width = '0%';
        }
    }

    /**
     * Set button state
     */
    function setButtonState(state) {
        const btn = document.getElementById('anna-bazaar-sync-btn');
        if (!btn) return;

        const icon = btn.querySelector('.anna-sync-icon');
        
        btn.classList.remove('syncing', 'success', 'error');
        if (icon) icon.classList.remove('spinning');

        switch (state) {
            case 'syncing':
                btn.classList.add('syncing');
                if (icon) icon.classList.add('spinning');
                btn.querySelector('span:last-child').textContent = 'Syncing...';
                break;
            case 'success':
                btn.classList.add('success');
                btn.querySelector('span:last-child').textContent = 'Sync Complete!';
                setTimeout(() => setButtonState('idle'), 3000);
                break;
            case 'error':
                btn.classList.add('error');
                btn.querySelector('span:last-child').textContent = 'Sync Failed';
                setTimeout(() => setButtonState('idle'), 3000);
                break;
            default:
                btn.querySelector('span:last-child').textContent = 'Anna Bazaar Sync';
        }
    }

    /**
     * Highlight a table row
     */
    function highlightRow(row, success = true) {
        row.classList.remove('anna-synced-row', 'anna-sync-error-row');
        row.classList.add(success ? 'anna-synced-row' : 'anna-sync-error-row');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SCRAPING LOGIC
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Extract data from the Agmarknet table
     */
    function extractTableData() {
        const table = document.querySelector(CONFIG.SELECTORS.TABLE);
        if (!table) {
            throw new Error('Data table not found. Please click "Go" to load the data first.');
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) {
            throw new Error('Table body not found.');
        }

        const rows = tbody.querySelectorAll('tr');
        if (rows.length === 0) {
            throw new Error('No data rows found in the table.');
        }

        // Get current selections from dropdowns
        const selectedState = getDropdownText(CONFIG.SELECTORS.STATE_DROPDOWN);
        const selectedDistrict = getDropdownText(CONFIG.SELECTORS.DISTRICT_DROPDOWN);
        const selectedCommodity = getDropdownText(CONFIG.SELECTORS.COMMODITY_DROPDOWN);

        const records = [];
        const now = new Date().toISOString();

        rows.forEach((row, index) => {
            // Skip header row if it exists in tbody
            if (row.querySelector('th')) return;

            const cells = row.querySelectorAll('td');
            if (cells.length < 10) return; // Skip incomplete rows

            const getCellText = (idx) => cells[idx]?.textContent?.trim() || '';

            // Extract data from each column
            const state = getCellText(CONFIG.COLUMNS.STATE) || selectedState;
            const district = getCellText(CONFIG.COLUMNS.DISTRICT) || selectedDistrict;
            const market = getCellText(CONFIG.COLUMNS.MARKET);
            const commodity = getCellText(CONFIG.COLUMNS.COMMODITY) || selectedCommodity;
            const variety = getCellText(CONFIG.COLUMNS.VARIETY);
            const grade = getCellText(CONFIG.COLUMNS.GRADE);
            const minPrice = parsePrice(getCellText(CONFIG.COLUMNS.MIN_PRICE));
            const maxPrice = parsePrice(getCellText(CONFIG.COLUMNS.MAX_PRICE));
            const modalPrice = parsePrice(getCellText(CONFIG.COLUMNS.MODAL_PRICE));
            const reportDate = getCellText(CONFIG.COLUMNS.DATE);

            // Skip rows with no essential data
            if (!market || !commodity || modalPrice === null) return;

            const docId = generateDocId(state, district, market, commodity);

            records.push({
                docId,
                rowElement: row,
                data: {
                    state,
                    district,
                    market,
                    commodity,
                    variety,
                    grade,
                    minPrice,
                    maxPrice,
                    modalPrice,
                    reportDate: formatDate(reportDate),
                    source: 'agmarknet',
                    sourceUrl: window.location.href,
                    lastUpdated: now,
                    isVerified: true,
                    priceUnit: 'INR/Quintal',
                }
            });
        });

        return records;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FIRESTORE SYNC
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Convert JS object to Firestore document format
     */
    function toFirestoreDoc(data) {
        const convertValue = (value) => {
            if (value === null || value === undefined) {
                return { nullValue: null };
            }
            if (typeof value === 'string') {
                return { stringValue: value };
            }
            if (typeof value === 'number') {
                if (Number.isInteger(value)) {
                    return { integerValue: value.toString() };
                }
                return { doubleValue: value };
            }
            if (typeof value === 'boolean') {
                return { booleanValue: value };
            }
            if (Array.isArray(value)) {
                return { arrayValue: { values: value.map(convertValue) } };
            }
            if (typeof value === 'object') {
                const fields = {};
                for (const [k, v] of Object.entries(value)) {
                    fields[k] = convertValue(v);
                }
                return { mapValue: { fields } };
            }
            return { stringValue: String(value) };
        };

        const fields = {};
        for (const [key, value] of Object.entries(data)) {
            fields[key] = convertValue(value);
        }

        return { fields };
    }

    /**
     * CORS-safe fetch wrapper for Firebase REST API
     */
    async function firestorePatch(docId, data) {
        const url = `${CONFIG.FIRESTORE_BASE_URL}/${CONFIG.COLLECTION_NAME}/${docId}`;
        
        const firestoreDoc = toFirestoreDoc(data);

        try {
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(firestoreDoc),
                mode: 'cors',
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Firestore error: ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            // If CORS fails, try alternative approach via no-cors mode
            // Note: This won't return response data but will attempt the write
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                console.warn('[Anna Bazaar] CORS issue detected, attempting alternative sync...');
                throw error;
            }
            throw error;
        }
    }

    /**
     * Sync all records to Firestore with batching
     */
    async function syncToFirestore(records) {
        const results = {
            success: 0,
            failed: 0,
            errors: [],
        };

        const BATCH_SIZE = 5; // Concurrent requests limit
        const DELAY_MS = 100; // Delay between batches

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            
            const batchPromises = batch.map(async (record) => {
                try {
                    await firestorePatch(record.docId, record.data);
                    highlightRow(record.rowElement, true);
                    results.success++;
                } catch (error) {
                    console.error(`[Anna Bazaar] Failed to sync ${record.docId}:`, error);
                    highlightRow(record.rowElement, false);
                    results.failed++;
                    results.errors.push({
                        docId: record.docId,
                        error: error.message,
                    });
                }
            });

            await Promise.all(batchPromises);
            
            // Update progress
            const completed = Math.min(i + BATCH_SIZE, records.length);
            updateProgress(completed, records.length);
            updateStatus(`Synced ${completed} of ${records.length} records...`);

            // Small delay to avoid overwhelming the API
            if (i + BATCH_SIZE < records.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        return results;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN SYNC HANDLER
    // ═══════════════════════════════════════════════════════════════════════════

    let isSyncing = false;

    async function handleSyncClick() {
        if (isSyncing) {
            showToast('Sync already in progress...', 'warning');
            return;
        }

        isSyncing = true;
        setButtonState('syncing');
        updateStatus('Extracting table data...');

        try {
            // Step 1: Extract data from the table
            const records = extractTableData();
            
            if (records.length === 0) {
                throw new Error('No valid records found to sync.');
            }

            showToast(`Syncing ${records.length} Market Records to Firestore...`, 'info');
            updateProgress(0, records.length, true);

            // Step 2: Sync to Firestore
            const results = await syncToFirestore(records);

            // Step 3: Show results
            updateProgress(0, 0, false);
            updateStatus('', false);

            if (results.failed === 0) {
                showToast(`✨ Successfully synced ${results.success} records to Anna Bazaar!`, 'success');
                setButtonState('success');
            } else {
                showToast(`Synced ${results.success} records, ${results.failed} failed.`, 'warning');
                setButtonState(results.success > 0 ? 'success' : 'error');
            }

            console.log('[Anna Bazaar] Sync complete:', results);

        } catch (error) {
            console.error('[Anna Bazaar] Sync failed:', error);
            showToast(`Sync failed: ${error.message}`, 'error');
            setButtonState('error');
            updateProgress(0, 0, false);
            updateStatus('', false);
        } finally {
            isSyncing = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTO-DETECTION: MUTATION OBSERVER
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Set up MutationObserver to detect when the table loads
     */
    function setupTableObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const table = document.querySelector(CONFIG.SELECTORS.TABLE);
                    if (table && table.querySelector('tbody tr td')) {
                        // Table with data detected
                        console.log('[Anna Bazaar] 📊 Mandi data table detected!');
                        showToast('Mandi data loaded! Click "Anna Bazaar Sync" to upload.', 'info');
                        
                        // Pulse the sync button to draw attention
                        const btn = document.getElementById('anna-bazaar-sync-btn');
                        if (btn) {
                            btn.style.animation = 'pulse 0.5s ease 3';
                            setTimeout(() => btn.style.animation = '', 1500);
                        }
                    }
                }
            }
        });

        // Observe the main content area for changes
        const targetNode = document.querySelector('#form1') || document.body;
        observer.observe(targetNode, {
            childList: true,
            subtree: true,
        });

        console.log('[Anna Bazaar] 👀 MutationObserver active - watching for table data...');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════

    function init() {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🌾 ANNA BAZAAR - AGMARKNET SCRAPER v1.0.0                  ║
║   ─────────────────────────────────────────────              ║
║   Mandi Data Sync System Active                              ║
║   Target: Firestore @ annabazaarhackspire                    ║
║                                                               ║
║   📌 Click "Anna Bazaar Sync" to upload pricing data         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
        `);

        // Inject styles
        injectStyles();

        // Create UI elements
        createSyncUI();

        // Set up table detection
        setupTableObserver();

        // Show welcome toast
        setTimeout(() => {
            showToast('🌾 Anna Bazaar Sync ready! Load data and click Sync.', 'info');
        }, 1000);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
