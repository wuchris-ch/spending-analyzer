// ===== Spending Analyzer =====
// Uses categories from categories/categories.js

// Global State
const state = {
    transactions: [],
    filteredTransactions: [],
    loadedFiles: [],
    currentView: 'dashboard',
    dateRange: { from: null, to: null },
    sort: { field: 'date', direction: 'desc' },
    filters: { search: '', category: '' },
    pagination: { page: 1, perPage: 20 },
    selectedMonth: null
};

// Legacy categories reference for UI compatibility
// This now pulls from the categorySchema defined in categories/categories.js
const categories = categorySchema;

// CSV files will be discovered dynamically
let existingFiles = [];

// Discover CSV files in the accountactivity-gitignored folder
async function discoverCSVFiles() {
    const discovered = new Set();
    
    // Method 1: Try loading from manifest file (most reliable)
    try {
        const manifestResponse = await fetch('accountactivity-gitignored/files.json');
        if (manifestResponse.ok) {
            const manifest = await manifestResponse.json();
            if (Array.isArray(manifest)) {
                manifest.forEach(f => discovered.add(f.startsWith('accountactivity-gitignored/') ? f : `accountactivity-gitignored/${f}`));
            }
        }
    } catch (e) {
        // Manifest not available
    }
    
    // Method 2: Try fetching directory listing (works on some servers like Python's http.server)
    if (discovered.size === 0) {
        try {
            const response = await fetch('accountactivity-gitignored/');
            if (response.ok) {
                const html = await response.text();
                // Parse directory listing for .csv files - handles various server formats
                const csvMatches = html.match(/href="([^"]*\.csv)"/gi) || [];
                const csvMatches2 = html.match(/>([^<>]+\.csv)</gi) || [];
                
                for (const match of [...csvMatches, ...csvMatches2]) {
                    let filename = match.replace(/^href="|"$|^>|<$/g, '');
                    if (filename.endsWith('.csv')) {
                        if (!filename.includes('/')) {
                            filename = `accountactivity-gitignored/${filename}`;
                        }
                        discovered.add(filename);
                    }
                }
            }
        } catch (e) {
            // Directory listing not available
        }
    }
    
    // Convert to array and sort by filename
    const files = Array.from(discovered);
    files.sort((a, b) => {
        const nameA = a.split('/').pop();
        const nameB = b.split('/').pop();
        return nameA.localeCompare(nameB, undefined, { numeric: true });
    });
    
    return files;
}

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initUploadZone();
    initExistingFiles();
    initTransactionControls();
    initCharts();
    initQuickLoadButton();
    initShortcuts();
});

// ===== Theme Toggle =====
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    
    // Check for saved theme preference or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update Chart.js colors if charts exist
    updateChartColors(newTheme);
}

function updateChartColors(theme) {
    const isDark = theme === 'dark';

    Chart.defaults.color = isDark ? '#707070' : '#707070';
    Chart.defaults.borderColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(10, 10, 10, 0.07)';
    Chart.defaults.font.family = "'Geist', ui-sans-serif, system-ui, sans-serif";

    if (state.transactions.length > 0) {
        if (state.currentView === 'monthly') {
            updateMonthlySpendChart();
        }
    }
}

// ===== Navigation =====
function initNavigation() {
    document.querySelectorAll('.nav-item, .view-all').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            switchView(view);
        });
    });
}

// ===== Quick Load Button =====
function initQuickLoadButton() {
    const quickLoadBtn = document.getElementById('quickLoadBtn');
    if (quickLoadBtn) {
        quickLoadBtn.addEventListener('click', quickLoadAllFiles);
    }
}

async function quickLoadAllFiles() {
    const quickLoadBtn = document.getElementById('quickLoadBtn');
    
    // Discover files first if needed
    if (existingFiles.length === 0) {
        quickLoadBtn.classList.add('loading');
        quickLoadBtn.disabled = true;
        quickLoadBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            <span>Discovering...</span>
        `;
        
        existingFiles = await discoverCSVFiles();
    }
    
    if (existingFiles.length === 0) {
        quickLoadBtn.classList.remove('loading');
        quickLoadBtn.disabled = false;
        quickLoadBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            <span>No Files Found</span>
        `;
        setTimeout(() => {
            quickLoadBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                <span>Load All Data</span>
            `;
        }, 2000);
        return;
    }
    
    // Show loading state
    quickLoadBtn.classList.add('loading');
    quickLoadBtn.disabled = true;
    quickLoadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
        </svg>
        <span>Loading...</span>
    `;
    
    // Load all files
    let loadedCount = 0;
    for (const file of existingFiles) {
        if (state.loadedFiles.includes(file)) {
            loadedCount++;
            continue;
        }
        
        try {
            const response = await fetch(file);
            if (!response.ok) throw new Error('File not found');
            const content = await response.text();
            const transactions = parseCSV(content, file);
            addTransactions(transactions, file);
            loadedCount++;
        } catch (err) {
            console.error(`Failed to load ${file}:`, err);
        }
    }
    
    // Update button to show success
    quickLoadBtn.classList.remove('loading');
    quickLoadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Loaded ${loadedCount} files</span>
    `;
    
    // Reset button after a moment
    setTimeout(() => {
        quickLoadBtn.disabled = false;
        quickLoadBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            <span>Load All Data</span>
        `;
    }, 2000);
}

function switchView(view) {
    state.currentView = view;
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('active', v.id === `${view}View`);
    });
    
    // Update header
    const titles = {
        dashboard: ['Overview', 'A calm look at where your money went.'],
        monthly: ['Monthly', 'Detailed spending by category, one month at a time.'],
        transactions: ['Transactions', 'Browse, search, and export every line item.'],
        upload: ['Import', 'Upload CSV files or load what you already have.']
    };

    document.getElementById('pageTitle').textContent = titles[view]?.[0] || 'Overview';
    document.getElementById('pageSubtitle').textContent = titles[view]?.[1] || '';
    
    // Refresh view data
    if (view === 'dashboard') updateDashboard();
    if (view === 'monthly') renderMonthlyBreakdown();
    if (view === 'transactions') renderTransactions();
}


// ===== CSV Parsing =====
function parseCSV(content, filename) {
    const lines = content.trim().split('\n');
    const transactions = [];
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        // Parse CSV line handling commas in values
        const parts = parseCSVLine(line);
        if (parts.length < 4) continue;
        
        const [dateStr, description, debitStr, creditStr] = parts;
        
        // Parse date (MM/DD/YYYY format)
        const dateParts = dateStr.split('/');
        if (dateParts.length !== 3) continue;
        
        const date = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]);
        if (isNaN(date.getTime())) continue;
        
        const debit = parseFloat(debitStr) || 0;
        const credit = parseFloat(creditStr) || 0;
        
        // ONLY track spending (debits) - ignore payments/credits entirely
        if (!debit || credit) continue;
        
        const category = categorizeTransaction(description);
        
        transactions.push({
            id: `${filename}-${transactions.length}`,
            date,
            description: description.trim(),
            amount: debit,
            category,
            source: filename
        });
    }
    
    return transactions;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    
    // handle trailing commas
    if (line.endsWith(',')) {
        result.push('');
    }
    
    return result;
}

// The categorizeTransaction function is now imported from categories/categories.js
// It provides robust pattern-based matching with priority ordering

// ===== File Upload =====
function initUploadZone() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('fileInput');
    
    zone.addEventListener('click', () => input.click());
    
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });
    
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    input.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    document.getElementById('clearDataBtn').addEventListener('click', clearAllData);
}

async function handleFiles(files) {
    for (const file of files) {
        if (file.name.endsWith('.csv')) {
            try {
                const content = await file.text();
                const transactions = parseCSV(content, file.name);
                addTransactions(transactions, file.name);
            } catch (err) {
                console.error(`Error processing ${file.name}:`, err);
            }
        }
    }
}

