Views.loans = () => {
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
};
