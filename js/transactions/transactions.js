Views.transactions = () => {
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
};