// ===== Existing Files =====
async function initExistingFiles() {
    const container = document.getElementById('existingFiles');
    const loadBtn = document.getElementById('loadAllBtn');
    
    // Show loading state
    container.innerHTML = '<div class="discovering">Discovering CSV files...</div>';
    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading...';
    
    // Discover available CSV files
    existingFiles = await discoverCSVFiles();
    
    // Clear loading state
    container.innerHTML = '';
    loadBtn.textContent = 'Load All Files';
    
    if (existingFiles.length === 0) {
        container.innerHTML = `
            <div class="no-files">
                No CSV files found.<br>
                <small>Add files to accountactivity-gitignored/files.json or use drag & drop above.</small>
            </div>`;
        loadBtn.disabled = true;
        return;
    }
    
    existingFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <input type="checkbox" checked data-file="${file}">
            <span class="file-name">${file.split('/').pop()}</span>
            <span class="file-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
            </span>
        `;
        container.appendChild(item);
    });
    
    loadBtn.disabled = false;
    loadBtn.addEventListener('click', loadSelectedFiles);
}

async function loadSelectedFiles() {
    const checkboxes = document.querySelectorAll('#existingFiles input[type="checkbox"]:checked');
    const filesToLoad = Array.from(checkboxes).map(cb => cb.dataset.file);
    
    for (const file of filesToLoad) {
        if (state.loadedFiles.includes(file)) continue;
        
        try {
            const response = await fetch(file);
            if (!response.ok) throw new Error('File not found');
            const content = await response.text();
            const transactions = parseCSV(content, file);
            addTransactions(transactions, file);
        } catch (err) {
            console.error(`Failed to load ${file}:`, err);
        }
    }
}

function addTransactions(transactions, filename) {
    if (!state.loadedFiles.includes(filename)) {
        state.loadedFiles.push(filename);
    }
    
    // Add new transactions, avoiding duplicates
    const existingIds = new Set(state.transactions.map(t => t.id));
    const newTransactions = transactions.filter(t => !existingIds.has(t.id));
    state.transactions.push(...newTransactions);
    
    // Sort by date descending
    state.transactions.sort((a, b) => b.date - a.date);
    
    // Update UI
    updateLoadedFilesUI();
    updateDataStatus();
    applyFilters();
    if (state.currentView === 'dashboard') updateDashboard();
    if (state.currentView === 'monthly') renderMonthlyBreakdown();
    populateCategoryFilter();
}

function updateLoadedFilesUI() {
    const container = document.getElementById('loadedList');
    const clearBtn = document.getElementById('clearDataBtn');
    
    if (state.loadedFiles.length === 0) {
        container.innerHTML = '<div class="empty-state small">No files loaded yet</div>';
        clearBtn.style.display = 'none';
        return;
    }
    
    clearBtn.style.display = 'flex';
    
    // Count transactions per file
    const fileCounts = {};
    state.transactions.forEach(t => {
        fileCounts[t.source] = (fileCounts[t.source] || 0) + 1;
    });
    
    container.innerHTML = state.loadedFiles.map(file => `
        <div class="loaded-item">
            <span class="check-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </span>
            <span class="loaded-name">${file.split('/').pop()}</span>
            <span class="loaded-count">${fileCounts[file] || 0} transactions</span>
        </div>
    `).join('');
}

function updateDataStatus() {
    const status = document.getElementById('dataStatus');
    const count = state.transactions.length;
    const files = state.loadedFiles.length;

    if (count > 0) {
        status.classList.add('loaded');
        status.title = `${files} file${files !== 1 ? 's' : ''} · ${count.toLocaleString()} transactions`;
    } else {
        status.classList.remove('loaded');
        status.title = 'No data loaded';
    }
}

function clearAllData() {
    state.transactions = [];
    state.filteredTransactions = [];
    state.loadedFiles = [];
    
    updateLoadedFilesUI();
    updateDataStatus();
    updateDashboard();
    renderTransactions();
    renderMonthlyBreakdown();
}

// ===== Filters =====
function applyFilters() {
    let filtered = [...state.transactions];
    
    // Date range filter
    if (state.dateRange.from) {
        filtered = filtered.filter(t => t.date >= state.dateRange.from);
    }
    if (state.dateRange.to) {
        const toDate = new Date(state.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(t => t.date <= toDate);
    }
    
    // Search filter
    if (state.filters.search) {
        const search = state.filters.search.toLowerCase();
        filtered = filtered.filter(t => 
            t.description.toLowerCase().includes(search) ||
            t.category.toLowerCase().includes(search)
        );
    }
    
    // Category filter
    if (state.filters.category) {
        filtered = filtered.filter(t => t.category === state.filters.category);
    }
    
    state.filteredTransactions = filtered;
    state.pagination.page = 1;
    
    if (state.currentView === 'dashboard') updateDashboard();
    if (state.currentView === 'monthly') renderMonthlyBreakdown();
    if (state.currentView === 'transactions') renderTransactions();
}

// ===== Transaction Controls =====
function initTransactionControls() {
    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        applyFilters();
    });

    // Category filter popover — delegated click on panel items
    const panel = document.getElementById('categoryFilterPanel');
    if (panel) {
        panel.addEventListener('click', (e) => {
            const item = e.target.closest('[data-cat]');
            if (!item) return;
            state.filters.category = item.dataset.cat;
            // Close the popover
            const details = document.getElementById('categoryFilterPopover');
            if (details) details.open = false;
            updateCategoryFilterUI();
            applyFilters();
        });
    }

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        const details = document.getElementById('categoryFilterPopover');
        if (details && details.open && !details.contains(e.target)) {
            details.open = false;
        }
    });

    // Sorting
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (state.sort.field === field) {
                state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.sort.field = field;
                state.sort.direction = 'desc';
            }
            renderTransactions();
        });
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
}

function initShortcuts() {
    document.addEventListener('keydown', (e) => {
        const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
            || document.activeElement?.isContentEditable;

        // ⌘K / Ctrl-K from anywhere — jump to search
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            switchView('transactions');
            requestAnimationFrame(() => document.getElementById('searchInput')?.focus());
            return;
        }

        // "/" when not in an input — jump to search
        if (e.key === '/' && !inInput) {
            e.preventDefault();
            switchView('transactions');
            requestAnimationFrame(() => document.getElementById('searchInput')?.focus());
            return;
        }

        // Esc in the search input — clear and blur
        if (e.key === 'Escape' && document.activeElement?.id === 'searchInput') {
            const input = document.getElementById('searchInput');
            if (input.value) {
                input.value = '';
                state.filters.search = '';
                applyFilters();
            } else {
                input.blur();
            }
        }
    });
}

function populateCategoryFilter() {
    const panel = document.getElementById('categoryFilterPanel');
    if (!panel) return;
    const cats = [...new Set(state.transactions.map(t => t.category))].sort();
    const current = state.filters.category;
    panel.innerHTML = [
        `<button class="filter-option ${current === '' ? 'active' : ''}" data-cat="" type="button">All categories</button>`,
        ...cats.map(cat => {
            const conf = categories[cat] || { color: 'var(--fg-3)' };
            return `<button class="filter-option ${current === cat ? 'active' : ''}" data-cat="${cat}" type="button">
                <span class="filter-option-dot" style="background: ${conf.color}"></span>
                <span>${cat}</span>
            </button>`;
        })
    ].join('');
    updateCategoryFilterUI();
}

function updateCategoryFilterUI() {
    const label = document.getElementById('categoryFilterLabel');
    const trigger = document.querySelector('.filter-popover-trigger');
    if (label) label.textContent = state.filters.category || 'All categories';
    if (trigger) trigger.classList.toggle('has-filter', !!state.filters.category);
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    const pagination = document.getElementById('pagination');
    const resultCount = document.getElementById('resultCount');
    const activeFilters = document.getElementById('activeFilters');

    // Update sort indicators on headers
    document.querySelectorAll('.sortable').forEach(th => {
        // Strip any previous arrow node
        th.querySelectorAll('.sort-arrow').forEach(n => n.remove());
        th.classList.remove('sorted');
        if (th.dataset.sort === state.sort.field) {
            th.classList.add('sorted');
            const arrow = document.createElement('span');
            arrow.className = 'sort-arrow';
            arrow.textContent = state.sort.direction === 'asc' ? ' ↑' : ' ↓';
            th.appendChild(arrow);
        }
    });

    // Active filter chips
    renderActiveFilterChips(activeFilters);

    const totalLoaded = state.transactions.length;
    const totalFiltered = state.filteredTransactions.length;

    if (totalLoaded === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No transactions to display</td></tr>';
        pagination.innerHTML = '';
        if (resultCount) resultCount.textContent = 'No transactions loaded. Import a CSV to begin.';
        return;
    }
    if (totalFiltered === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No transactions match the current filters.</td></tr>';
        pagination.innerHTML = '';
        if (resultCount) resultCount.textContent = `0 of ${totalLoaded.toLocaleString()} transactions`;
        return;
    }

    // Sort
    const sorted = [...state.filteredTransactions].sort((a, b) => {
        let comparison = 0;
        switch (state.sort.field) {
            case 'date':
                comparison = a.date - b.date;
                break;
            case 'description':
                comparison = a.description.localeCompare(b.description);
                break;
            case 'amount':
                comparison = a.amount - b.amount;
                break;
        }
        return state.sort.direction === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const start = (state.pagination.page - 1) * state.pagination.perPage;
    const end = Math.min(start + state.pagination.perPage, sorted.length);
    const pageTransactions = sorted.slice(start, end);

    // Result count: "Showing {start}-{end} of {filtered}" — or just {filtered} when everything fits
    if (resultCount) {
        if (totalFiltered > state.pagination.perPage) {
            resultCount.textContent = `Showing ${start + 1}–${end} of ${totalFiltered.toLocaleString()}${totalFiltered !== totalLoaded ? ` (of ${totalLoaded.toLocaleString()} total)` : ''}`;
        } else {
            resultCount.textContent = `${totalFiltered.toLocaleString()} transaction${totalFiltered !== 1 ? 's' : ''}${totalFiltered !== totalLoaded ? ` (of ${totalLoaded.toLocaleString()} total)` : ''}`;
        }
    }

    // Render rows
    tbody.innerHTML = pageTransactions.map(t => {
        const catConfig = categories[t.category] || { color: '#64748b', icon: '📌' };
        return `
            <tr>
                <td class="date">${formatDate(t.date)}</td>
                <td class="description" title="${t.description}">${t.description}</td>
                <td>
                    <span class="category-badge" style="background: ${catConfig.color}20; color: ${catConfig.color}">
                        <span class="dot" style="background: ${catConfig.color}"></span>
                        ${t.category}
                    </span>
                </td>
                <td class="amount-cell debit">
                    -$${t.amount.toFixed(2)}
                </td>
            </tr>
        `;
    }).join('');

    // Render pagination
    const totalPages = Math.ceil(sorted.length / state.pagination.perPage);
    renderPagination(totalPages);
}

function renderActiveFilterChips(container) {
    if (!container) return;
    const chips = [];
    if (state.filters.search) {
        chips.push({ kind: 'search', label: `Search: “${state.filters.search}”` });
    }
    if (state.filters.category) {
        chips.push({ kind: 'category', label: `Category: ${state.filters.category}` });
    }
    if (chips.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = chips.map(c =>
        `<span class="filter-chip" data-kind="${c.kind}">
            <span class="filter-chip-label">${c.label}</span>
            <button class="filter-chip-remove" data-kind="${c.kind}" aria-label="Clear ${c.kind} filter">×</button>
        </span>`
    ).join('');
    container.querySelectorAll('.filter-chip-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const kind = btn.dataset.kind;
            if (kind === 'search') {
                state.filters.search = '';
                const input = document.getElementById('searchInput');
                if (input) input.value = '';
            } else if (kind === 'category') {
                state.filters.category = '';
                updateCategoryFilterUI();
                populateCategoryFilter();
            }
            applyFilters();
        });
    });
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1 || totalPages === 0) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = `<button ${state.pagination.page === 1 ? 'disabled' : ''} data-page="${state.pagination.page - 1}">← Prev</button>`;
    
    const maxVisible = 5;
    let startPage = Math.max(1, state.pagination.page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += `<button data-page="1">1</button>`;
        if (startPage > 2) html += `<span>...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="${i === state.pagination.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span>...</span>`;
        html += `<button data-page="${totalPages}">${totalPages}</button>`;
    }
    
    html += `<button ${state.pagination.page === totalPages ? 'disabled' : ''} data-page="${state.pagination.page + 1}">Next →</button>`;
    
    pagination.innerHTML = html;
    
    pagination.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page && page !== state.pagination.page) {
                state.pagination.page = page;
                renderTransactions();
            }
        });
    });
}

