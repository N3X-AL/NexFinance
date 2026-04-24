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

    getMoneyInHand: () => {
        return appData.accounts.reduce((sum, acc) => sum + acc.balance, 0);
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

    getTrendStats: () => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

        let currentIncome = 0, currentExpense = 0, currentNet = 0, currentMoney = 0;
        let pastIncome = 0, pastExpense = 0, pastNet = 0, pastMoney = 0;

        appData.transactions.forEach(t => {
            const d = new Date(t.date);
            if (d >= thirtyDaysAgo) {
                if (t.amount > 0 && t.category !== 'Loan') currentIncome += t.amount;
                if (t.amount < 0 && t.category !== 'Investment' && t.category !== 'Loan') currentExpense += Math.abs(t.amount);
                if (t.category !== 'Loan') currentNet += t.amount;
                currentMoney += t.amount;
            } else if (d >= sixtyDaysAgo && d < thirtyDaysAgo) {
                if (t.amount > 0 && t.category !== 'Loan') pastIncome += t.amount;
                if (t.amount < 0 && t.category !== 'Investment' && t.category !== 'Loan') pastExpense += Math.abs(t.amount);
                if (t.category !== 'Loan') pastNet += t.amount;
                pastMoney += t.amount;
            }
        });
        
        const calcPercent = (curr, past) => {
            if (past === 0) return curr > 0 ? '+100%' : (curr < 0 ? '-100%' : '0%');
            const pct = ((curr - past) / past) * 100;
            return (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';
        };

        return {
            income: calcPercent(currentIncome, pastIncome),
            expense: calcPercent(currentExpense, pastExpense),
            netWorth: calcPercent(currentNet, pastNet),
            moneyInHand: calcPercent(currentMoney, pastMoney)
        };
    },

    getChartData: (type, months) => {
        const labels = [];
        const data = [];
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        
        // Calculate the start date (X months ago)
        const startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - months);
        startDate.setHours(0, 0, 0, 0);

        let currentDate = new Date(startDate);
        
        // Pre-calculate running values right before the start date
        let runningValue = 0;
        if (type === 'networth') {
            runningValue = DataManager.getNetWorth();
            appData.transactions.forEach(t => {
                const td = new Date(t.date);
                if (td >= startDate && t.category !== 'Loan') {
                    runningValue -= t.amount;
                }
            });
        } else if (type === 'moneyinhand') {
            runningValue = DataManager.getMoneyInHand();
            appData.transactions.forEach(t => {
                const td = new Date(t.date);
                if (td >= startDate) {
                    runningValue -= t.amount;
                }
            });
        }
        
        while (currentDate <= now) {
            labels.push(currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            const startOfDay = new Date(currentDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(currentDate);
            endOfDay.setHours(23, 59, 59, 999);
            
            let dayValue = 0;
            
            if (type === 'networth') {
                appData.transactions.forEach(t => {
                    const td = new Date(t.date);
                    if (td >= startOfDay && td <= endOfDay && t.category !== 'Loan') {
                        runningValue += t.amount;
                    }
                });
                dayValue = runningValue;
            } else if (type === 'moneyinhand') {
                appData.transactions.forEach(t => {
                    const td = new Date(t.date);
                    if (td >= startOfDay && td <= endOfDay) {
                        runningValue += t.amount;
                    }
                });
                dayValue = runningValue;
            } else {
                appData.transactions.forEach(t => {
                    const td = new Date(t.date);
                    if (td >= startOfDay && td <= endOfDay) {
                        if (type === 'income' && t.amount > 0 && t.category !== 'Loan') {
                            dayValue += t.amount;
                        } else if (type === 'expense' && t.amount < 0 && t.category !== 'Investment' && t.category !== 'Loan') {
                            dayValue += Math.abs(t.amount);
                        }
                    }
                });
            }
            
            data.push(dayValue);
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return { labels, data };
    },

    getTransactions: (limit = null) => {
        const sorted = [...appData.transactions].sort((a, b) => {
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        return limit ? sorted.slice(0, limit) : sorted;
    },

    getRegularTransactions: (limit = null) => {
        const sorted = [...appData.transactions].filter(t => t.category !== 'Loan' && t.category !== 'Loan Settlement').sort((a, b) => {
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        return limit ? sorted.slice(0, limit) : sorted;
    },

    getLoanTransactions: (limit = null) => {
        const sorted = [...appData.transactions].filter(t => t.category === 'Loan' || t.category === 'Loan Settlement').sort((a, b) => {
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        return limit ? sorted.slice(0, limit) : sorted;
    },

    getAccountById: (id) => {
        return appData.accounts.find(a => a.id === id);
    },

    getCategories: (type) => {
        const defaults = type === 'expense' 
            ? ['Food', 'Transport', 'Utilities', 'Shopping', 'Healthcare', 'Entertainment', 'Housing'] 
            : ['Salary', 'Gift', 'Business', 'Refund', 'Interest'];
        
        const extracted = appData.transactions
            .filter(t => t.category !== 'Loan' && t.category !== 'Investment')
            .filter(t => type === 'expense' ? t.amount < 0 : t.amount > 0)
            .map(t => t.category);
            
        // Return unique, sorted combined list
        return [...new Set([...defaults, ...extracted])].sort();
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
        appData.transactions.push({ id: newId, createdAt: new Date().toISOString(), ...transaction });
        
        // Update account balance
        const account = appData.accounts.find(a => a.id === parseInt(transaction.accountId));
        if (account) {
            account.balance += parseFloat(transaction.amount);
        }

        // For transfers: also credit the destination account
        if (transaction.toAccountId) {
            const toAccount = appData.accounts.find(a => a.id === parseInt(transaction.toAccountId));
            if (toAccount) {
                toAccount.balance -= parseFloat(transaction.amount);
            }
        }
        
        DataManager.saveData();
    },
    
    deleteTransaction: (id) => {
        const index = appData.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            const t = appData.transactions[index];
            const account = appData.accounts.find(a => a.id === parseInt(t.accountId));
            if (account) {
                account.balance -= parseFloat(t.amount);
            }
            // For transfers: also reverse the destination account credit
            if (t.toAccountId) {
                const toAccount = appData.accounts.find(a => a.id === parseInt(t.toAccountId));
                if (toAccount) {
                    toAccount.balance += parseFloat(t.amount);
                }
            }
            appData.transactions.splice(index, 1);
            DataManager.saveData();
            return true;
        }
        return false;
    },

    editTransaction: (id, updatedTransaction) => {
        const index = appData.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            const oldT = appData.transactions[index];
            
            // Revert old transaction effect
            const oldAccount = appData.accounts.find(a => a.id === parseInt(oldT.accountId));
            if (oldAccount) {
                oldAccount.balance -= parseFloat(oldT.amount);
            }
            
            // Apply new transaction effect
            const newAccount = appData.accounts.find(a => a.id === parseInt(updatedTransaction.accountId));
            if (newAccount) {
                newAccount.balance += parseFloat(updatedTransaction.amount);
            }
            
            // Update transaction data
            appData.transactions[index] = { ...oldT, ...updatedTransaction };
            DataManager.saveData();
            return true;
        }
        return false;
    },

    getLoans: () => {
        return appData.loans;
    },
    
    addLoan: (loan, accountId) => {
        let remainingAmount = loan.amount;
        const targetType = loan.type;
        const oppositeType = targetType === 'given' ? 'received' : 'given';
        
        // Auto offset active opposite-type loans for the same person
        const oppositeLoans = appData.loans.filter(l => 
            (l.person || '').toLowerCase() === (loan.person || '').toLowerCase() && 
            l.type === oppositeType && 
            l.status === 'active'
        ).sort((a, b) => a.date.localeCompare(b.date));

        for (const opLoan of oppositeLoans) {
            if (remainingAmount <= 0) break;
            
            const opRemaining = opLoan.amount - opLoan.settledAmount;
            const offset = Math.min(remainingAmount, opRemaining);
            
            const isDirectPayment = loan.settlementType === 'direct';
            // Recording an auto-repayment. If the current new loan is direct payment, the offset is direct too.
            DataManager.recordLoanRepayment(opLoan.id, offset, accountId, isDirectPayment, `Offset against new loan: ${loan.description || ''}`);
            remainingAmount -= offset;
        }

        if (remainingAmount > 0) {
            const newId = appData.loans.length > 0 ? Math.max(...appData.loans.map(l => l.id)) + 1 : 1;
            const newLoan = { 
                id: newId, 
                settledAmount: 0, 
                status: 'active', 
                ...loan, 
                amount: remainingAmount 
            };
            appData.loans.push(newLoan);
            
            // Disburse or receive the loan principal
            if (loan.settlementType !== 'direct') {
                const amount = targetType === 'given' ? -Math.abs(remainingAmount) : Math.abs(remainingAmount);
                let merchant = targetType === 'given' ? 'Loan Given: ' + loan.person : 'Loan Received: ' + loan.person;
                if (loan.description) merchant += ` (${loan.description})`;
                
                DataManager.addTransaction({
                    date: loan.date,
                    merchant: merchant,
                    category: 'Loan',
                    amount: amount,
                    accountId: accountId,
                    status: 'Completed',
                    loanId: newId
                });
            }
        }
        
        DataManager.saveData();
    },
    
    deleteLoan: (id) => {
        const index = appData.loans.findIndex(l => l.id === id);
        if (index !== -1) {
            
            // Delete all associated transactions so history and balances are reverted
            const txsToDelete = appData.transactions.filter(t => 
                t.category === 'Loan' && t.loanId === id
            );
            
            txsToDelete.forEach(t => {
                DataManager.deleteTransaction(t.id);
            });

            appData.loans.splice(index, 1);
            DataManager.saveData();
            return true;
        }
        return false;
    },

    deletePersonHistory: (personName) => {
        const loansToDelete = appData.loans.filter(l => (l.person || '').toLowerCase() === personName.toLowerCase());
        
        loansToDelete.forEach(loan => {
            const txsToDelete = appData.transactions.filter(t => t.category === 'Loan' && t.loanId === loan.id);
            txsToDelete.forEach(t => {
                DataManager.deleteTransaction(t.id);
            });
            const index = appData.loans.findIndex(l => l.id === loan.id);
            if (index !== -1) appData.loans.splice(index, 1);
        });
        
        DataManager.saveData();
        return true;
    },

    updateLoan: (loanId, newData, accountId) => {
        const loan = appData.loans.find(l => l.id === loanId);
        if (!loan) return;

        const amountDiff = newData.amount - loan.amount;

        loan.person = newData.person;
        loan.description = newData.description;
        loan.amount = newData.amount;

        // Reset status if they increased the amount beyond settled
        if (loan.settledAmount < loan.amount) {
            loan.status = 'active';
        } else if (loan.settledAmount >= loan.amount) {
            loan.status = 'settled';
        }
        
        // Log the difference if amount changed
        if (amountDiff !== 0) {
            // "given" means I gave them money. If new amount > old amount (amountDiff > 0), I gave MORE money.
            // If I gave more, it subtracts from my account (-amountDiff).
            // If loan is "received" (I borrowed money), and new amount > old amount, I received MORE money.
            // So my account gets (+amountDiff).
            const txAmount = loan.type === 'given' ? -amountDiff : amountDiff;
            const actionText = amountDiff > 0 ? 'Increase' : 'Decrease';
            const merchantPrefix = loan.type === 'given' ? 'Lent' : 'Borrowed';
            
            DataManager.addTransaction({
                date: new Date().toISOString().split('T')[0],
                merchant: `Loan ${actionText} (${merchantPrefix}): ${loan.person}`,
                category: 'Loan',
                amount: txAmount,
                accountId: accountId,
                status: 'Completed',
                loanId: loanId
            });
        }
        
        DataManager.saveData();
    },

    recordLoanRepayment: (loanId, amount, accountId, isDirectPayment = false, description = '') => {
        const loan = appData.loans.find(l => l.id === loanId);
        if (!loan) return;
        
        const remaining = loan.amount - loan.settledAmount;
        let actualRepayment = amount;
        let overpaidAmount = 0;
        
        if (amount > remaining) {
            actualRepayment = remaining;
            overpaidAmount = amount - remaining;
        }

        loan.settledAmount += actualRepayment;
        if (loan.settledAmount >= loan.amount) {
            loan.status = 'settled';
        }
        
        if (!isDirectPayment) {
            const txAmount = loan.type === 'given' ? Math.abs(actualRepayment) : -Math.abs(actualRepayment);
            let merchant = loan.type === 'given' ? 'Loan Repayment From: ' + loan.person : 'Loan Repayment To: ' + loan.person;
            if (description) merchant += ` (${description})`;
            
            DataManager.addTransaction({
                date: new Date().toISOString().split('T')[0],
                merchant: merchant,
                category: 'Loan',
                amount: txAmount,
                accountId: accountId,
                status: 'Completed',
                loanId: loanId
            });
        }
        
        if (overpaidAmount > 0) {
            const newType = loan.type === 'given' ? 'received' : 'given';
            DataManager.addLoan({
                person: loan.person,
                amount: overpaidAmount,
                type: newType,
                date: new Date().toISOString().split('T')[0],
                description: description || `Overpayment from loan #${loan.id}`,
                settlementType: isDirectPayment ? 'direct' : 'cash'
            }, accountId);
        }
        
        DataManager.saveData();
    },
    
    transferFunds: (fromAccountId, toAccountId, amount, date, note) => {
        const fromAccount = appData.accounts.find(a => a.id === fromAccountId);
        const toAccount = appData.accounts.find(a => a.id === toAccountId);
        if (!fromAccount || !toAccount || fromAccountId === toAccountId || amount <= 0) return false;

        const description = note ? ` (${note})` : '';
        const transferAmount = Math.abs(amount);

        DataManager.addTransaction({
            date: date,
            merchant: `Transfer: ${fromAccount.name} → ${toAccount.name}${description}`,
            category: 'Transfer',
            amount: -transferAmount,
            accountId: fromAccountId,
            toAccountId: toAccountId,
            status: 'Completed'
        });

        return true;
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
    },

    formatMathInput: (inputElement) => {
        const val = inputElement.value;
        if (!val) return;
        try {
            const sanitized = val.replace(/[^-()\d/*+.]/g, '');
            if (sanitized) {
                const calculated = new Function("return (" + sanitized + ")")();
                if (!isNaN(calculated) && isFinite(calculated)) {
                    inputElement.value = Number(calculated).toFixed(2);
                } else {
                    inputElement.value = '';
                }
            } else {
                inputElement.value = '';
            }
        } catch (err) {
            // Keep original if completely invalid, or clear it
        }

        // Apply manual validation limits since type="text" ignores min/max natively
        const numVal = parseFloat(inputElement.value);
        if (!isNaN(numVal)) {
            const min = inputElement.getAttribute('min');
            const max = inputElement.getAttribute('max');
            if (min !== null && numVal < parseFloat(min)) {
                inputElement.setCustomValidity(`Value must be at least ${min}`);
            } else if (max !== null && numVal > parseFloat(max)) {
                inputElement.setCustomValidity(`Value must be at most ${max}`);
            } else {
                inputElement.setCustomValidity('');
            }
        } else if (inputElement.required) {
            inputElement.setCustomValidity('Please enter a valid amount');
        } else {
            inputElement.setCustomValidity('');
        }
    }
};

// Global listener to evaluate math inputs when user leaves the field
document.addEventListener('blur', function(e) {
    if (e.target && e.target.classList && e.target.classList.contains('math-input')) {
        DataManager.formatMathInput(e.target);
    }
}, true);

// One-time migration to set all existing transactions to April 21, 2026
if (!appData?.migratedToApril21) {
    if (appData && appData.transactions) {
        appData.transactions.forEach(t => {
            t.date = '2026-04-21';
        });
    }
    if (appData && appData.loans) {
        appData.loans.forEach(l => {
            if (l.date) l.date = '2026-04-21';
        });
    }
    if (appData) {
        appData.migratedToApril21 = true;
        
        // Wait a tick for DataManager to be fully initialized before calling save
        setTimeout(() => {
            if (typeof DataManager !== 'undefined') {
                DataManager.saveData();
            }
        }, 100);
    }
}
