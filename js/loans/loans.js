Views.loans = () => {
    const loans = DataManager.getLoans();
    let moneyToTake = 0;
    let moneyToReturn = 0;
    
    loans.forEach(l => {
        if (l.status !== 'settled') {
            if (l.type === 'given') moneyToTake += (l.amount - l.settledAmount);
            else if (l.type === 'received') moneyToReturn += (l.amount - l.settledAmount);
        }
    });

    return `
        <div class="dashboard-grid" style="margin-bottom: 24px;">
            <div class="col-span-6 animate-slide-up" style="animation-delay: 0.1s;">
                <div class="card stat-card" style="height: 100%;">
                    <div class="card-header" style="margin-bottom: 0;">
                        <h3 class="card-title text-secondary">Money to Take</h3>
                        <div class="stat-icon bg-success-light text-success">
                            <span class="material-icons-round">arrow_downward</span>
                        </div>
                    </div>
                    <div class="stat-value" style="margin: 16px 0;">${DataManager.formatCurrency(moneyToTake)}</div>
                    <div class="stat-change text-success" style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                        <span class="material-icons-round" style="font-size: 16px;">account_balance_wallet</span>
                        <span>Pending collections from others</span>
                    </div>
                </div>
            </div>
            <div class="col-span-6 animate-slide-up" style="animation-delay: 0.15s;">
                <div class="card stat-card" style="height: 100%;">
                    <div class="card-header" style="margin-bottom: 0;">
                        <h3 class="card-title text-secondary">Money to Return</h3>
                        <div class="stat-icon bg-danger-light text-danger">
                            <span class="material-icons-round">arrow_upward</span>
                        </div>
                    </div>
                    <div class="stat-value" style="margin: 16px 0;">${DataManager.formatCurrency(moneyToReturn)}</div>
                    <div class="stat-change text-danger" style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                        <span class="material-icons-round" style="font-size: 16px;">payments</span>
                        <span>Pending payments to others</span>
                    </div>
                </div>
            </div>
        </div>

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
};
