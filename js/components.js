const Components = {
    statCard: (title, value, changeStr, icon, colorClass) => `
        <div class="card stat-card animate-slide-up">
            <div class="card-header" style="margin-bottom: 0;">
                <h3 class="card-title text-secondary">${title}</h3>
                <div class="stat-icon bg-${colorClass}-light text-${colorClass}">
                    <span class="material-icons-round">${icon}</span>
                </div>
            </div>
            <div class="stat-value">${value}</div>
            <div class="stat-change text-${changeStr.startsWith('+') ? 'success' : 'danger'}">
                <span class="material-icons-round">${changeStr.startsWith('+') ? 'trending_up' : 'trending_down'}</span>
                ${changeStr} vs last month
            </div>
        </div>
    `,

    transactionRow: (t) => {
        const account = DataManager.getAccountById(t.accountId);
        const amountClass = t.amount > 0 ? 'text-success' : '';
        const amountPrefix = t.amount > 0 ? '+' : '';
        
        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: var(--radius-full); background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round" style="color: ${account ? account.color : 'var(--text-secondary)'}">${t.amount > 0 ? 'arrow_downward' : 'arrow_upward'}</span>
                        </div>
                        <div>
                            <div style="font-weight: 500;">${t.merchant}</div>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${DataManager.formatDate(t.date)}</div>
                        </div>
                    </div>
                </td>
                <td><span class="tag bg-primary-light">${t.category}</span></td>
                <td>${account ? account.name : 'Unknown'}</td>
                <td style="text-align: right; font-weight: 600;" class="${amountClass}">
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 16px;">
                        <span>${amountPrefix}${DataManager.formatCurrency(Math.abs(t.amount))}</span>
                        <button class="icon-btn tooltip" style="width: 32px; height: 32px; border: none; background: transparent; color: var(--danger);" data-tooltip="Delete" onclick="app.deleteTransaction(${t.id})">
                            <span class="material-icons-round" style="font-size: 18px;">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    },

    transactionTable: (transactions) => `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Transaction</th>
                        <th>Category</th>
                        <th>Account</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(Components.transactionRow).join('')}
                </tbody>
            </table>
        </div>
    `,

    accountCard: (account) => `
        <div class="card animate-slide-up">
            <div class="card-header">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 12px; height: 12px; border-radius: var(--radius-full); background: ${account.color}; box-shadow: 0 0 10px ${account.color};"></div>
                    <h3 class="card-title">${account.name}</h3>
                </div>
                <span class="material-icons-round card-action" onclick="app.showEditAccountModal(${account.id})">edit</span>
            </div>
            <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">${account.type} Account</div>
            <div style="font-size: 28px; font-weight: 700;">${DataManager.formatCurrency(account.balance)}</div>
        </div>
    `,

    budgetCard: (budget) => {
        const percentage = Math.min((budget.spent / budget.limit) * 100, 100);
        const isOver = budget.spent > budget.limit;
        const colorClass = isOver ? 'var(--danger)' : budget.color;
        
        return `
            <div class="card animate-slide-up">
                <div class="card-header" style="margin-bottom: 12px;">
                    <h3 class="card-title">${budget.category}</h3>
                    <div style="font-weight: 600; font-size: 14px;">
                        ${DataManager.formatCurrency(budget.spent)} <span style="color: var(--text-secondary); font-weight: 400;">/ ${DataManager.formatCurrency(budget.limit)}</span>
                    </div>
                </div>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${percentage}%; background: ${colorClass}; box-shadow: 0 0 10px ${colorClass}40;"></div>
                </div>
                <div style="margin-top: 12px; font-size: 13px; color: ${isOver ? 'var(--danger)' : 'var(--text-secondary)'}; text-align: right;">
                    ${isOver ? 'Over budget by ' + DataManager.formatCurrency(budget.spent - budget.limit) : DataManager.formatCurrency(budget.limit - budget.spent) + ' left'}
                </div>
            </div>
        `;
    },
    
    emptyState: (icon, title, desc) => `
        <div style="text-align: center; padding: 60px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
            <div style="width: 80px; height: 80px; border-radius: var(--radius-full); background: var(--bg-surface); display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <span class="material-icons-round" style="font-size: 40px; color: var(--primary);">${icon}</span>
            </div>
            <h3 style="font-size: 20px; margin-bottom: 8px;">${title}</h3>
            <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">${desc}</p>
        </div>
    `,

    loanCard: (loan) => {
        const percentage = Math.min((loan.settledAmount / loan.amount) * 100, 100);
        const colorClass = loan.type === 'given' ? 'var(--warning)' : 'var(--accent)';
        const typeText = loan.type === 'given' ? 'You lent to' : 'You borrowed from';
        
        return `
            <div class="card animate-slide-up" style="position: relative;">
                ${loan.status === 'settled' ? '<div style="position: absolute; top: 12px; right: 12px;"><span class="tag bg-success-light">Settled</span></div>' : ''}
                <div class="card-header" style="margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: var(--radius-full); background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center; color: ${colorClass};">
                            <span class="material-icons-round">${loan.type === 'given' ? 'arrow_upward' : 'arrow_downward'}</span>
                        </div>
                        <div>
                            <div style="font-size: 13px; color: var(--text-secondary);">${typeText}</div>
                            <h3 class="card-title" style="margin-top: 2px;">${loan.person}</h3>
                        </div>
                    </div>
                </div>
                
                <div style="margin: 20px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 14px; color: var(--text-secondary);">Settled</span>
                        <span style="font-weight: 600;">${DataManager.formatCurrency(loan.settledAmount)} / ${DataManager.formatCurrency(loan.amount)}</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${percentage}%; background: ${colorClass};"></div>
                    </div>
                </div>
                
                ${loan.status !== 'settled' ? `
                    <button class="btn btn-secondary" style="width: 100%; margin-top: 8px;" onclick="app.showRecordRepaymentModal(${loan.id})">
                        <span class="material-icons-round" style="font-size: 18px;">payments</span> Record Repayment
                    </button>
                ` : ''}
            </div>
        `;
    }
};