function exportToCSV() {
    if (state.filteredTransactions.length === 0) {
        alert('No transactions to export');
        return;
    }
    
    const headers = ['Date', 'Description', 'Category', 'Amount'];
    const rows = state.filteredTransactions.map(t => [
        formatDate(t.date),
        `"${t.description}"`,
        t.category,
        t.amount.toFixed(2)
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `spending-export-${formatDate(new Date()).replace(/\//g, '-')}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
}

// ===== Dashboard Updates =====
function updateDashboard() {
    updateQuickStats();
    renderInsightsLede();
    updateRecentTransactions();
    renderSubscriptionSection();
    renderCategoriesGrid();
    initCategorySorting();
    initDashboardCategoryToggle();
}

// ===== Sparkline helper =====
// Returns an inline SVG string for a numeric series. Stretches via viewBox.
function renderSparkline(values, { highlightLast = false, width = 120, height = 40 } = {}) {
    if (!values || values.length === 0) {
        return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"></svg>`;
    }
    if (values.length === 1) {
        // Single point — render a short flat line
        const y = height / 2;
        return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
            <path class="spark-line" d="M 0 ${y} L ${width} ${y}"/>
            ${highlightLast ? `<circle class="spark-last" cx="${width - 2}" cy="${y}" r="2.5"/>` : ''}
        </svg>`;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pad = 3;
    const step = (width - pad * 2) / (values.length - 1);
    const points = values.map((v, i) => {
        const x = pad + i * step;
        const y = height - pad - ((v - min) / range) * (height - pad * 2);
        return [x, y];
    });
    const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
    const [lx, ly] = points[points.length - 1];
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <path class="spark-line" d="${d}"/>
        ${highlightLast ? `<circle class="spark-last" cx="${lx.toFixed(2)}" cy="${ly.toFixed(2)}" r="2.5"/>` : ''}
    </svg>`;
}

// Month-key helpers (YYYY-MM)
function monthKeyOf(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function monthKeyOffset(key, offset) {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    return monthKeyOf(d);
}
function weekKeyOf(date) {
    // ISO-ish: Sunday-starting week containing the date
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateQuickStats() {
    const transactions = state.filteredTransactions;
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const thisMonthValueEl = document.getElementById('thisMonthSpent');
    const thisMonthDeltaEl = document.getElementById('thisMonthDelta');
    const thisMonthSparkEl = document.getElementById('thisMonthSpark');
    const thisMonthLabelEl = document.getElementById('tombstoneThisMonthLabel');
    const sixMonthValueEl = document.getElementById('sixMonthAvg');
    const sixMonthDeltaEl = document.getElementById('sixMonthDelta');
    const sixMonthSparkEl = document.getElementById('sixMonthSpark');
    const totalValueEl = document.getElementById('totalSpent');
    const totalMetaEl = document.getElementById('totalMeta');
    const totalSparkEl = document.getElementById('totalSpark');
    const totalLabelEl = document.getElementById('tombstoneTotalLabel');

    if (transactions.length === 0) {
        thisMonthValueEl.textContent = '$0.00';
        thisMonthDeltaEl.textContent = '—';
        thisMonthDeltaEl.className = 'tombstone-delta';
        thisMonthSparkEl.innerHTML = renderSparkline([]);
        thisMonthLabelEl.textContent = 'This month';
        sixMonthValueEl.textContent = '$0.00';
        sixMonthDeltaEl.textContent = '—';
        sixMonthDeltaEl.className = 'tombstone-delta';
        sixMonthSparkEl.innerHTML = renderSparkline([]);
        totalValueEl.textContent = '$0.00';
        totalMetaEl.textContent = '—';
        totalMetaEl.className = 'tombstone-delta';
        totalSparkEl.innerHTML = renderSparkline([]);
        totalLabelEl.textContent = 'Total tracked';
        return;
    }

    // Find the most-recent month present in the data. Using "now" is misleading
    // when the user is loading historical data.
    const latestDate = transactions.reduce((max, t) => t.date > max ? t.date : max, transactions[0].date);
    const currentMonthKey = monthKeyOf(latestDate);
    const [curY, curM] = currentMonthKey.split('-').map(Number);
    const curMonthLabel = `${MONTH_NAMES[curM - 1].slice(0, 3).toUpperCase()} '${String(curY).slice(2)}`;

    // Per-month totals
    const monthlyTotals = {};
    transactions.forEach(t => {
        const k = monthKeyOf(t.date);
        monthlyTotals[k] = (monthlyTotals[k] || 0) + t.amount;
    });

    // Tile 1: this (latest) month + delta vs previous month + 12-week sparkline
    const thisMonthTotal = monthlyTotals[currentMonthKey] || 0;
    const prevMonthKey = monthKeyOffset(currentMonthKey, -1);
    const prevMonthTotal = monthlyTotals[prevMonthKey] || 0;

    thisMonthValueEl.textContent = formatCurrency(thisMonthTotal);
    thisMonthLabelEl.textContent = `This month · ${curMonthLabel}`;
    setDelta(thisMonthDeltaEl, thisMonthTotal, prevMonthTotal, 'vs last month');

    // 12-week sparkline ending on the latest week
    const weeklyBuckets = buildWeeklyBuckets(transactions, latestDate, 12);
    thisMonthSparkEl.innerHTML = renderSparkline(weeklyBuckets, { highlightLast: true });

    // Tile 2: 6-month average + delta vs prior 6 months + 12-month sparkline
    const last6 = [];
    for (let i = 0; i < 6; i++) last6.push(monthlyTotals[monthKeyOffset(currentMonthKey, -i)] || 0);
    const sixAvg = last6.reduce((a, b) => a + b, 0) / 6;
    const prev6 = [];
    for (let i = 6; i < 12; i++) prev6.push(monthlyTotals[monthKeyOffset(currentMonthKey, -i)] || 0);
    const prevSixAvg = prev6.reduce((a, b) => a + b, 0) / 6;

    sixMonthValueEl.textContent = formatCurrency(sixAvg);
    setDelta(sixMonthDeltaEl, sixAvg, prevSixAvg, 'vs prior 6 mo');

    const monthly12 = [];
    for (let i = 11; i >= 0; i--) monthly12.push(monthlyTotals[monthKeyOffset(currentMonthKey, -i)] || 0);
    sixMonthSparkEl.innerHTML = renderSparkline(monthly12);

    // Tile 3: total tracked, range + tx count, cumulative sparkline
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const sortedMonthKeys = Object.keys(monthlyTotals).sort();
    const firstMonth = sortedMonthKeys[0];
    const lastMonth = sortedMonthKeys[sortedMonthKeys.length - 1];
    const [fY, fM] = firstMonth.split('-').map(Number);
    const [lY, lM] = lastMonth.split('-').map(Number);
    const monthsSpan = (lY - fY) * 12 + (lM - fM) + 1;

    totalValueEl.textContent = formatCurrency(totalSpent);
    totalLabelEl.textContent = `Total tracked · ${MONTH_NAMES[fM - 1].slice(0, 3)}–${MONTH_NAMES[lM - 1].slice(0, 3)}`;
    totalMetaEl.textContent = `${transactions.length.toLocaleString()} tx · ${monthsSpan} month${monthsSpan !== 1 ? 's' : ''}`;
    totalMetaEl.className = 'tombstone-delta';

    // Cumulative series (one point per month in order)
    const cumulative = [];
    let running = 0;
    sortedMonthKeys.forEach(k => {
        running += monthlyTotals[k];
        cumulative.push(running);
    });
    totalSparkEl.innerHTML = renderSparkline(cumulative);
}

function setDelta(el, current, previous, suffix) {
    if (!previous || previous === 0) {
        el.textContent = '—';
        el.className = 'tombstone-delta';
        return;
    }
    const pct = ((current - previous) / previous) * 100;
    const rounded = Math.round(pct);
    const sign = rounded > 0 ? '+' : '';
    const arrow = rounded >= 1 ? '↗' : rounded <= -1 ? '↘' : '→';
    el.textContent = `${sign}${rounded}% ${suffix} ${arrow}`;
    el.className = 'tombstone-delta';
    if (Math.abs(pct) >= 10) {
        el.classList.add(pct > 0 ? 'up' : 'down');
    }
}

function buildWeeklyBuckets(transactions, latestDate, count) {
    // Collect totals per week-key, then walk back `count` weeks from latestDate.
    const totals = {};
    transactions.forEach(t => {
        const k = weekKeyOf(t.date);
        totals[k] = (totals[k] || 0) + t.amount;
    });
    const buckets = [];
    const end = new Date(latestDate);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - end.getDay());
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(d.getDate() - i * 7);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        buckets.push(totals[k] || 0);
    }
    return buckets;
}

// ===== Insights =====
function computeInsights() {
    const transactions = state.filteredTransactions;
    if (transactions.length === 0) return [];

    const insights = [];
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Build monthly totals, per-category monthly totals, and latest month key
    const monthlyTotals = {};
    const categoryMonthly = {};
    const subscriptionsByMonth = {};
    transactions.forEach(t => {
        const k = monthKeyOf(t.date);
        monthlyTotals[k] = (monthlyTotals[k] || 0) + t.amount;
        const cat = t.category;
        if (!categoryMonthly[cat]) categoryMonthly[cat] = {};
        categoryMonthly[cat][k] = (categoryMonthly[cat][k] || 0) + t.amount;
        if (cat === 'Subscriptions') {
            if (!subscriptionsByMonth[k]) subscriptionsByMonth[k] = new Set();
            subscriptionsByMonth[k].add(simplifyMerchantName(t.description));
        }
    });

    const latestDate = transactions.reduce((max, t) => t.date > max ? t.date : max, transactions[0].date);
    const curKey = monthKeyOf(latestDate);
    const [curY, curM] = curKey.split('-').map(Number);
    const curMonthName = MONTH_NAMES[curM - 1];
    const curMonthTotal = monthlyTotals[curKey] || 0;
    const prevKey = monthKeyOffset(curKey, -1);
    const prevMonthTotal = monthlyTotals[prevKey] || 0;

    // 6-month average
    const last6 = [];
    for (let i = 0; i < 6; i++) last6.push(monthlyTotals[monthKeyOffset(curKey, -i)] || 0);
    const sixAvg = last6.reduce((a, b) => a + b, 0) / 6;

    const totalMonths = Object.keys(monthlyTotals).length;

    // Rule: data-scarce fallback
    if (transactions.length < 30 || totalMonths < 2) {
        insights.push({
            priority: 10,
            text: `Loaded <span class="num">${transactions.length.toLocaleString()}</span> transaction${transactions.length !== 1 ? 's' : ''} across <span class="num">${totalMonths}</span> month${totalMonths !== 1 ? 's' : ''}. Load more to unlock trends.`
        });
    }

    // Rule: month vs 6-mo avg
    if (sixAvg > 0 && curMonthTotal > 0) {
        const pct = ((curMonthTotal - sixAvg) / sixAvg) * 100;
        if (Math.abs(pct) >= 10) {
            const sign = pct > 0 ? '+' : '';
            const dir = pct > 0 ? 'above' : 'below';
            insights.push({
                priority: 100,
                text: `Tracking <span class="num">${sign}${Math.round(pct)}%</span> ${dir} your 6-month average this month.`
            });
        }
    }

    // Rule: month vs prior (paced to day-of-month)
    if (prevMonthTotal > 0 && curMonthTotal > 0) {
        const dayOfMonth = latestDate.getDate();
        const daysInPrevMonth = new Date(curY, curM - 1, 0).getDate();
        const pacedPrev = prevMonthTotal * (dayOfMonth / daysInPrevMonth);
        if (pacedPrev > 0) {
            const pct = ((curMonthTotal - pacedPrev) / pacedPrev) * 100;
            if (Math.abs(pct) >= 8) {
                const diff = curMonthTotal - pacedPrev;
                const sign = diff > 0 ? '+' : '−';
                const prevMonthIdx = curM - 2 < 0 ? 11 : curM - 2;
                insights.push({
                    priority: 90,
                    text: `Pacing <span class="num">${sign}${formatCurrency(Math.abs(diff))}</span> vs ${MONTH_NAMES[prevMonthIdx]} at the same day.`
                });
            }
        }
    }

    // Rule: fastest-growing category (MoM % up, current > $50)
    if (prevMonthTotal > 0) {
        let best = null;
        Object.entries(categoryMonthly).forEach(([cat, months]) => {
            if (cat === 'Subscriptions') return;
            const cur = months[curKey] || 0;
            const prev = months[prevKey] || 0;
            if (cur < 50 || prev <= 0) return;
            const pct = ((cur - prev) / prev) * 100;
            if (pct < 15) return;
            if (!best || pct > best.pct) best = { cat, pct, cur };
        });
        if (best) {
            insights.push({
                priority: 85,
                text: `<span class="num">${best.cat}</span> is up <span class="num">${Math.round(best.pct)}%</span> vs last month.`
            });
        }
    }

    // Rule: new recurring charge — in subs current month, absent in last 3 months
    const prev3Keys = [monthKeyOffset(curKey, -1), monthKeyOffset(curKey, -2), monthKeyOffset(curKey, -3)];
    const curSubs = subscriptionsByMonth[curKey] || new Set();
    const priorSubs = new Set();
    prev3Keys.forEach(k => (subscriptionsByMonth[k] || new Set()).forEach(m => priorSubs.add(m)));
    const newMerchants = [...curSubs].filter(m => !priorSubs.has(m));
    if (newMerchants.length > 0) {
        const merchant = newMerchants[0];
        const amount = transactions
            .filter(t => t.category === 'Subscriptions' && monthKeyOf(t.date) === curKey && simplifyMerchantName(t.description) === merchant)
            .reduce((s, t) => s + t.amount, 0);
        insights.push({
            priority: 80,
            text: `New recurring charge spotted: <span class="num">${merchant}</span> (<span class="num">${formatCurrency(amount)}</span>).`
        });
    }

    // Rule: concentration — top 3 categories > 70%
    if (curMonthTotal > 0) {
        const curCatTotals = Object.entries(categoryMonthly)
            .map(([cat, months]) => [cat, months[curKey] || 0])
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1]);
        const top3 = curCatTotals.slice(0, 3);
        const top3Sum = top3.reduce((s, [, v]) => s + v, 0);
        if (top3.length === 3 && top3Sum / curMonthTotal > 0.70) {
            const pct = Math.round((top3Sum / curMonthTotal) * 100);
            insights.push({
                priority: 55,
                text: `Top 3 categories account for <span class="num">${pct}%</span> of ${curMonthName} spending.`
            });
        }
    }

    // Rule: quiet week — last 7 days vs weekly avg
    const now = latestDate;
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const fourWeeksAgo = new Date(now); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const lastWeekTotal = transactions.filter(t => t.date > weekAgo && t.date <= now).reduce((s, t) => s + t.amount, 0);
    const fourWeekTotal = transactions.filter(t => t.date > fourWeeksAgo && t.date <= now).reduce((s, t) => s + t.amount, 0);
    const weekAvg = fourWeekTotal / 4;
    if (weekAvg > 0 && lastWeekTotal < weekAvg * 0.70) {
        const pct = Math.round((1 - lastWeekTotal / weekAvg) * 100);
        insights.push({
            priority: 40,
            text: `Spending has slowed — this week is <span class="num">${pct}%</span> below your weekly average.`
        });
    }

    insights.sort((a, b) => b.priority - a.priority);
    return insights.slice(0, 3);
}

