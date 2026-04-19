const appData = {
    accounts: [
        { id: 1, name: 'Main Checking', type: 'Checking', balance: 5432.50, color: 'var(--primary)' },
        { id: 2, name: 'High Yield Savings', type: 'Savings', balance: 12500.00, color: 'var(--success)' },
        { id: 3, name: 'Rewards Credit Card', type: 'Credit', balance: -845.20, color: 'var(--danger)' },
        { id: 4, name: 'Investment Portfolio', type: 'Investment', balance: 45200.75, color: 'var(--accent)' }
    ],
    
    transactions: [
        { id: 1, date: '2026-04-18', merchant: 'Whole Foods Market', category: 'Groceries', amount: -142.50, accountId: 3, status: 'Completed' },
        { id: 2, date: '2026-04-17', merchant: 'NexCorp Salary', category: 'Income', amount: 3200.00, accountId: 1, status: 'Completed' },
        { id: 3, date: '2026-04-16', merchant: 'Netflix Subscription', category: 'Entertainment', amount: -15.99, accountId: 3, status: 'Completed' },
        { id: 4, date: '2026-04-15', merchant: 'PG&E Utilities', category: 'Bills', amount: -85.20, accountId: 1, status: 'Completed' },
        { id: 5, date: '2026-04-14', merchant: 'Shell Gas Station', category: 'Transport', amount: -45.00, accountId: 3, status: 'Completed' },
        { id: 6, date: '2026-04-12', merchant: 'Apple Store', category: 'Electronics', amount: -999.00, accountId: 3, status: 'Completed' },
        { id: 7, date: '2026-04-10', merchant: 'Vanguard Index Fund', category: 'Investment', amount: -500.00, accountId: 1, status: 'Completed' },
        { id: 8, date: '2026-04-08', merchant: 'Uber Rides', category: 'Transport', amount: -24.50, accountId: 3, status: 'Completed' },
    ],

    budgets: [
        { id: 1, category: 'Groceries', spent: 450, limit: 600, color: 'var(--success)' },
        { id: 2, category: 'Entertainment', spent: 120, limit: 150, color: 'var(--accent)' },
        { id: 3, category: 'Transport', spent: 180, limit: 200, color: 'var(--warning)' },
        { id: 4, category: 'Shopping', spent: 340, limit: 300, color: 'var(--danger)' }
    ],
    
    loans: [
        { id: 1, person: 'Alex Smith', type: 'given', amount: 500, settledAmount: 100, status: 'active', date: '2026-04-10' },
        { id: 2, person: 'Sarah Jenkins', type: 'received', amount: 200, settledAmount: 200, status: 'settled', date: '2026-03-15' }
    ]
};

const DataManager = {
    getNetWorth: () => {
        const accountBalance = appData.accounts.reduce((sum, acc) => sum + acc.balance, 0);
        const loansGivenBalance = appData.loans.filter(l => l.type === 'given').reduce((sum, l) => sum + (l.amount - l.settledAmount), 0);
        const loansReceivedBalance = appData.loans.filter(l => l.type === 'received').reduce((sum, l) => sum + (l.amount - l.settledAmount), 0);
        return accountBalance + loansGivenBalance - loansReceivedBalance;
    },
    
    getMonthlyIncome: () => {
        return appData.transactions
            .filter(t => t.amount > 0 && t.category !== 'Loan')
            .reduce((sum, t) => sum + t.amount, 0);
    },
    
    getMonthlyExpenses: () => {
        return Math.abs(appData.transactions
            .filter(t => t.amount < 0 && t.category !== 'Investment' && t.category !== 'Loan')
            .reduce((sum, t) => sum + t.amount, 0));
    },

    getTransactions: (limit = null) => {
        const sorted = [...appData.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        return limit ? sorted.slice(0, limit) : sorted;
    },

    getAccountById: (id) => {
        return appData.accounts.find(a => a.id === id);
    },

    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    },

    formatDate: (dateString) => {
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    },

    addTransaction: (transaction) => {
        const newId = appData.transactions.length > 0 ? Math.max(...appData.transactions.map(t => t.id)) + 1 : 1;
        appData.transactions.push({ id: newId, ...transaction });
        
        // Update account balance
        const account = appData.accounts.find(a => a.id === parseInt(transaction.accountId));
        if (account) {
            account.balance += parseFloat(transaction.amount);
        }
    },

    getLoans: () => {
        return appData.loans;
    },
    
    addLoan: (loan, accountId) => {
        const newId = appData.loans.length > 0 ? Math.max(...appData.loans.map(l => l.id)) + 1 : 1;
        appData.loans.push({ id: newId, settledAmount: 0, status: 'active', ...loan });
        
        // Disburse or receive the loan principal
        const amount = loan.type === 'given' ? -Math.abs(loan.amount) : Math.abs(loan.amount);
        const merchant = loan.type === 'given' ? 'Loan Given: ' + loan.person : 'Loan Received: ' + loan.person;
        
        DataManager.addTransaction({
            date: loan.date,
            merchant: merchant,
            category: 'Loan',
            amount: amount,
            accountId: accountId,
            status: 'Completed'
        });
    },
    
    recordLoanRepayment: (loanId, amount, accountId) => {
        const loan = appData.loans.find(l => l.id === loanId);
        if (!loan) return;
        
        loan.settledAmount += amount;
        if (loan.settledAmount >= loan.amount) {
            loan.status = 'settled';
        }
        
        const txAmount = loan.type === 'given' ? Math.abs(amount) : -Math.abs(amount);
        const merchant = loan.type === 'given' ? 'Loan Repayment From: ' + loan.person : 'Loan Repayment To: ' + loan.person;
        
        DataManager.addTransaction({
            date: new Date().toISOString().split('T')[0],
            merchant: merchant,
            category: 'Loan',
            amount: txAmount,
            accountId: accountId,
            status: 'Completed'
        });
    }
};
