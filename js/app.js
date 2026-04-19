class App {
    constructor() {
        this.currentRoute = 'dashboard';
        this.container = document.getElementById('view-container');
        this.titleEl = document.getElementById('current-page-title');
        this.subtitleEl = document.getElementById('current-page-subtitle');
        this.navLinks = document.querySelectorAll('.nav-links li, .settings-btn');
        this.modalContainer = document.getElementById('modal-container');
        
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupGlobalEvents();
        this.navigate(this.currentRoute);
    }

    setupNavigation() {
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const route = link.getAttribute('data-route');
                if (route) {
                    this.navigate(route);
                }
            });
        });
    }

    setupGlobalEvents() {
        const globalAddBtn = document.getElementById('global-add-btn');
        if (globalAddBtn) {
            globalAddBtn.addEventListener('click', () => this.showAddTransactionModal());
        }

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    navigate(route) {
        if (!Views[route]) return;
        
        this.currentRoute = route;
        
        // Update Navigation UI
        this.navLinks.forEach(link => {
            if (link.getAttribute('data-route') === route) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Update Headers
        this.updateHeader(route);

        // Render View Content
        this.container.innerHTML = Views[route]();
        
        // Scroll to top
        this.container.parentElement.scrollTop = 0;
    }

    updateHeader(route) {
        const titles = {
            dashboard: { title: 'Dashboard', sub: 'Welcome back, here\'s your financial overview.' },
            transactions: { title: 'Transactions', sub: 'View and manage your recent activity.' },
            accounts: { title: 'Accounts', sub: 'Manage your connected bank and investment accounts.' },
            budgets: { title: 'Budgets', sub: 'Track your spending against your targets.' },
            loans: { title: 'Friendly Loans', sub: 'Track money you lend to or borrow from others.' },
            investments: { title: 'Investments', sub: 'Monitor your portfolio performance.' },
            reports: { title: 'Reports', sub: 'Analyze your financial trends.' },
            settings: { title: 'Settings', sub: 'Configure your application preferences.' }
        };
        
        if (titles[route]) {
            this.titleEl.textContent = titles[route].title;
            this.subtitleEl.textContent = titles[route].sub;
        }
    }

    showModal(title, contentHTML, onSave) {
        const modalHTML = `
            <div class="modal-overlay active" id="current-modal" onclick="app.handleModalOverlayClick(event)">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close" onclick="app.closeModal()"><span class="material-icons-round">close</span></button>
                    </div>
                    <div class="modal-body">
                        ${contentHTML}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" id="modal-save-btn">Save Changes</button>
                    </div>
                </div>
            </div>
        `;
        
        this.modalContainer.innerHTML = modalHTML;
        
        document.getElementById('modal-save-btn').addEventListener('click', () => {
            if (onSave()) {
                this.closeModal();
            }
        });
    }

    handleModalOverlayClick(e) {
        if (e.target.id === 'current-modal') {
            this.closeModal();
        }
    }

    closeModal() {
        const overlay = document.getElementById('current-modal');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                this.modalContainer.innerHTML = '';
            }, 300);
        }
    }

    showAddTransactionModal() {
        const accountOptions = appData.accounts.map(a => `<option value="${a.id}">${a.name} (${DataManager.formatCurrency(a.balance)})</option>`).join('');
        
        const content = `
            <form id="add-transaction-form">
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select id="t-type" class="form-control">
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Merchant / Description</label>
                    <input type="text" id="t-merchant" class="form-control" placeholder="e.g. Amazon" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Amount</label>
                    <input type="number" id="t-amount" class="form-control" placeholder="0.00" step="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <input type="text" id="t-category" class="form-control" placeholder="e.g. Shopping" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Account</label>
                    <select id="t-account" class="form-control">
                        ${accountOptions}
                    </select>
                </div>
            </form>
        `;
        
        this.showModal('Add Transaction', content, () => {
            const form = document.getElementById('add-transaction-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return false;
            }
            
            const type = document.getElementById('t-type').value;
            let amount = parseFloat(document.getElementById('t-amount').value);
            if (type === 'expense') amount = -Math.abs(amount);
            
            const newTx = {
                date: new Date().toISOString().split('T')[0],
                merchant: document.getElementById('t-merchant').value,
                category: document.getElementById('t-category').value,
                amount: amount,
                accountId: parseInt(document.getElementById('t-account').value),
                status: 'Completed'
            };
            
            DataManager.addTransaction(newTx);
            
            // Re-render current view to show changes
            this.navigate(this.currentRoute);
            return true;
        });
    }

    showAddAccountModal() {
        const content = `
            <form id="add-account-form">
                <div class="form-group">
                    <label class="form-label">Account Name</label>
                    <input type="text" id="a-name" class="form-control" placeholder="e.g. Chase Sapphire" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Account Type</label>
                    <select id="a-type" class="form-control">
                        <option value="Checking">Checking</option>
                        <option value="Savings">Savings</option>
                        <option value="Credit">Credit Card</option>
                        <option value="Investment">Investment</option>
                        <option value="Loan">Loan</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Initial Balance</label>
                    <input type="number" id="a-balance" class="form-control" placeholder="0.00" step="0.01" required>
                </div>
            </form>
        `;

        this.showModal('Add New Account', content, () => {
            const form = document.getElementById('add-account-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return false;
            }
            
            const name = document.getElementById('a-name').value;
            const type = document.getElementById('a-type').value;
            const balance = parseFloat(document.getElementById('a-balance').value);
            
            // Auto assign a color based on type
            const colorMap = {
                'Checking': 'var(--primary)',
                'Savings': 'var(--success)',
                'Credit': 'var(--danger)',
                'Investment': 'var(--accent)',
                'Loan': 'var(--warning)'
            };
            
            const newId = appData.accounts.length > 0 ? Math.max(...appData.accounts.map(a => a.id)) + 1 : 1;
            
            appData.accounts.push({
                id: newId,
                name,
                type,
                balance,
                color: colorMap[type] || 'var(--primary)'
            });
            
            DataManager.saveData();
            
            this.navigate(this.currentRoute);
            return true;
        });
    }

    showEditAccountModal(id) {
        const account = appData.accounts.find(a => a.id === id);
        if (!account) return;

        const content = `
            <form id="edit-account-form">
                <div class="form-group">
                    <label class="form-label">Account Name</label>
                    <input type="text" id="ea-name" class="form-control" value="${account.name}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Account Type</label>
                    <select id="ea-type" class="form-control">
                        <option value="Checking" ${account.type === 'Checking' ? 'selected' : ''}>Checking</option>
                        <option value="Savings" ${account.type === 'Savings' ? 'selected' : ''}>Savings</option>
                        <option value="Credit" ${account.type === 'Credit' ? 'selected' : ''}>Credit Card</option>
                        <option value="Investment" ${account.type === 'Investment' ? 'selected' : ''}>Investment</option>
                        <option value="Loan" ${account.type === 'Loan' ? 'selected' : ''}>Loan</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Current Balance</label>
                    <input type="number" id="ea-balance" class="form-control" value="${account.balance}" step="0.01" required>
                </div>
                <div style="margin-top: 24px; text-align: center;">
                    <button type="button" class="btn btn-danger" onclick="app.deleteAccount(${id})" style="width: 100%;">
                        <span class="material-icons-round" style="font-size: 18px;">delete</span> Delete Account
                    </button>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">Deleting this account will also permanently delete all associated transactions.</p>
                </div>
            </form>
        `;

        this.showModal('Edit Account', content, () => {
            const form = document.getElementById('edit-account-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return false;
            }
            
            const name = document.getElementById('ea-name').value;
            const type = document.getElementById('ea-type').value;
            const balance = parseFloat(document.getElementById('ea-balance').value);
            
            const colorMap = {
                'Checking': 'var(--primary)',
                'Savings': 'var(--success)',
                'Credit': 'var(--danger)',
                'Investment': 'var(--accent)',
                'Loan': 'var(--warning)'
            };
            
            DataManager.editAccount(id, {
                name,
                type,
                balance,
                color: colorMap[type] || 'var(--primary)'
            });
            
            this.navigate(this.currentRoute);
            return true;
        });
    }

    deleteAccount(id) {
        if (confirm("Are you sure you want to delete this account? All associated transactions will be permanently lost. This action cannot be undone.")) {
            DataManager.deleteAccount(id);
            this.closeModal();
            this.navigate(this.currentRoute);
        }
    }

    showAddLoanModal(type) {
        const title = type === 'given' ? 'I Lent Money' : 'I Borrowed Money';
        const personLabel = type === 'given' ? 'Who did you lend to?' : 'Who did you borrow from?';
        const accountOptions = appData.accounts.map(a => `<option value="${a.id}">${a.name} (${DataManager.formatCurrency(a.balance)})</option>`).join('');

        const content = `
            <form id="add-loan-form">
                <div class="form-group">
                    <label class="form-label">${personLabel}</label>
                    <input type="text" id="l-person" class="form-control" placeholder="e.g. John Doe" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Amount</label>
                    <input type="number" id="l-amount" class="form-control" placeholder="0.00" step="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" id="l-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Account (for the transfer)</label>
                    <select id="l-account" class="form-control">
                        ${accountOptions}
                    </select>
                </div>
            </form>
        `;

        this.showModal(title, content, () => {
            const form = document.getElementById('add-loan-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return false;
            }

            const loan = {
                person: document.getElementById('l-person').value,
                amount: parseFloat(document.getElementById('l-amount').value),
                date: document.getElementById('l-date').value,
                type: type
            };
            const accountId = parseInt(document.getElementById('l-account').value);

            DataManager.addLoan(loan, accountId);
            this.navigate(this.currentRoute);
            return true;
        });
    }

    showRecordRepaymentModal(loanId) {
        const loan = appData.loans.find(l => l.id === loanId);
        if (!loan) return;

        const remaining = loan.amount - loan.settledAmount;
        const accountOptions = appData.accounts.map(a => `<option value="${a.id}">${a.name} (${DataManager.formatCurrency(a.balance)})</option>`).join('');

        const content = `
            <form id="record-repayment-form">
                <div class="form-group">
                    <label class="form-label">Amount to Record</label>
                    <input type="number" id="r-amount" class="form-control" value="${remaining}" max="${remaining}" step="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Account (to receive/send funds)</label>
                    <select id="r-account" class="form-control">
                        ${accountOptions}
                    </select>
                </div>
            </form>
        `;

        this.showModal('Record Repayment', content, () => {
            const form = document.getElementById('record-repayment-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return false;
            }

            const amount = parseFloat(document.getElementById('r-amount').value);
            const accountId = parseInt(document.getElementById('r-account').value);

            DataManager.recordLoanRepayment(loanId, amount, accountId);
            this.navigate(this.currentRoute);
            return true;
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('upload-status');
        if (statusEl) statusEl.textContent = `Processing ${file.name}...`;

        if (file.name.toLowerCase().endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = (e) => this.parseCSV(e.target.result);
            reader.readAsText(file);
        } else {
            // Assume SQLite db file
            const reader = new FileReader();
            reader.onload = async (e) => {
                const Uints = new Uint8Array(e.target.result);
                try {
                    await this.parseSQLite(Uints);
                } catch(err) {
                    console.error(err);
                    if (statusEl) statusEl.textContent = 'Failed to parse database file.';
                    alert('Failed to read database. Make sure it is a valid SQLite file.');
                }
            };
            reader.readAsArrayBuffer(file);
        }
    }

    async parseSQLite(uInt8Array) {
        if (!window.initSqlJs) {
            alert("SQL.js is still loading, please try again in a few seconds.");
            return;
        }
        
        const SQL = await window.initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
        const db = new SQL.Database(uInt8Array);
        
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_%';");
        if (!tablesResult.length) {
            alert('No tables found in the database.');
            return;
        }
        
        const tables = tablesResult[0].values.map(v => v[0]);
        
        // Find most likely transaction table
        const keywords = ['transaction', 'record', 'expense', 'entry', 'ledger'];
        let targetTable = tables[0];
        for (let t of tables) {
            const tl = t.toLowerCase();
            if (keywords.some(k => tl.includes(k))) {
                targetTable = t;
                break;
            }
        }

        const res = db.exec(`SELECT * FROM "${targetTable}"`);
        if (!res.length) {
            alert(`No data found in table ${targetTable}`);
            return;
        }

        const columns = res[0].columns.map(c => c.toLowerCase());
        const values = res[0].values;
        let importedCount = 0;
        
        const dateIdx = columns.findIndex(c => c.includes('date') || c === 'time' || c.includes('created'));
        const amountIdx = columns.findIndex(c => c.includes('amount') || c.includes('value') || c.includes('price') || c.includes('cost'));
        const merchantIdx = columns.findIndex(c => c.includes('merchant') || c.includes('payee') || c.includes('desc') || c.includes('name') || c.includes('note') || c.includes('title'));
        const categoryIdx = columns.findIndex(c => c.includes('category') || c.includes('type') || c.includes('group'));
        const isExpenseIdx = columns.findIndex(c => c.includes('is_expense') || c.includes('type') || c.includes('income'));

        const defaultAccountId = appData.accounts[0].id;

        values.forEach(row => {
            if (amountIdx === -1) return;
            
            let amount = parseFloat(row[amountIdx]);
            if (isNaN(amount)) return;
            
            if (isExpenseIdx !== -1) {
                const typeVal = String(row[isExpenseIdx]).toLowerCase();
                if (typeVal === '1' || typeVal === 'true' || typeVal.includes('expense') || typeVal.includes('out')) {
                    amount = -Math.abs(amount);
                } else if (typeVal === '0' || typeVal === 'false' || typeVal.includes('income') || typeVal.includes('in')) {
                    amount = Math.abs(amount);
                }
            }

            let dateStr = dateIdx !== -1 && row[dateIdx] ? String(row[dateIdx]) : new Date().toISOString().split('T')[0];
            if (!isNaN(dateStr) && dateStr.length >= 10) {
                let ms = parseInt(dateStr);
                if (dateStr.length <= 11) ms *= 1000;
                dateStr = new Date(ms).toISOString().split('T')[0];
            } else {
                let parsed = new Date(dateStr);
                if (!isNaN(parsed)) dateStr = parsed.toISOString().split('T')[0];
            }
            
            const merchantStr = merchantIdx !== -1 && row[merchantIdx] ? String(row[merchantIdx]) : 'Imported DB Record';
            const categoryStr = categoryIdx !== -1 && row[categoryIdx] ? String(row[categoryIdx]) : 'Uncategorized';

            DataManager.addTransaction({
                date: dateStr,
                merchant: merchantStr,
                category: categoryStr,
                amount: amount,
                accountId: defaultAccountId,
                status: 'Completed'
            });
            importedCount++;
        });

        const statusEl = document.getElementById('upload-status');
        if (statusEl) statusEl.textContent = `Successfully imported ${importedCount} transactions from SQLite!`;
        
        if (this.currentRoute === 'transactions' || this.currentRoute === 'dashboard') {
            this.navigate(this.currentRoute);
        }
        alert(`Successfully imported ${importedCount} transactions from SQLite!`);
    }

    parseCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
            alert('File seems empty or invalid.');
            return;
        }

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        let importedCount = 0;

        const dateIdx = headers.findIndex(h => h.includes('date') || h === 'time');
        const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('value') || h.includes('price'));
        const merchantIdx = headers.findIndex(h => h.includes('merchant') || h.includes('payee') || h.includes('description') || h.includes('name') || h.includes('title'));
        const categoryIdx = headers.findIndex(h => h.includes('category') || h.includes('type') || h.includes('group'));

        if (dateIdx === -1 || amountIdx === -1) {
            alert('Could not map CSV columns. Please ensure your CSV has "Date" and "Amount" columns.');
            const statusEl = document.getElementById('upload-status');
            if (statusEl) statusEl.textContent = 'Import failed: Invalid format';
            return;
        }

        const defaultAccountId = appData.accounts[0].id;

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            // Simple CSV row parser handling quotes
            let row = [];
            let inQuotes = false;
            let currentVal = '';
            for (let char of lines[i]) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { row.push(currentVal.trim()); currentVal = ''; }
                else currentVal += char;
            }
            row.push(currentVal.trim());

            if (row.length <= Math.max(dateIdx, amountIdx)) continue;

            const dateStr = row[dateIdx];
            const amountStr = row[amountIdx].replace(/[^0-9.-]/g, ''); // strip currency symbols
            const merchantStr = merchantIdx !== -1 ? row[merchantIdx] : 'Imported Transaction';
            const categoryStr = categoryIdx !== -1 && row[categoryIdx] ? row[categoryIdx] : 'Uncategorized';

            const amount = parseFloat(amountStr);
            if (isNaN(amount)) continue;

            let parsedDate = new Date(dateStr);
            if (isNaN(parsedDate)) parsedDate = new Date();

            DataManager.addTransaction({
                date: parsedDate.toISOString().split('T')[0],
                merchant: merchantStr,
                category: categoryStr,
                amount: amount,
                accountId: defaultAccountId,
                status: 'Completed'
            });
            importedCount++;
        }

        const statusEl = document.getElementById('upload-status');
        if (statusEl) statusEl.textContent = `Successfully imported ${importedCount} transactions.`;
        
        // Refresh UI if on transactions page
        if (this.currentRoute === 'transactions' || this.currentRoute === 'dashboard') {
            this.navigate(this.currentRoute);
        }
        
        alert(`Successfully imported ${importedCount} transactions from Everplan/CSV!`);
    }

    resetData() {
        if (confirm("Are you sure you want to completely delete all your data? This cannot be undone.")) {
            localStorage.removeItem('nexfinance_data');
            window.location.reload();
        }
    }
}

// Initialize Application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});