function renderInsightsLede() {
    const container = document.getElementById('insightsLede');
    const head = document.getElementById('insightsHead');
    const list = document.getElementById('insightsList');
    if (!container || !head || !list) return;

    const insights = computeInsights();
    if (insights.length === 0) {
        container.hidden = true;
        return;
    }
    container.hidden = false;

    // Eyebrow text — use the latest month's name if we have data
    const transactions = state.filteredTransactions;
    if (transactions.length > 0) {
        const latest = transactions.reduce((max, t) => t.date > max ? t.date : max, transactions[0].date);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        head.textContent = `Key insights · ${monthNames[latest.getMonth()]} ${latest.getFullYear()}`;
    } else {
        head.textContent = 'Key insights';
    }

    list.innerHTML = insights.map((ins, i) =>
        `<li class="${i === 0 ? 'primary' : ''}">${ins.text}</li>`
    ).join('');
}

// ===== Subscription Section =====
function renderSubscriptionSection() {
    const transactions = state.filteredTransactions;
    const subscriptionTrans = transactions.filter(t => t.category === 'Subscriptions');
    
    const totalValue = document.getElementById('subscriptionTotal');
    const timeline = document.getElementById('subscriptionTimeline');
    const breakdown = document.getElementById('subscriptionBreakdown');
    
    if (subscriptionTrans.length === 0) {
        totalValue.textContent = '$0.00';
        timeline.innerHTML = '<div class="empty-state small">No subscription data available</div>';
        breakdown.innerHTML = '';
        return;
    }
    
    // Calculate total
    const total = subscriptionTrans.reduce((sum, t) => sum + t.amount, 0);
    totalValue.textContent = formatCurrency(total);
    
    // Group by month
    const monthlyData = {};
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    subscriptionTrans.forEach(t => {
        const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { total: 0, transactions: [] };
        }
        monthlyData[monthKey].total += t.amount;
        monthlyData[monthKey].transactions.push(t);
    });
    
    // Sort months (most recent first for display)
    const sortedMonths = Object.keys(monthlyData).sort().reverse();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Render monthly timeline
    timeline.innerHTML = sortedMonths.map(monthKey => {
        const [year, month] = monthKey.split('-');
        const monthName = monthNames[parseInt(month) - 1];
        const isCurrent = monthKey === currentMonthKey;
        return `
            <div class="month-pill ${isCurrent ? 'current' : ''}" data-month="${monthKey}">
                <span class="month-pill-name">${monthName} '${year.slice(2)}</span>
                <span class="month-pill-amount">${formatCurrency(monthlyData[monthKey].total)}</span>
            </div>
        `;
    }).join('');
    
    // Group subscription items by merchant for breakdown
    const merchantTotals = {};
    subscriptionTrans.forEach(t => {
        const name = simplifyMerchantName(t.description);
        if (!merchantTotals[name]) {
            merchantTotals[name] = { total: 0, count: 0 };
        }
        merchantTotals[name].total += t.amount;
        merchantTotals[name].count++;
    });
    
    // Sort merchants by total descending
    const sortedMerchants = Object.entries(merchantTotals)
        .sort((a, b) => b[1].total - a[1].total);
    
    // Take top items (already sorted above)
    const topMerchants = sortedMerchants.slice(0, 12);
    
    breakdown.innerHTML = topMerchants.map(([name, data]) => `
        <div class="sub-item">
            <span class="sub-item-name" title="${name}">${name}</span>
            <span class="sub-item-amount">${formatCurrency(data.total)}</span>
            <span class="sub-item-count">${data.count}x</span>
        </div>
    `).join('');
}

