// ===== SpendScope - Spending Analyzer Application =====
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

// Discover CSV files in the accountactivity folder
async function discoverCSVFiles() {
    const discovered = new Set();
    
    // Method 1: Try loading from manifest file (most reliable)
    try {
        const manifestResponse = await fetch('accountactivity/files.json');
        if (manifestResponse.ok) {
            const manifest = await manifestResponse.json();
            if (Array.isArray(manifest)) {
                manifest.forEach(f => discovered.add(f.startsWith('accountactivity/') ? f : `accountactivity/${f}`));
            }
        }
    } catch (e) {
        // Manifest not available
    }
    
    // Method 2: Try fetching directory listing (works on some servers like Python's http.server)
    if (discovered.size === 0) {
        try {
            const response = await fetch('accountactivity/');
            if (response.ok) {
                const html = await response.text();
                // Parse directory listing for .csv files - handles various server formats
                const csvMatches = html.match(/href="([^"]*\.csv)"/gi) || [];
                const csvMatches2 = html.match(/>([^<>]+\.csv)</gi) || [];
                
                for (const match of [...csvMatches, ...csvMatches2]) {
                    let filename = match.replace(/^href="|"$|^>|<$/g, '');
                    if (filename.endsWith('.csv')) {
                        if (!filename.includes('/')) {
                            filename = `accountactivity/${filename}`;
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
    initNavigation();
    initDatePickers();
    initUploadZone();
    initExistingFiles();
    initTransactionControls();
    initCharts();
});

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
        dashboard: ['Dashboard', 'Overview of your spending patterns'],
        monthly: ['Monthly Breakdown', 'Detailed spending by category for each month'],
        transactions: ['Transactions', 'Browse and search all your spending'],
        upload: ['Import Data', 'Upload CSV files or load existing data']
    };
    
    document.getElementById('pageTitle').textContent = titles[view]?.[0] || 'Dashboard';
    document.getElementById('pageSubtitle').textContent = titles[view]?.[1] || '';
    
    // Refresh view data
    if (view === 'dashboard') updateDashboard();
    if (view === 'monthly') renderMonthlyBreakdown();
    if (view === 'transactions') renderTransactions();
}

// ===== Date Pickers =====
function initDatePickers() {
    document.getElementById('applyDateFilter').addEventListener('click', () => {
        const from = document.getElementById('dateFrom').value;
        const to = document.getElementById('dateTo').value;
        state.dateRange.from = from ? new Date(from) : null;
        state.dateRange.to = to ? new Date(to) : null;
        applyFilters();
    });
    
    document.getElementById('resetDateFilter').addEventListener('click', () => {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        state.dateRange.from = null;
        state.dateRange.to = null;
        applyFilters();
    });
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
                <small>Add files to accountactivity/files.json or use drag & drop above.</small>
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
    
    if (count > 0) {
        status.classList.add('loaded');
        status.querySelector('span').textContent = `${count} transactions`;
    } else {
        status.classList.remove('loaded');
        status.querySelector('span').textContent = 'No data loaded';
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
    
    // Category filter
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        state.filters.category = e.target.value;
        applyFilters();
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

function populateCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    const currentValue = select.value;
    
    // Get unique categories from transactions
    const cats = [...new Set(state.transactions.map(t => t.category))].sort();
    
    select.innerHTML = '<option value="">All Categories</option>' + 
        cats.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    
    select.value = currentValue;
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    const pagination = document.getElementById('pagination');
    
    if (state.filteredTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No transactions to display</td></tr>';
        pagination.innerHTML = '';
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
    const end = start + state.pagination.perPage;
    const pageTransactions = sorted.slice(start, end);
    
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
    if (state.filteredTransactions.length === 0) return;
    
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
    renderSubscriptionSection();
    renderCategoriesGrid();
    updateRecentTransactions();
    initCategorySorting();
}

function updateQuickStats() {
    const transactions = state.filteredTransactions;
    
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate this month's spending
    const now = new Date();
    const thisMonthTransactions = transactions.filter(t => 
        t.date.getMonth() === now.getMonth() && 
        t.date.getFullYear() === now.getFullYear()
    );
    const thisMonthSpent = thisMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Get unique categories count
    const categoryCount = new Set(transactions.map(t => t.category)).size;
    
    document.getElementById('totalSpent').textContent = formatCurrency(totalSpent);
    document.getElementById('thisMonthSpent').textContent = formatCurrency(thisMonthSpent);
    document.getElementById('categoryCount').textContent = categoryCount;
    document.getElementById('transactionCount').textContent = transactions.length.toLocaleString();
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
    
    // Sort by total and take top items
    const sortedMerchants = Object.entries(merchantTotals)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 12);
    
    breakdown.innerHTML = sortedMerchants.map(([name, data]) => `
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
    
    container.innerHTML = sortedCategories.map(([cat, data]) => {
        const catConfig = getDisplayCategoryConfig(cat);
        const percentage = ((data.total / totalSpent) * 100).toFixed(1);
        
        // Get last 6 months
        const allMonths = Object.keys(data.monthly).sort().reverse().slice(0, 6);
        
        // Get top merchants
        const topMerchants = Object.entries(data.merchants)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 3);
        
        // Check if this is a grouped category with sub-categories
        const hasSubCategories = Object.keys(data.subCategories).length > 0;
        const sortedSubCategories = Object.entries(data.subCategories)
            .sort((a, b) => b[1].total - a[1].total);
        
        return `
            <div class="category-card" data-category="${cat}">
                <div class="category-card-header" style="--cat-color: ${catConfig.color}">
                    <div class="category-card-icon" style="background: ${catConfig.color}20;">
                        ${catConfig.icon}
                    </div>
                    <div class="category-card-info">
                        <div class="category-card-name">${cat}</div>
                        <div class="category-card-count">${data.count} transaction${data.count !== 1 ? 's' : ''}</div>
                    </div>
                    <div class="category-card-total">
                        <div class="category-card-amount" style="color: ${catConfig.color}">${formatCurrency(data.total)}</div>
                        <div class="category-card-percent">${percentage}% of total</div>
                        <div class="category-card-avg">${formatCurrency(data.total / Object.keys(data.monthly).length)}/mo avg</div>
                    </div>
                </div>
                <style>.category-card[data-category="${cat}"] .category-card-header::before { background: ${catConfig.color}; }</style>
                <div class="category-card-body">
                    <div class="category-months">
                        ${allMonths.map(monthKey => {
                            const [year, month] = monthKey.split('-');
                            const monthName = monthNames[parseInt(month) - 1];
                            const isCurrent = monthKey === currentMonthKey;
                            return `
                                <div class="cat-month ${isCurrent ? 'current' : ''}">
                                    <span class="cat-month-name">${monthName}</span>
                                    <span class="cat-month-amount">${formatCurrency(data.monthly[monthKey])}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                ${topMerchants.length > 0 ? `
                    <div class="category-card-footer">
                        <div class="category-top-items">
                            ${topMerchants.map(([name, mData]) => `
                                <div class="category-top-item">
                                    <span class="category-top-item-name" title="${name}">${name}</span>
                                    <span class="category-top-item-amount">${formatCurrency(mData.total)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
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
                                <div class="category-row">
                                    <div class="category-info">
                                        <button class="category-icon-btn" data-category-id="${categoryId}" style="background: ${catConfig.color}20" title="Click to view ${hasSubCategories ? 'breakdown' : 'transactions'}">
                                            ${catConfig.icon}
                                            <span class="expand-indicator">▶</span>
                                        </button>
                                        <span class="category-name">${cat}</span>
                                        ${hasSubCategories ? `<span class="subcategory-count">(${Object.keys(subCats).length} types)</span>` : ''}
                                    </div>
                                    <div class="category-bar-wrapper">
                                        <div class="category-bar" style="width: ${percentage}%; background: ${catConfig.color}"></div>
                                    </div>
                                    <div class="category-stats">
                                        <span class="category-amount">$${amount.toFixed(2)}</span>
                                        <span class="category-percentage">${percentage}%</span>
                                    </div>
                                </div>
                                <div class="category-transactions" id="${categoryId}" data-expanded="false">
                                    ${hasSubCategories ? `
                                        <div class="subcategory-breakdown">
                                            <div class="subcategory-header">
                                                <span class="subcategory-title">Breakdown by Type</span>
                                                <select class="subcategory-select" data-parent-id="${categoryId}">
                                                    <option value="">All ${cat} (${catTransactions.length})</option>
                                                    ${sortedSubCats.map(([subCat, subData]) => {
                                                        const subConfig = categories[subCat] || { icon: '📌' };
                                                        return `<option value="${subCat}">${subConfig.icon} ${subCat} (${subData.transactions.length}) - $${subData.total.toFixed(2)}</option>`;
                                                    }).join('')}
                                                </select>
                                            </div>
                                            <div class="subcategory-bars">
                                                ${sortedSubCats.map(([subCat, subData]) => {
                                                    const subConfig = categories[subCat] || { color: '#64748b', icon: '📌' };
                                                    const subPercentage = ((subData.total / amount) * 100).toFixed(1);
                                                    return `
                                                        <div class="subcategory-bar-row" data-subcategory="${subCat}">
                                                            <span class="subcategory-icon">${subConfig.icon}</span>
                                                            <span class="subcategory-name">${subCat.replace(' Restaurants', '').replace('Restaurants (General)', 'Other')}</span>
                                                            <div class="subcategory-bar-track">
                                                                <div class="subcategory-bar" style="width: ${subPercentage}%; background: ${subConfig.color}"></div>
                                                            </div>
                                                            <span class="subcategory-amount">$${subData.total.toFixed(2)}</span>
                                                        </div>
                                                    `;
                                                }).join('')}
                                            </div>
                                        </div>
                                    ` : ''}
                                    <div class="category-transactions-header">
                                        <span class="transactions-count">${catTransactions.length} transaction${catTransactions.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div class="category-transactions-list" data-all-transactions='${JSON.stringify(catTransactions.sort((a, b) => b.date - a.date).map(t => ({
                                        date: formatDate(t.date),
                                        desc: t.description,
                                        amount: t.amount.toFixed(2),
                                        category: t.category
                                    })))}'>
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
    
    // Add click handlers for category icons
    initCategoryToggle();
    
    // Add change handlers for subcategory selects
    initSubcategoryFilters();
}

function initSubcategoryFilters() {
    document.querySelectorAll('.subcategory-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const parentId = select.dataset.parentId;
            const selectedSubCat = e.target.value;
            const transactionsList = document.querySelector(`#${parentId} .category-transactions-list`);
            const transactionItems = transactionsList.querySelectorAll('.category-transaction-item');
            const countEl = document.querySelector(`#${parentId} .transactions-count`);
            
            let visibleCount = 0;
            transactionItems.forEach(item => {
                if (!selectedSubCat || item.dataset.txCategory === selectedSubCat) {
                    item.style.display = '';
                    visibleCount++;
                } else {
                    item.style.display = 'none';
                }
            });
            
            countEl.textContent = `${visibleCount} transaction${visibleCount !== 1 ? 's' : ''}`;
        });
    });
}

function initCategoryToggle() {
    document.querySelectorAll('.category-icon-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const categoryId = btn.dataset.categoryId;
            const transactionsEl = document.getElementById(categoryId);
            
            if (transactionsEl) {
                const isExpanded = transactionsEl.dataset.expanded === 'true';
                
                // Toggle state
                transactionsEl.dataset.expanded = !isExpanded;
                btn.classList.toggle('expanded', !isExpanded);
                
                // Animate the height
                if (!isExpanded) {
                    transactionsEl.style.maxHeight = transactionsEl.scrollHeight + 'px';
                } else {
                    transactionsEl.style.maxHeight = '0';
                }
            }
        });
    });
}

// ===== Charts =====
let spendingChart = null;
let categoryChart = null;
let monthlySpendChart = null;

function initCharts() {
    // Chart.js defaults
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#2a3548';
    Chart.defaults.font.family = "'DM Sans', sans-serif";
    
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
    
    // Generate gradient colors based on spending (lower = green, higher = red)
    const colors = data.map(value => {
        const ratio = (value - lowest) / (highest - lowest || 1);
        if (ratio < 0.33) {
            return 'rgba(34, 197, 94, 0.8)'; // Green
        } else if (ratio < 0.66) {
            return 'rgba(234, 179, 8, 0.8)'; // Yellow/amber
        } else {
            return 'rgba(244, 63, 94, 0.8)'; // Red/rose
        }
    });
    
    const borderColors = data.map(value => {
        const ratio = (value - lowest) / (highest - lowest || 1);
        if (ratio < 0.33) {
            return 'rgb(34, 197, 94)';
        } else if (ratio < 0.66) {
            return 'rgb(234, 179, 8)';
        } else {
            return 'rgb(244, 63, 94)';
        }
    });
    
    if (monthlySpendChart) {
        monthlySpendChart.destroy();
    }
    
    monthlySpendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Monthly Spending',
                data: data,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                barThickness: data.length > 8 ? 40 : 60
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
                    padding: 16,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        title: (items) => items[0].label,
                        label: (ctx) => {
                            const value = ctx.raw;
                            const diff = value - avg;
                            const diffPercent = ((diff / avg) * 100).toFixed(0);
                            const sign = diff >= 0 ? '+' : '';
                            return [
                                `Total: ${formatCurrency(value)}`,
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
                        color: '#94a3b8',
                        font: { size: 11, weight: '500' }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(42, 53, 72, 0.5)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
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
