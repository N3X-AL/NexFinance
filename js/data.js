// Load from LocalStorage if available
const defaultData = {
    accounts: [
        { id: 1, name: 'Main Account', type: 'Checking', balance: 0.00, color: 'var(--primary)' }
    ],
    transactions: [],
    budgets: [],
    loans: []
};

const savedData = localStorage.getItem('nexfinance_data');
const appData = savedData ? JSON.parse(savedData) : defaultData;

const DataManager = {
    saveData: () => {
        localStorage.setItem('nexfinance_data', JSON.stringify(appData));
    },

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
        
        DataManager.saveData();
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
        
        DataManager.saveData();
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
        
        DataManager.saveData();
    }
};