// ===== Categories Grid =====
function renderCategoriesGrid(sortBy = 'amount') {
    const container = document.getElementById('categoriesGrid');
    const transactions = state.filteredTransactions;
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state">No data available. Load some CSV files first.</div>';
        return;
    }
    
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Group transactions by DISPLAY category (aggregated)
    const categoryData = {};
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    transactions.forEach(t => {
        // Get the display category (aggregated)
        const displayCat = getDisplayCategory(t.category);
        
        if (!categoryData[displayCat]) {
            categoryData[displayCat] = {
                total: 0,
                count: 0,
                transactions: [],
                monthly: {},
                merchants: {},
                subCategories: {} // Track sub-categories for groups
            };
        }
        
        const cat = categoryData[displayCat];
        cat.total += t.amount;
        cat.count++;
        cat.transactions.push(t);
        
        // Track sub-category totals
        if (displayCat !== t.category) {
            if (!cat.subCategories[t.category]) {
                cat.subCategories[t.category] = { total: 0, count: 0 };
            }
            cat.subCategories[t.category].total += t.amount;
            cat.subCategories[t.category].count++;
        }
        
        // Monthly breakdown
        const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
        cat.monthly[monthKey] = (cat.monthly[monthKey] || 0) + t.amount;
        
        // Merchant breakdown
        const merchant = simplifyMerchantName(t.description);
        if (!cat.merchants[merchant]) {
            cat.merchants[merchant] = { total: 0, count: 0 };
        }
        cat.merchants[merchant].total += t.amount;
        cat.merchants[merchant].count++;
    });
    
    // Sort categories
    let sortedCategories = Object.entries(categoryData);
    if (sortBy === 'amount') {
        sortedCategories.sort((a, b) => b[1].total - a[1].total);
    } else {
        sortedCategories.sort((a, b) => a[0].localeCompare(b[0]));
    }
    
    // Filter out Subscriptions (it has its own section)
    sortedCategories = sortedCategories.filter(([cat]) => cat !== 'Subscriptions');
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Build a 12-month window ending at the latest present month
    const allMonthKeys = [...new Set(transactions.map(t => monthKeyOf(t.date)))].sort();
    const latestKey = allMonthKeys[allMonthKeys.length - 1] || currentMonthKey;
    const window12 = [];
    for (let i = 11; i >= 0; i--) window12.push(monthKeyOffset(latestKey, -i));

    container.innerHTML = sortedCategories.map(([cat, data]) => {
        const catConfig = getDisplayCategoryConfig(cat);
        const percentage = ((data.total / totalSpent) * 100).toFixed(1);
        const safeId = cat.replace(/[^a-zA-Z0-9]/g, '-');

        // 12-month series for the sparkline
        const series = window12.map(k => data.monthly[k] || 0);

        // Top 3 merchants, inline
        const topMerchants = Object.entries(data.merchants)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 3);

        return `
            <div class="category-card" data-category="${cat}" role="button" tabindex="0" aria-expanded="false" aria-controls="dash-cat-${safeId}">
                <div class="category-card-row">
                    <div class="category-card-label">
                        <span class="category-card-dot" style="background: ${catConfig.color}"></span>
                        <span class="category-card-name">${cat}</span>
                        <span class="category-card-count">· ${data.count} tx</span>
                    </div>
                    <div class="category-card-total">
                        <span class="category-card-amount">${formatCurrency(data.total)}</span>
                        <span class="category-card-percent">${percentage}% of total</span>
                    </div>
                </div>
                <div class="category-card-spark">${renderSparkline(series)}</div>
                ${topMerchants.length > 0 ? `
                    <div class="category-card-merchants">
                        ${topMerchants.map(([name, mData]) => `
                            <span class="merchant-inline">
                                <span class="merchant-inline-name" title="${name}">${name}</span>
                                <span class="merchant-inline-amount">${formatCurrency(mData.total)}</span>
                            </span>
                        `).join('<span class="merchant-sep">·</span>')}
                    </div>
                ` : ''}
                <div class="category-card-transactions" id="dash-cat-${safeId}" data-expanded="false">
                    <div class="category-card-transactions-header">
                        <span class="transactions-title">All transactions</span>
                        <span class="transactions-count">${data.count} total</span>
                    </div>
                    <div class="category-card-transactions-list">
                        ${data.transactions.sort((a, b) => b.date - a.date).map(t => `
                            <div class="dash-transaction-item">
                                <span class="dash-tx-date">${formatDate(t.date)}</span>
                                <span class="dash-tx-desc" title="${t.description}">${t.description}</span>
                                <span class="dash-tx-amount">-$${t.amount.toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function initCategorySorting() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCategoriesGrid(btn.dataset.sort);
        });
    });
}

