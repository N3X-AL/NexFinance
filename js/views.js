const Views = {
    dashboard: () => {
        const netWorth = DataManager.getNetWorth();
        const income = DataManager.getMonthlyIncome();
        const expenses = DataManager.getMonthlyExpenses();
        const recentTransactions = DataManager.getTransactions(5);

        return `
            <div class="dashboard-grid">
                <!-- Stats Row -->
                <div class="col-span-4" style="animation-delay: 0.1s;">
                    ${Components.statCard('Net Worth', DataManager.formatCurrency(netWorth), '+5.2%', 'account_balance_wallet', 'primary')}
                </div>
                <div class="col-span-4" style="animation-delay: 0.2s;">
                    ${Components.statCard('Monthly Income', DataManager.formatCurrency(income), '+2.1%', 'arrow_downward', 'success')}
                </div>
                <div class="col-span-4" style="animation-delay: 0.3s;">
                    ${Components.statCard('Monthly Expenses', DataManager.formatCurrency(expenses), '-1.4%', 'arrow_upward', 'danger')}
                </div>

                <!-- Main Content Row -->
                <div class="col-span-8 animate-slide-up" style="animation-delay: 0.4s;">
                    <div class="card" style="height: 100%;">
                        <div class="card-header">
                            <h3 class="card-title">Recent Transactions</h3>
                            <button class="btn btn-secondary" onclick="app.navigate('transactions')">View All</button>
                        </div>
                        ${recentTransactions.length > 0 ? Components.transactionTable(recentTransactions) : Components.emptyState('receipt_long', 'No transactions yet', 'Your recent transactions will appear here once you add them.')}
                    </div>
                </div>

                <!-- Side Content Row -->
                <div class="col-span-4 grid-cols-1 animate-slide-up" style="animation-delay: 0.5s; align-content: start;">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Your Accounts</h3>
                            <span class="material-icons-round card-action">add_circle</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 16px;">
                            ${appData.accounts.slice(0, 3).map(acc => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--border-light);">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <div style="width: 10px; height: 10px; border-radius: var(--radius-full); background: ${acc.color};"></div>
                                        <div>
                                            <div style="font-weight: 500;">${acc.name}</div>
                                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${acc.type}</div>
                                        </div>
                                    </div>
                                    <div style="font-weight: 600;">${DataManager.formatCurrency(acc.balance)}</div>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn btn-secondary" style="width: 100%; margin-top: 16px;" onclick="app.navigate('accounts')">All Accounts</button>
                    </div>
                </div>
            </div>
        `;
    },

    transactions: () => {
        const transactions = DataManager.getTransactions();
        return `
            <div class="card animate-slide-up">
                <div class="card-header">
                    <h3 class="card-title">All Transactions</h3>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-secondary"><span class="material-icons-round" style="font-size: 18px;">filter_list</span> Filter</button>
                        <button class="btn btn-secondary"><span class="material-icons-round" style="font-size: 18px;">download</span> Export</button>
                    </div>
                </div>
                ${transactions.length > 0 ? Components.transactionTable(transactions) : Components.emptyState('receipt_long', 'No transactions yet', 'Start adding your income and expenses to track your finances.')}
            </div>
        `;
    },

    accounts: () => {
        return `
            <div class="grid-cols-3">
                ${appData.accounts.map(acc => Components.accountCard(acc)).join('')}
                
                <div class="card animate-slide-up" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 160px; cursor: pointer; border: 1px dashed var(--text-muted); background: transparent;" onclick="app.showAddAccountModal()">
                    <div style="width: 48px; height: 48px; border-radius: var(--radius-full); background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: var(--primary);">
                        <span class="material-icons-round">add</span>
                    </div>
                    <div style="font-weight: 500;">Add New Account</div>
                </div>
            </div>
        `;
    },

    budgets: () => {
        return `
            <div class="card animate-slide-up" style="margin-bottom: 24px;">
                <div class="card-header">
                    <h3 class="card-title">Monthly Budget Overview</h3>
                    <button class="btn btn-primary"><span class="material-icons-round" style="font-size: 18px;">add</span> New Budget</button>
                </div>
                <div class="grid-cols-2">
                    ${appData.budgets.map(b => Components.budgetCard(b)).join('')}
                </div>
            </div>
        `;
    },

    loans: () => {
        const loans = DataManager.getLoans();
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;" class="animate-slide-up">
                <div style="display: flex; gap: 16px;">
                    <button class="btn btn-primary" onclick="app.showAddLoanModal('given')">
                        <span class="material-icons-round" style="font-size: 18px;">arrow_upward</span> I lent money
                    </button>
                    <button class="btn btn-secondary" onclick="app.showAddLoanModal('received')">
                        <span class="material-icons-round" style="font-size: 18px;">arrow_downward</span> I borrowed money
                    </button>
                </div>
            </div>
            
            ${loans.length > 0 ? `
                <div class="grid-cols-3">
                    ${loans.map(l => Components.loanCard(l)).join('')}
                </div>
            ` : Components.emptyState('handshake', 'No Active Loans', 'Keep track of money you have lent to or borrowed from friends and family without messing up your main budget.')}
        `;
    },

    investments: () => Components.emptyState('trending_up', 'Investments Module', 'Track your stocks, crypto, and real estate here. Coming soon.'),
    reports: () => Components.emptyState('bar_chart', 'Financial Reports', 'Detailed analytics and charts will appear here. Coming soon.'),
    settings: () => `
        <div class="card animate-slide-up" style="max-width: 600px; margin: 0 auto;">
            <div class="card-header">
                <h3 class="card-title">Data Management</h3>
            </div>
            
            <div style="margin-bottom: 24px;">
                <p style="color: var(--text-secondary); margin-bottom: 16px;">Import your financial data from other applications like Everplan, EveryDollar, or Mint. We support <strong>CSV</strong> files or direct <strong>SQLite3 database files</strong>.</p>
                
                <div style="border: 1px dashed var(--border); padding: 24px; border-radius: var(--radius-md); text-align: center; background: var(--bg-surface-hover);">
                    <input type="file" id="csv-upload" accept=".csv,.sqlite,.sqlite3,.db" style="display: none;" onchange="app.handleFileUpload(event)">
                    <button class="btn btn-primary" onclick="document.getElementById('csv-upload').click()">
                        <span class="material-icons-round">upload_file</span> Select File
                    </button>
                    <p style="font-size: 13px; color: var(--text-muted); margin-top: 12px;" id="upload-status">No file chosen</p>
                </div>
            </div>
            
            <hr style="border: none; border-top: 1px solid var(--border); margin: 24px 0;">
            
            <div>
                <h4 style="margin-bottom: 12px;">App Preferences</h4>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
                    <div>
                        <div style="font-weight: 500;">Dark Mode</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">Toggle application theme</div>
                    </div>
                    <button class="btn btn-secondary"><span class="material-icons-round">dark_mode</span></button>
                </div>
            </div>
        </div>
    `
};
