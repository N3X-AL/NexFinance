// Load from LocalStorage if available
const defaultData = {
    accounts: [
        { id: 1, name: 'Main Account', type: 'Checking', balance: 0.00, color: 'var(--primary)' }
    ],
    transactions: [],
    budgets: [],
    loans: [],
    currency: 'USD'
};

const savedData = localStorage.getItem('nexfinance_data');
const appData = savedData ? JSON.parse(savedData) : defaultData;
if (!appData.currency) appData.currency = 'USD';

const CloudSync = {
    getToken: () => localStorage.getItem('nexfinance_gh_token') || '',
    getGistId: () => localStorage.getItem('nexfinance_gh_gist_id') || '',
    setCredentials: (token, gistId) => {
        if (token) localStorage.setItem('nexfinance_gh_token', token);
        else localStorage.removeItem('nexfinance_gh_token');
        
        if (gistId) localStorage.setItem('nexfinance_gh_gist_id', gistId);
        else localStorage.removeItem('nexfinance_gh_gist_id');
    },
    
    isConfigured: () => !!CloudSync.getToken(),

    pushToGist: async (dataObj) => {
        const token = CloudSync.getToken();
        const gistId = CloudSync.getGistId();
        if (!token) return;

        const content = JSON.stringify(dataObj, null, 2);
        
        try {
            if (!gistId) {
                const res = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        description: 'NexFinance Data Sync',
                        public: false,
                        files: {
                            'nexfinance_data.json': { content }
                        }
                    })
                });
                if (!res.ok) throw new Error('Failed to create gist');
                const data = await res.json();
                CloudSync.setCredentials(token, data.id);
                return data.id;
            } else {
                const res = await fetch(`https://api.github.com/gists/${gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        files: {
                            'nexfinance_data.json': { content }
                        }
                    })
                });
                if (!res.ok) throw new Error('Failed to update gist');
                return gistId;
            }
        } catch (err) {
            console.error("CloudSync Push Error:", err);
            throw err;
        }
    },

    pullFromGist: async () => {
        const token = CloudSync.getToken();
        const gistId = CloudSync.getGistId();
        if (!token || !gistId) return null;

        try {
            const res = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            });
            if (!res.ok) throw new Error('Failed to fetch gist');
            const data = await res.json();
            const file = data.files['nexfinance_data.json'];
            if (file && file.content) {
                return JSON.parse(file.content);
            }
            return null;
        } catch (err) {
            console.error("CloudSync Pull Error:", err);
            throw err;
        }
    }
};

let syncTimeout = null;

const DataManager = {
    saveData: () => {
        localStorage.setItem('nexfinance_data', JSON.stringify(appData));
        if (CloudSync.isConfigured()) {
            clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                CloudSync.pushToGist(appData).catch(e => console.error("Auto-sync failed", e));
            }, 2000);
        }
    },
    
    syncFromCloud: async () => {
        if (CloudSync.isConfigured() && CloudSync.getGistId()) {
            const remoteData = await CloudSync.pullFromGist();
            if (remoteData) {
                // Clear and overwrite appData keys
                Object.keys(appData).forEach(k => delete appData[k]);
                Object.assign(appData, remoteData);
                localStorage.setItem('nexfinance_data', JSON.stringify(appData));
                return true;
            }
        }
        return false;
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
            currency: appData.currency || 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    },

    getCurrency: () => {
        return appData.currency || 'USD';
    },

    setCurrency: (currency) => {
        appData.currency = currency;
        DataManager.saveData();
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
    },
    
    editAccount: (id, updatedData) => {
        const accountIndex = appData.accounts.findIndex(a => a.id === id);
        if (accountIndex !== -1) {
            appData.accounts[accountIndex] = { ...appData.accounts[accountIndex], ...updatedData };
            DataManager.saveData();
        }
    },
    
    deleteAccount: (id) => {
        // Remove the account
        appData.accounts = appData.accounts.filter(a => a.id !== id);
        
        // Remove all transactions associated with this account
        appData.transactions = appData.transactions.filter(t => t.accountId !== id);
        
        // Remove any loans associated with this account (if we were tracking them by account id exclusively)
        // Since loans just generate transactions, removing the transactions above handles the ledger side.
        
        DataManager.saveData();
    }
};