function initDashboardCategoryToggle() {
    document.querySelectorAll('.category-card').forEach(card => {
        const toggle = () => {
            const category = card.dataset.category;
            const transactionsEl = document.getElementById(`dash-cat-${category.replace(/[^a-zA-Z0-9]/g, '-')}`);
            if (!transactionsEl) return;
            const isExpanded = transactionsEl.dataset.expanded === 'true';
            transactionsEl.dataset.expanded = !isExpanded;
            card.classList.toggle('expanded', !isExpanded);
            card.setAttribute('aria-expanded', String(!isExpanded));
            if (!isExpanded) {
                transactionsEl.style.maxHeight = transactionsEl.scrollHeight + 'px';
            } else {
                transactionsEl.style.maxHeight = '0';
            }
        };
        card.addEventListener('click', toggle);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
    });
}

function updateTopMerchants() {
    const container = document.getElementById('topMerchants');
    const transactions = state.filteredTransactions;
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state small">No data available</div>';
        return;
    }
    
    // Group by merchant (simplified description)
    const merchants = {};
    transactions.forEach(t => {
        const name = simplifyMerchantName(t.description);
        if (!merchants[name]) {
            merchants[name] = { total: 0, count: 0 };
        }
        merchants[name].total += t.amount;
        merchants[name].count++;
    });
    
    // Sort by total spent
    const sorted = Object.entries(merchants)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5);
    
    container.innerHTML = sorted.map(([name, data], i) => `
        <div class="merchant-item">
            <span class="merchant-rank">${i + 1}</span>
            <div class="merchant-info">
                <div class="merchant-name">${name}</div>
                <div class="merchant-count">${data.count} transaction${data.count !== 1 ? 's' : ''}</div>
            </div>
            <span class="merchant-amount">$${data.total.toFixed(2)}</span>
        </div>
    `).join('');
}

function simplifyMerchantName(description) {
    // Clean up merchant names for grouping
    let name = description
        .replace(/\*[A-Z0-9]+$/i, '')
        .replace(/\s*-\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Common simplifications
    if (name.toLowerCase().includes('uber') && name.toLowerCase().includes('eats')) {
        return 'Uber Eats';
    }
    if (name.toLowerCase().includes('uber canada') || name.toLowerCase().includes('uber holdings')) {
        return 'Uber';
    }
    if (name.toLowerCase().includes('costco') && name.toLowerCase().includes('instacart')) {
        return 'Costco (Instacart)';
    }
    if (name.toLowerCase().includes('amazon') || name.toLowerCase().includes('amzn')) {
        return 'Amazon';
    }
    if (name.toLowerCase().includes('doordash')) {
        return 'DoorDash';
    }
    
    return name;
}

function updateRecentTransactions() {
    const container = document.getElementById('recentTransactions');
    const transactions = state.filteredTransactions.slice(0, 8);
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state small">No data available</div>';
        return;
    }
    
    container.innerHTML = transactions.map(t => {
        const catConfig = categories[t.category] || { color: '#64748b', icon: '📌' };
        return `
            <div class="recent-activity-item">
                <div class="recent-activity-icon" style="background: ${catConfig.color}20">
                    ${catConfig.icon}
                </div>
                <div class="recent-activity-info">
                    <div class="recent-activity-desc">${t.description}</div>
                    <div class="recent-activity-meta">
                        <span>${formatDate(t.date)}</span>
                        <span class="recent-activity-category" style="background: ${catConfig.color}20; color: ${catConfig.color}">${t.category}</span>
                    </div>
                </div>
                <span class="recent-activity-amount">
                    -$${t.amount.toFixed(2)}
                </span>
            </div>
        `;
    }).join('');
}

