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
        const isTransfer = !!t.toAccountId;

        if (isTransfer) {
            const fromAccount = DataManager.getAccountById(t.accountId);
            const toAccount = DataManager.getAccountById(t.toAccountId);
            return `
                <tr>
                    <td data-label="Transaction">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; border-radius: var(--radius-full); background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: var(--primary)">swap_horiz</span>
                            </div>
                            <div>
                                <div style="font-weight: 500; text-align: left;">${t.merchant}</div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px; text-align: left;">${DataManager.formatDate(t.date)}</div>
                            </div>
                        </div>
                    </td>
                    <td data-label="Category"><span class="tag bg-primary-light">${t.category}</span></td>
                    <td data-label="Account">${fromAccount ? fromAccount.name : 'Unknown'} → ${toAccount ? toAccount.name : 'Unknown'}</td>
                    <td data-label="Amount" style="text-align: right; font-weight: 600;">
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 16px;">
                            <span>${DataManager.formatCurrency(Math.abs(t.amount))}</span>
                            <div style="display: flex; gap: 4px;">
                                <button class="icon-btn tooltip" style="width: 32px; height: 32px; border: none; background: transparent; color: var(--danger);" data-tooltip="Delete" onclick="app.deleteTransaction(${t.id})">
                                    <span class="material-icons-round" style="font-size: 18px;">delete</span>
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }

        const account = DataManager.getAccountById(t.accountId);
        const amountClass = t.amount > 0 ? 'text-success' : '';
        const amountPrefix = t.amount > 0 ? '+' : '';
        
        return `
            <tr>
                <td data-label="Transaction">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: var(--radius-full); background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round" style="color: ${account ? account.color : 'var(--text-secondary)'}">${t.amount > 0 ? 'arrow_downward' : 'arrow_upward'}</span>
                        </div>
                        <div>
                            <div style="font-weight: 500; text-align: left;">${t.merchant}</div>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px; text-align: left;">${DataManager.formatDate(t.date)}</div>
                        </div>
                    </div>
                </td>
                <td data-label="Category"><span class="tag bg-primary-light">${t.category}</span></td>
                <td data-label="Account">${account ? account.name : 'Unknown'}</td>
                <td data-label="Amount" style="text-align: right; font-weight: 600;" class="${amountClass}">
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 16px;">
                        <span>${amountPrefix}${DataManager.formatCurrency(Math.abs(t.amount))}</span>
                        <div style="display: flex; gap: 4px;">
                            <button class="icon-btn tooltip" style="width: 32px; height: 32px; border: none; background: transparent; color: var(--text-secondary);" data-tooltip="Edit" onclick="app.showEditTransactionModal(${t.id})">
                                <span class="material-icons-round" style="font-size: 18px;">edit</span>
                            </button>
                            <button class="icon-btn tooltip" style="width: 32px; height: 32px; border: none; background: transparent; color: var(--danger);" data-tooltip="Delete" onclick="app.deleteTransaction(${t.id})">
                                <span class="material-icons-round" style="font-size: 18px;">delete</span>
                            </button>
                        </div>
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

    personLoanCard: (personData) => {
        const { name, activeLoans, settledLoans, netBalance } = personData;
        const safeId = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + Math.floor(Math.random()*1000);
        
        let headerText = 'All Settled';
        let headerColor = 'var(--success)';
        let headerIcon = 'check_circle';
        let netAbs = Math.abs(netBalance);
        
        if (netBalance > 0) {
            headerText = 'Total Loaned';
            headerColor = 'var(--warning)';
            headerIcon = 'arrow_upward';
        } else if (netBalance < 0) {
            headerText = 'Total Borrowed';
            headerColor = 'var(--accent)';
            headerIcon = 'arrow_downward';
        }

        const renderSubLoan = (loan, isSettled) => {
            const percentage = Math.min((loan.settledAmount / loan.amount) * 100, 100);
            const colorC = loan.type === 'given' ? 'var(--warning)' : 'var(--accent)';
            return `
                <div style="margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div>
                            <div style="font-size: 12px; font-weight: 500; color: ${colorC};">${loan.type === 'given' ? 'Lent / Paid for them' : 'Borrowed / Paid for you'}</div>
                            ${loan.description ? `<div style="font-size: 12px; color: var(--text-primary); margin-top: 4px;">${loan.description}</div>` : ''}
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">${DataManager.formatDate(loan.date)}</div>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-weight: 600; font-size: 14px;">${DataManager.formatCurrency(isSettled ? loan.amount : loan.amount - loan.settledAmount)}</span>
                            ${!isSettled ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Remaining of ${DataManager.formatCurrency(loan.amount)}</div>` : ''}
                        </div>
                    </div>
                    ${!isSettled ? `
                    <div class="progress-container" style="margin-bottom: 12px; height: 4px; background: rgba(0,0,0,0.2);">
                        <div class="progress-bar" style="width: ${percentage}%; background: ${colorC};"></div>
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; gap: 4px;" onclick="app.showRecordRepaymentModal(${loan.id})">
                            <span class="material-icons-round" style="font-size: 14px;">payments</span> Record
                        </button>
                        <button class="btn btn-secondary" style="padding: 6px; display: flex; align-items: center; justify-content: center;" onclick="app.showEditLoanModal(${loan.id})" title="Edit Loan">
                            <span class="material-icons-round" style="font-size: 14px;">edit</span>
                        </button>
                        <button class="btn btn-danger" style="padding: 6px; display: flex; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: none;" onclick="app.deleteLoan(${loan.id})" title="Delete Loan & History">
                            <span class="material-icons-round" style="font-size: 14px;">delete</span>
                        </button>
                    </div>` : `
                    <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                        <span class="tag bg-success-light" style="font-size: 11px; padding: 2px 6px;">Settled</span>
                        <button class="btn btn-danger" style="padding: 4px 6px; display: flex; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: none;" onclick="app.deleteLoan(${loan.id})" title="Delete Entry">
                            <span class="material-icons-round" style="font-size: 14px;">delete</span>
                        </button>
                    </div>
                    `}
                </div>
            `;
        };

        return `
            <div class="card animate-slide-up" style="position: relative;">
                ${netBalance === 0 && activeLoans.length === 0 ? '<div style="position: absolute; top: 12px; right: 12px;"><span class="tag bg-success-light">All Settled</span></div>' : ''}
                
                <div class="card-header" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: var(--radius-full); background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center; color: ${headerColor};">
                            <span class="material-icons-round">${headerIcon}</span>
                        </div>
                        <div>
                            <h3 class="card-title" style="margin-top: 2px; font-size: 20px; font-weight: 600;">${name}</h3>
                        </div>
                    </div>
                    ${netAbs > 0 ? `
                    <div style="text-align: right;">
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 2px;">${headerText}</div>
                        <div style="font-size: 16px; color: ${headerColor}; font-weight: 600;">${DataManager.formatCurrency(netAbs)}</div>
                    </div>` : '<div style="text-align: right;"><div style="font-size: 14px; color: var(--text-secondary); font-weight: 500;">No active balance</div></div>'}
                </div>
                
                <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                     <button class="btn btn-secondary" style="flex: 1; padding: 8px 4px; font-size: 13px;" onclick="app.showAddLoanModal('given', '${name.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">
                        <span class="material-icons-round" style="font-size: 16px; margin-right: 4px; vertical-align: bottom;">arrow_upward</span>Lend
                     </button>
                     <button class="btn btn-secondary" style="flex: 1; padding: 8px 4px; font-size: 13px;" onclick="app.showAddLoanModal('received', '${name.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">
                         <span class="material-icons-round" style="font-size: 16px; margin-right: 4px; vertical-align: bottom;">arrow_downward</span>Borrow
                     </button>
                </div>

                ${activeLoans.length > 0 ? `
                <div>
                    ${activeLoans.map(l => renderSubLoan(l, false)).join('')}
                </div>
                ` : ''}
                
                ${settledLoans.length > 0 ? `
                <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <button class="btn btn-secondary" style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; font-size: 13px; background: transparent; border: 1px solid var(--border-color);" onclick="document.getElementById('settled-${safeId}').style.display = document.getElementById('settled-${safeId}').style.display === 'none' ? 'block' : 'none'">
                        <span>View Settled History (${settledLoans.length})</span>
                        <span class="material-icons-round" style="font-size: 16px;">history</span>
                    </button>
                    <div id="settled-${safeId}" style="display: none;">
                        ${settledLoans.map(l => renderSubLoan(l, true)).join('')}
                        <div style="margin-top: 16px; text-align: center;">
                            <button class="btn btn-danger" style="width: 100%; padding: 8px 12px; font-size: 13px; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: none;" onclick="app.deletePersonHistory('${name.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">
                                <span class="material-icons-round" style="font-size: 16px; margin-right: 4px; vertical-align: bottom;">delete_forever</span> Delete All History for ${name}
                            </button>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }
};
