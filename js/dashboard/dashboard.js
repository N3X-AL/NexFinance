Views.dashboard = () => {
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
};