// ===== Monthly Breakdown =====
function renderMonthlyBreakdown() {
    const container = document.getElementById('monthlyBreakdown');
    const transactions = state.filteredTransactions;
    
    // Update the monthly spend chart
    updateMonthlySpendChart();
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state">No data available. Load some CSV files first.</div>';
        return;
    }
    
    // Group transactions by month, using DISPLAY categories (aggregated)
    const monthlyData = {};
    transactions.forEach(t => {
        const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
        const displayCat = getDisplayCategory(t.category);
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                total: 0,
                categories: {},
                categoryTransactions: {},
                subCategories: {}, // Track sub-categories within each display category
                transactions: []
            };
        }
        monthlyData[monthKey].total += t.amount;
        monthlyData[monthKey].categories[displayCat] = (monthlyData[monthKey].categories[displayCat] || 0) + t.amount;
        
        // Store transactions per display category
        if (!monthlyData[monthKey].categoryTransactions[displayCat]) {
            monthlyData[monthKey].categoryTransactions[displayCat] = [];
        }
        monthlyData[monthKey].categoryTransactions[displayCat].push(t);
        
        // Track sub-categories for grouped categories
        if (displayCat !== t.category) {
            if (!monthlyData[monthKey].subCategories[displayCat]) {
                monthlyData[monthKey].subCategories[displayCat] = {};
            }
            if (!monthlyData[monthKey].subCategories[displayCat][t.category]) {
                monthlyData[monthKey].subCategories[displayCat][t.category] = { total: 0, transactions: [] };
            }
            monthlyData[monthKey].subCategories[displayCat][t.category].total += t.amount;
            monthlyData[monthKey].subCategories[displayCat][t.category].transactions.push(t);
        }
        
        monthlyData[monthKey].transactions.push(t);
    });
    
    // Sort months descending (most recent first)
    const sortedMonths = Object.keys(monthlyData).sort().reverse();
    
    // Generate HTML for each month
    container.innerHTML = sortedMonths.map(monthKey => {
        const data = monthlyData[monthKey];
        const [year, month] = monthKey.split('-');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[parseInt(month) - 1];
        
        // Sort categories by amount
        const sortedCategories = Object.entries(data.categories)
            .sort((a, b) => b[1] - a[1]);
        
        return `
            <div class="month-card">
                <div class="month-header">
                    <div class="month-title">
                        <h3>${monthName} ${year}</h3>
                        <span class="month-transaction-count">${data.transactions.length} transactions</span>
                    </div>
                    <div class="month-total">
                        <span class="month-total-label">Total Spent</span>
                        <span class="month-total-amount">$${data.total.toFixed(2)}</span>
                    </div>
                </div>
                <div class="month-categories">
                    ${sortedCategories.map(([cat, amount]) => {
                        const catConfig = getDisplayCategoryConfig(cat);
                        const percentage = ((amount / data.total) * 100).toFixed(1);
                        const catTransactions = data.categoryTransactions[cat] || [];
                        const categoryId = `${monthKey}-${cat.replace(/[^a-zA-Z0-9]/g, '-')}`;
                        const subCats = data.subCategories[cat] || {};
                        const hasSubCategories = Object.keys(subCats).length > 0;
                        
                        // Sort sub-categories by amount
                        const sortedSubCats = Object.entries(subCats)
                            .sort((a, b) => b[1].total - a[1].total);
                        
                        return `
                            <div class="category-row-wrapper">
                                <div class="category-row" role="button" tabindex="0" aria-expanded="false" aria-controls="${categoryId}" data-category-id="${categoryId}">
                                    <div class="category-info">
                                        <span class="category-dot" style="background: ${catConfig.color}"></span>
                                        <span class="category-name">${cat}</span>
                                        ${hasSubCategories ? `<span class="subcategory-count">${Object.keys(subCats).length} types</span>` : ''}
                                    </div>
                                    <div class="category-bar-wrapper">
                                        <div class="category-bar" style="width: ${percentage}%; background: ${catConfig.color}"></div>
                                    </div>
                                    <div class="category-stats">
                                        <span class="category-amount">$${amount.toFixed(2)}</span>
                                        <span class="category-percentage">${percentage}%</span>
                                        <span class="category-chevron" aria-hidden="true">›</span>
                                    </div>
                                </div>
                                <div class="category-transactions" id="${categoryId}" data-expanded="false">
                                    ${hasSubCategories ? `
                                        <div class="subcategory-breakdown">
                                            <div class="subcategory-header">
                                                <span class="subcategory-title">Breakdown by type · click a row to filter</span>
                                            </div>
                                            <div class="subcategory-bars" data-parent-id="${categoryId}">
                                                ${sortedSubCats.map(([subCat, subData]) => {
                                                    const subConfig = categories[subCat] || { color: '#64748b', icon: '📌' };
                                                    const subPercentage = ((subData.total / amount) * 100).toFixed(1);
                                                    return `
                                                        <button class="subcategory-bar-row" data-subcategory="${subCat}" type="button">
                                                            <span class="subcategory-name">${subCat.replace(' Restaurants', '').replace('Restaurants (General)', 'Other')}</span>
                                                            <div class="subcategory-bar-track">
                                                                <div class="subcategory-bar" style="width: ${subPercentage}%; background: ${subConfig.color}"></div>
                                                            </div>
                                                            <span class="subcategory-amount">$${subData.total.toFixed(2)}</span>
                                                        </button>
                                                    `;
                                                }).join('')}
                                            </div>
                                        </div>
                                    ` : ''}
                                    <div class="category-transactions-header">
                                        <span class="transactions-count">${catTransactions.length} transaction${catTransactions.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div class="category-transactions-list">
                                        ${catTransactions.sort((a, b) => b.date - a.date).map(t => {
                                            const txSubConfig = categories[t.category] || { icon: '📌' };
                                            return `
                                            <div class="category-transaction-item" data-tx-category="${t.category}">
                                                ${hasSubCategories ? `<span class="transaction-subcat-icon" title="${t.category}">${txSubConfig.icon}</span>` : ''}
                                                <span class="transaction-date">${formatDate(t.date)}</span>
                                                <span class="transaction-desc" title="${t.description}">${t.description}</span>
                                                <span class="transaction-amount">-$${t.amount.toFixed(2)}</span>
                                            </div>
                                        `}).join('')}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
    
    initCategoryToggle();
    initSubcategoryClickFilters();
}

function initCategoryToggle() {
    document.querySelectorAll('.category-row').forEach(row => {
        const toggle = () => {
            const categoryId = row.dataset.categoryId;
            const transactionsEl = document.getElementById(categoryId);
            if (!transactionsEl) return;
            const isExpanded = transactionsEl.dataset.expanded === 'true';
            transactionsEl.dataset.expanded = !isExpanded;
            row.classList.toggle('expanded', !isExpanded);
            row.setAttribute('aria-expanded', String(!isExpanded));
            if (!isExpanded) {
                transactionsEl.style.maxHeight = transactionsEl.scrollHeight + 'px';
            } else {
                transactionsEl.style.maxHeight = '0';
            }
        };
        row.addEventListener('click', toggle);
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
    });
}

// Click a subcategory bar row to filter the transaction list below to that subcategory.
// Clicking the same active row clears the filter.
function initSubcategoryClickFilters() {
    document.querySelectorAll('.subcategory-bars').forEach(bars => {
        const parentId = bars.dataset.parentId;
        const transactionsEl = document.getElementById(parentId);
        if (!transactionsEl) return;
        const list = transactionsEl.querySelector('.category-transactions-list');
        const countEl = transactionsEl.querySelector('.transactions-count');
        const totalItems = list ? list.querySelectorAll('.category-transaction-item') : [];

        bars.querySelectorAll('.subcategory-bar-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // don't collapse the parent row
                const sub = btn.dataset.subcategory;
                const wasActive = btn.classList.contains('active');

                // Clear all
                bars.querySelectorAll('.subcategory-bar-row.active').forEach(b => b.classList.remove('active'));

                if (wasActive) {
                    // Show all
                    totalItems.forEach(item => { item.style.display = ''; });
                    if (countEl) countEl.textContent = `${totalItems.length} transaction${totalItems.length !== 1 ? 's' : ''}`;
                } else {
                    btn.classList.add('active');
                    let visible = 0;
                    totalItems.forEach(item => {
                        const show = item.dataset.txCategory === sub;
                        item.style.display = show ? '' : 'none';
                        if (show) visible++;
                    });
                    if (countEl) countEl.textContent = `${visible} transaction${visible !== 1 ? 's' : ''}`;
                }

                // Re-measure the expanded container height so the list resize animates correctly
                if (transactionsEl.dataset.expanded === 'true') {
                    // Allow layout to reflow, then set max-height
                    requestAnimationFrame(() => {
                        transactionsEl.style.maxHeight = transactionsEl.scrollHeight + 'px';
                    });
                }
            });
        });
    });
}

// ===== Charts =====
let spendingChart = null;
let categoryChart = null;
let monthlySpendChart = null;

function initCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    Chart.defaults.color = '#707070';
    Chart.defaults.borderColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(10, 10, 10, 0.07)';
    Chart.defaults.font.family = "'Geist', ui-sans-serif, system-ui, sans-serif";

    // Period buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateSpendingChart(btn.dataset.period);
        });
    });
}

function updateCharts() {
    updateSpendingChart('daily');
    updateCategoryChart();
}

function updateSpendingChart(period = 'daily') {
    const canvas = document.getElementById('spendingChart');
    if (!canvas) return; // Charts removed from dashboard
    
    const ctx = canvas.getContext('2d');
    const transactions = state.filteredTransactions;
    
    if (transactions.length === 0) {
        if (spendingChart) {
            spendingChart.destroy();
            spendingChart = null;
        }
        return;
    }
    
    // Group transactions by period
    const grouped = groupTransactionsByPeriod(transactions, period);
    const labels = Object.keys(grouped).sort();
    const data = labels.map(label => grouped[label]);
    
    if (spendingChart) {
        spendingChart.destroy();
    }
    
    spendingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(l => formatChartLabel(l, period)),
            datasets: [{
                label: 'Spending',
                data: data,
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1,
                borderRadius: 4,
                barThickness: period === 'daily' ? 8 : period === 'weekly' ? 20 : 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a2234',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: '#2a3548',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: ctx => `$${ctx.raw.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, minRotation: 0 }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#2a354850' },
                    ticks: {
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            }
        }
    });
}

function groupTransactionsByPeriod(transactions, period) {
    const grouped = {};
    
    transactions.forEach(t => {
        let key;
        const date = t.date;
        
        switch (period) {
            case 'daily':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                break;
            case 'weekly':
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate()) / 7)).padStart(2, '0')}-${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
                break;
            case 'monthly':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
        }
        
        grouped[key] = (grouped[key] || 0) + t.amount;
    });
    
    return grouped;
}

function formatChartLabel(key, period) {
    switch (period) {
        case 'daily':
            const [y, m, d] = key.split('-');
            return `${m}/${d}`;
        case 'weekly':
            const parts = key.split('-');
            return `Week ${parts[1].replace('W', '')}`;
        case 'monthly':
            const [year, month] = key.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return monthNames[parseInt(month) - 1];
    }
    return key;
}

function updateCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    const legendContainer = document.getElementById('categoryLegend');
    if (!canvas || !legendContainer) return; // Charts removed from dashboard
    
    const ctx = canvas.getContext('2d');
    const transactions = state.filteredTransactions;
    
    if (transactions.length === 0) {
        if (categoryChart) {
            categoryChart.destroy();
            categoryChart = null;
        }
        legendContainer.innerHTML = '';
        return;
    }
    
    // Group by category
    const categoryTotals = {};
    transactions.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });
    
    // Sort by total
    const sorted = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sorted.map(([cat]) => cat);
    const data = sorted.map(([, total]) => total);
    const colors = sorted.map(([cat]) => (categories[cat]?.color || '#64748b'));
    
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: '#1a2234',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a2234',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: '#2a3548',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((ctx.raw / total) * 100).toFixed(1);
                            return `$${ctx.raw.toFixed(2)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Update legend
    const total = data.reduce((a, b) => a + b, 0);
    legendContainer.innerHTML = sorted.slice(0, 6).map(([cat, amount]) => `
        <div class="legend-item">
            <span class="legend-dot" style="background: ${categories[cat]?.color || '#64748b'}"></span>
            <span>${cat}</span>
            <span class="legend-value">${((amount / total) * 100).toFixed(0)}%</span>
        </div>
    `).join('');
}

function updateMonthlySpendChart() {
    const canvas = document.getElementById('monthlySpendChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const transactions = state.filteredTransactions;
    
    // Update stats
    const avgEl = document.getElementById('avgMonthlySpend');
    const highEl = document.getElementById('highestMonthlySpend');
    const lowEl = document.getElementById('lowestMonthlySpend');
    
    if (transactions.length === 0) {
        if (monthlySpendChart) {
            monthlySpendChart.destroy();
            monthlySpendChart = null;
        }
        if (avgEl) avgEl.textContent = '$0';
        if (highEl) highEl.textContent = '$0';
        if (lowEl) lowEl.textContent = '$0';
        return;
    }
    
    // Group transactions by month
    const monthlyTotals = {};
    transactions.forEach(t => {
        const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + t.amount;
    });
    
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyTotals).sort();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const labels = sortedMonths.map(key => {
        const [year, month] = key.split('-');
        return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
    });
    const data = sortedMonths.map(key => monthlyTotals[key]);
    
    // Calculate stats
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const highest = Math.max(...data);
    const lowest = Math.min(...data);
    
    if (avgEl) avgEl.textContent = formatCurrency(avg);
    if (highEl) highEl.textContent = formatCurrency(highest);
    if (lowEl) lowEl.textContent = formatCurrency(lowest);
    
    const themeIsDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const paletteLow  = themeIsDark ? 'rgba(167, 212, 148, 0.85)' : 'rgba(94, 154, 78, 0.85)';
    const paletteMid  = themeIsDark ? 'rgba(233, 188, 109, 0.88)' : 'rgba(184, 131, 35, 0.85)';
    const paletteHigh = themeIsDark ? 'rgba(255, 107, 74, 0.90)'  : 'rgba(231, 83, 52, 0.90)';
    const paletteLowBorder  = themeIsDark ? '#A7D494' : '#5E9A4E';
    const paletteMidBorder  = themeIsDark ? '#E9BC6D' : '#B88323';
    const paletteHighBorder = themeIsDark ? '#FF6B4A' : '#E75334';

    const colors = data.map(value => {
        const ratio = (value - lowest) / (highest - lowest || 1);
        if (ratio < 0.33)      return paletteLow;
        else if (ratio < 0.66) return paletteMid;
        else                   return paletteHigh;
    });

    const borderColors = data.map((value, i) => {
        if (value === highest) return paletteHighBorder;
        if (value === lowest && highest !== lowest) return paletteLowBorder;
        return 'transparent';
    });
    // Peak gets a visible top border, others stay borderless
    const borderWidths = data.map(value => value === highest ? 2 : 0);

    if (monthlySpendChart) {
        monthlySpendChart.destroy();
    }
    
    // Theme-aware chart colors (matches styles.css tokens)
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const tooltipBg     = isDark ? '#191A1E' : '#FFFFFF';
    const tooltipTitle  = isDark ? '#ECECEC' : '#0A0A0A';
    const tooltipBody   = isDark ? '#B0B0B0' : '#3A3A3A';
    const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(10, 10, 10, 0.14)';
    const gridColor     = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(10, 10, 10, 0.07)';
    const tickColor     = isDark ? '#707070' : '#707070';
    const mutedColor    = isDark ? '#4A4A4A' : '#A8A8A8';
    
    // Average line dataset — same value at every point, rendered as a dashed line
    const avgSeries = data.map(() => avg);

    monthlySpendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Monthly Spending',
                    data: data,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: borderWidths,
                    borderRadius: 8,
                    borderSkipped: false,
                    barThickness: data.length > 8 ? 22 : 38,
                    order: 2
                },
                {
                    type: 'line',
                    label: 'Average',
                    data: avgSeries,
                    borderColor: mutedColor,
                    borderWidth: 1,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0,
                    fill: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: tooltipTitle,
                    bodyColor: tooltipBody,
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    padding: 16,
                    cornerRadius: 10,
                    displayColors: false,
                    filter: (ctx) => ctx.datasetIndex === 0, // hide the avg-line dataset from tooltip
                    callbacks: {
                        title: (items) => items[0].label,
                        label: (ctx) => {
                            const value = ctx.raw;
                            const diff = value - avg;
                            const diffPercent = ((diff / avg) * 100).toFixed(0);
                            const sign = diff >= 0 ? '+' : '';
                            const tag = value === highest ? ' · peak' : value === lowest && highest !== lowest ? ' · low' : '';
                            return [
                                `${formatCurrency(value)}${tag}`,
                                `${sign}${diffPercent}% vs average`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: tickColor,
                        font: { size: 11, weight: '500' }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: mutedColor,
                        font: { size: 11 },
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            },
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            }
        }
    });
}

// ===== Utility Functions =====
function formatDate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

function formatCurrency(amount) {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
