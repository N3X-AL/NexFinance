// Load from LocalStorage if available
const defaultData = {
    accounts: [
        { id: 1, name: 'Main Account', type: 'Checking', balance: 0.00, color: 'var(--primary)' }
    ],
    creditCards: [],
    transactions: [],
    budgets: [],
    loans: [],
    categories: [
        'Business', 'Credit Card', 'Entertainment', 'Food', 'Gift', 'Healthcare', 'Housing', 'Interest', 'Refund', 'Salary', 'Shopping', 'Transport', 'Utilities'
    ],
    currency: 'USD'
};

const savedData = localStorage.getItem('nexfinance_data');
const appData = savedData ? JSON.parse(savedData) : defaultData;
if (!appData.currency) appData.currency = 'USD';
if (!appData.creditCards || !Array.isArray(appData.creditCards)) appData.creditCards = [];

// Canonical normalization for categories to deduplicate case-insensitively and ensure 'Credit Card' is present
const normalizeInitialCategories = (existingCats = []) => {
    const defaultCategories = ['Business', 'Credit Card', 'Entertainment', 'Food', 'Gift', 'Healthcare', 'Housing', 'Interest', 'Refund', 'Salary', 'Shopping', 'Transport', 'Utilities'];
    const map = new Map();
    [...defaultCategories, ...existingCats].forEach(cat => {
        if (!cat || typeof cat !== 'string') return;
        const trimmed = cat.trim();
        if (!trimmed) return;
        const lower = trimmed.toLowerCase();
        if (lower === 'credit card') {
            map.set(lower, 'Credit Card');
        } else if (!map.has(lower)) {
            map.set(lower, trimmed);
        }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
};

if (!appData.categories) {
    const extracted = (appData.transactions || [])
        .filter(t => t.category && !['loan', 'loan settlement', 'transfer', 'investment'].includes(t.category.toLowerCase()))
        .map(t => t.category);
    appData.categories = normalizeInitialCategories(extracted);
} else {
    appData.categories = normalizeInitialCategories(appData.categories);
}

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
                // Prevent duplicate render if remote data has no changes compared to local data
                try {
                    if (JSON.stringify(appData) === JSON.stringify(remoteData)) {
                        return false;
                    }
                } catch (e) {
                    // Continue to sync if comparison fails
                }

                // Clear and overwrite appData keys
                Object.keys(appData).forEach(k => delete appData[k]);
                Object.assign(appData, remoteData);
                localStorage.setItem('nexfinance_data', JSON.stringify(appData));
                return true;
            }
        }
        return false;
    },

    isCreditCardAccount: (accountId) => {
        if (!accountId) return false;
        const acc = (appData.accounts || []).find(a => a.id === accountId);
        if (acc && acc.type === 'Credit') return true;
        if ((appData.creditCards || []).some(c => c.accountId === accountId)) return true;
        return false;
    },

    isCreditCardTransaction: (t) => {
        if (!t) return false;
        if (t.category === 'Credit Card') return true;
        if (t.isCashAdvance) return true;
        if (t.targetCardId != null) return true;
        if (t.accountId && DataManager.isCreditCardAccount(t.accountId)) return true;
        if (t.toAccountId && DataManager.isCreditCardAccount(t.toAccountId)) return true;
        return false;
    },

    getNetWorth: () => {
        const nonCreditAccounts = (appData.accounts || []).filter(acc => !DataManager.isCreditCardAccount(acc.id));
        const accountBalance = nonCreditAccounts.reduce((sum, acc) => sum + acc.balance, 0);
        const loansGivenBalance = appData.loans.filter(l => l.type === 'given').reduce((sum, l) => sum + (l.amount - l.settledAmount), 0);
        const loansReceivedBalance = appData.loans.filter(l => l.type === 'received').reduce((sum, l) => sum + (l.amount - l.settledAmount), 0);
        return accountBalance + loansGivenBalance - loansReceivedBalance;
    },

    getMoneyInHand: () => {
        const nonCreditAccounts = (appData.accounts || []).filter(acc => !DataManager.isCreditCardAccount(acc.id));
        return nonCreditAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    },
    
    getMonthlyIncome: () => {
        return appData.transactions
            .filter(t => t.amount > 0 && t.category !== 'Loan' && !DataManager.isCreditCardTransaction(t))
            .reduce((sum, t) => sum + t.amount, 0);
    },
    
    getMonthlyExpenses: () => {
        return Math.abs(appData.transactions
            .filter(t => t.amount < 0 && t.category !== 'Investment' && t.category !== 'Loan' && t.category !== 'Transfer' && !DataManager.isCreditCardTransaction(t))
            .reduce((sum, t) => sum + t.amount, 0));
    },

    getTrendStats: () => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

        let currentIncome = 0, currentExpense = 0, currentNet = 0, currentMoney = 0;
        let pastIncome = 0, pastExpense = 0, pastNet = 0, pastMoney = 0;

        appData.transactions.forEach(t => {
            if (DataManager.isCreditCardTransaction(t)) return;
            const d = new Date(t.date);
            if (d >= thirtyDaysAgo) {
                if (t.amount > 0 && t.category !== 'Loan' && t.category !== 'Transfer') currentIncome += t.amount;
                if (t.amount < 0 && t.category !== 'Investment' && t.category !== 'Loan' && t.category !== 'Transfer') currentExpense += Math.abs(t.amount);
                if (t.category !== 'Loan' && t.category !== 'Transfer') currentNet += t.amount;
                if (t.category !== 'Transfer') currentMoney += t.amount;
            } else if (d >= sixtyDaysAgo && d < thirtyDaysAgo) {
                if (t.amount > 0 && t.category !== 'Loan' && t.category !== 'Transfer') pastIncome += t.amount;
                if (t.amount < 0 && t.category !== 'Investment' && t.category !== 'Loan' && t.category !== 'Transfer') pastExpense += Math.abs(t.amount);
                if (t.category !== 'Loan' && t.category !== 'Transfer') pastNet += t.amount;
                if (t.category !== 'Transfer') pastMoney += t.amount;
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

    getChartData: (type, months, category = null, accountId = null) => {
        const labels = [];
        const data = [];
        // Get max date from transactions for a static dataset, otherwise fallback to now
        const txs = appData.transactions.filter(t => t.category !== 'Loan' && t.category !== 'Loan Settlement' && t.category !== 'Transfer');
        let now = new Date();
        if (txs.length > 0) {
            let maxTime = 0;
            for (const t of txs) {
                const time = new Date(t.date).getTime();
                if (!isNaN(time) && time > maxTime) {
                    maxTime = time;
                }
            }
            if (maxTime > 0) {
                now = new Date(maxTime);
            }
        }
        now.setHours(23, 59, 59, 999);
        
        const startDate = new Date(now);
        const expectedMonth = (startDate.getMonth() - (months % 12) + 12) % 12;
        startDate.setMonth(startDate.getMonth() - months);
        if (startDate.getMonth() !== expectedMonth) {
            startDate.setDate(0);
        }
        startDate.setHours(0, 0, 0, 0);

        if (type === 'income' || type === 'expense') {
            const targetAccountId = (accountId !== null && accountId !== 'all') ? parseInt(accountId) : null;
            // Only emit data points for days that actually have relevant transactions
            const grouped = {};
            [...appData.transactions]
                .filter(t => {
                    const td = new Date(t.date);
                    if (td < startDate || td > now) return false;
                    if (targetAccountId !== null) {
                        if (t.accountId !== targetAccountId) return false;
                    } else if (DataManager.isCreditCardTransaction(t)) {
                        return false;
                    }
                    if (t.toAccountId || t.category === 'Credit Card' || t.isCashAdvance) return false;
                    if (type === 'income') return t.amount > 0 && t.category !== 'Loan' && t.category !== 'Loan Settlement' && t.category !== 'Transfer';
                    return t.amount < 0 && t.category !== 'Investment' && t.category !== 'Loan' && t.category !== 'Loan Settlement' && t.category !== 'Transfer';
                })
                .filter(t => category && category !== 'all' ? t.category === category : true)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .forEach(t => {
                    const label = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    grouped[label] = (grouped[label] || 0) + Math.abs(t.amount);
                });
            return { labels: Object.keys(grouped), data: Object.values(grouped) };
        }

        // networth / moneyinhand — running totals, only emit on days that have transactions
        let runningValue = 0;
        if (type === 'networth') {
            runningValue = DataManager.getNetWorth();
            appData.transactions.forEach(t => {
                if (DataManager.isCreditCardTransaction(t)) return;
                const td = new Date(t.date);
                if (td >= startDate && t.category !== 'Loan' && t.category !== 'Transfer') {
                    runningValue -= t.amount;
                }
            });
        } else {
            runningValue = DataManager.getMoneyInHand();
            appData.transactions.forEach(t => {
                if (DataManager.isCreditCardTransaction(t)) return;
                const td = new Date(t.date);
                if (td >= startDate && t.category !== 'Transfer') {
                    runningValue -= t.amount;
                }
            });
        }

        // Collect unique dates in range that have transactions, sorted ascending
        const uniqueDates = [...new Set(
            appData.transactions
                .filter(t => {
                    if (DataManager.isCreditCardTransaction(t)) return false;
                    const td = new Date(t.date);
                    return td >= startDate && td <= now;
                })
                .map(t => t.date)
        )].sort();

        uniqueDates.forEach(dateStr => {
            const startOfDay = new Date(dateStr);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(dateStr);
            endOfDay.setHours(23, 59, 59, 999);

            appData.transactions.forEach(t => {
                if (DataManager.isCreditCardTransaction(t)) return;
                const td = new Date(t.date);
                if (td >= startOfDay && td <= endOfDay) {
                    if (type === 'networth' && t.category !== 'Loan' && t.category !== 'Transfer') runningValue += t.amount;
                    else if (type === 'moneyinhand' && t.category !== 'Transfer') runningValue += t.amount;
                }
            });

            labels.push(new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            data.push(runningValue);
        });

        return { labels, data };
    },

    getMonthlyChartData: (type, months, category = null) => {
        const now = new Date();
        const labels = [];
        const data = [];

        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
        }

        if (type === 'income' || type === 'expense') {
            labels.forEach(label => {
                const sum = appData.transactions
                    .filter(t => {
                        if (DataManager.isCreditCardTransaction(t)) return false;
                        const td = new Date(t.date);
                        const tLabel = td.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                        if (tLabel !== label) return false;
                        if (type === 'income') return t.amount > 0 && t.category !== 'Loan' && t.category !== 'Loan Settlement' && t.category !== 'Transfer';
                        return t.amount < 0 && t.category !== 'Investment' && t.category !== 'Loan' && t.category !== 'Loan Settlement' && t.category !== 'Transfer';
                })
                .filter(t => category && category !== 'all' ? t.category === category : true)
                    .reduce((s, t) => s + Math.abs(t.amount), 0);
                data.push(sum);
            });
        } else {
            const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
            startMonth.setHours(0, 0, 0, 0);
            let runningValue = 0;
            appData.transactions
                .filter(t => {
                    if (DataManager.isCreditCardTransaction(t)) return false;
                    const td = new Date(t.date);
                    if (td >= startMonth) return false;
                    if (type === 'networth') return t.category !== 'Loan' && t.category !== 'Transfer';
                    return t.category !== 'Transfer';
                })
                .forEach(t => { runningValue += t.amount; });

            labels.forEach(label => {
                appData.transactions
                    .filter(t => {
                        if (DataManager.isCreditCardTransaction(t)) return false;
                        const td = new Date(t.date);
                        const tLabel = td.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                        if (tLabel !== label) return false;
                        if (type === 'networth') return t.category !== 'Loan' && t.category !== 'Transfer';
                        return t.category !== 'Transfer';
                    })
                    .forEach(t => { runningValue += t.amount; });
                data.push(runningValue);
            });
        }

        return { labels, data };
    },

    getTransactionYears: () => {
        const currentYear = new Date().getFullYear();
        const years = [...new Set(appData.transactions.map(t => new Date(t.date).getFullYear()))];
        if (!years.includes(currentYear)) years.push(currentYear);
        return years.sort((a, b) => b - a);
    },

    getTransactionMonthStops: () => {
        const txs = appData.transactions.filter(t => t.category !== 'Loan' && t.category !== 'Loan Settlement' && t.category !== 'Transfer' && t.category !== 'Credit Card' && !t.toAccountId && !t.isCashAdvance);
        if (txs.length === 0) return [1];

        let minTime = Infinity;
        let maxTime = 0;
        for (const t of txs) {
            const time = new Date(t.date).getTime();
            if (!isNaN(time)) {
                if (time < minTime) minTime = time;
                if (time > maxTime) maxTime = time;
            }
        }
        if (minTime === Infinity) return [1];

        const earliest = new Date(minTime);
        const latest = new Date(maxTime);
        const totalMonths = Math.max(1, (latest.getFullYear() - earliest.getFullYear()) * 12 + (latest.getMonth() - earliest.getMonth()) + 1);

        const candidates = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24, 36, 48, 60, 72, 84, 96, 120];
        const stops = candidates.filter(m => m < totalMonths);
        stops.push(totalMonths);
        return [...new Set(stops)].sort((a, b) => a - b);
    },

    formatMonthStop: (months, maxMonths) => {
        if (months >= maxMonths && maxMonths > 1) {
            if (months % 12 === 0) {
                const yrs = months / 12;
                return `All (${yrs} ${yrs === 1 ? 'Yr' : 'Yrs'})`;
            }
            return `All (${months} Mos)`;
        }
        if (months < 12) {
            return `${months} ${months === 1 ? 'Mo' : 'Mos'}`;
        }
        if (months % 12 === 0) {
            const yrs = months / 12;
            return `${yrs} ${yrs === 1 ? 'Yr' : 'Yrs'}`;
        }
        const yrs = (months / 12).toFixed(1).replace(/\.0$/, '');
        return `${yrs} Yrs`;
    },

    getDailyChartDataForMonth: (type, year, month, category = null, accountId = null) => {
        const startDate = new Date(year, month, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(year, month + 1, 0);
        endDate.setHours(23, 59, 59, 999);

        if (type === 'income' || type === 'expense') {
            const targetAccountId = (accountId !== null && accountId !== 'all') ? parseInt(accountId) : null;
            const grouped = {};
            [...appData.transactions]
                .filter(t => {
                    const td = new Date(t.date);
                    if (td < startDate || td > endDate) return false;
                    if (targetAccountId !== null) {
                        if (t.accountId !== targetAccountId) return false;
                    } else if (DataManager.isCreditCardTransaction(t)) {
                        return false;
                    }
                    if (t.toAccountId || t.category === 'Credit Card' || t.isCashAdvance) return false;
                    if (type === 'income') return t.amount > 0 && t.category !== 'Loan' && t.category !== 'Loan Settlement' && t.category !== 'Transfer';
                    return t.amount < 0 && t.category !== 'Investment' && t.category !== 'Loan' && t.category !== 'Loan Settlement' && t.category !== 'Transfer';
                })
                .filter(t => category && category !== 'all' ? t.category === category : true)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .forEach(t => {
                    const label = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    grouped[label] = (grouped[label] || 0) + Math.abs(t.amount);
                });
            return { labels: Object.keys(grouped), data: Object.values(grouped) };
        }

        // networth / moneyinhand — running total rewound to start of month
        let runningValue = 0;
        if (type === 'networth') {
            runningValue = DataManager.getNetWorth();
            appData.transactions.forEach(t => {
                if (DataManager.isCreditCardTransaction(t)) return;
                const td = new Date(t.date);
                if (td >= startDate && t.category !== 'Loan' && t.category !== 'Transfer') runningValue -= t.amount;
            });
        } else {
            runningValue = DataManager.getMoneyInHand();
            appData.transactions.forEach(t => {
                if (DataManager.isCreditCardTransaction(t)) return;
                const td = new Date(t.date);
                if (td >= startDate && t.category !== 'Transfer') runningValue -= t.amount;
            });
        }

        const uniqueDates = [...new Set(
            appData.transactions
                .filter(t => {
                    if (DataManager.isCreditCardTransaction(t)) return false;
                    const td = new Date(t.date);
                    return td >= startDate && td <= endDate;
                })
                .map(t => t.date)
        )].sort();

        const labels = [];
        const data = [];
        uniqueDates.forEach(dateStr => {
            const startOfDay = new Date(dateStr); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(dateStr); endOfDay.setHours(23, 59, 59, 999);
            appData.transactions.forEach(t => {
                if (DataManager.isCreditCardTransaction(t)) return;
                const td = new Date(t.date);
                if (td >= startOfDay && td <= endOfDay) {
                    if (type === 'networth' && t.category !== 'Loan' && t.category !== 'Transfer') runningValue += t.amount;
                    else if (type === 'moneyinhand' && t.category !== 'Transfer') runningValue += t.amount;
                }
            });
            labels.push(new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            data.push(runningValue);
        });

        return { labels, data };
    },

    getAllTransactionsChartData: (limit) => {
        const sorted = [...appData.transactions]
            .filter(t => t.category !== 'Transfer')
            .sort((a, b) => {
                const dateDiff = new Date(b.date) - new Date(a.date);
                if (dateDiff !== 0) return dateDiff;
                return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
            })
            .slice(-limit);

        return {
            labels: sorted.map(t => new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            data: sorted.map(t => t.amount),
            descriptions: sorted.map(t => t.description || t.category),
            colors: sorted.map(t => t.amount >= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.75)'),
            borderColors: sorted.map(t => t.amount >= 0 ? '#10b981' : '#ef4444')
        };
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
        const sorted = [...appData.transactions]
            .filter(t => t.category !== 'Loan' && t.category !== 'Loan Settlement' && t.category !== 'Transfer' && t.category !== 'Credit Card' && !t.toAccountId && !t.isCashAdvance)
            .sort((a, b) => {
                const dateDiff = new Date(b.date) - new Date(a.date);
                if (dateDiff !== 0) return dateDiff;
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            });
        return limit ? sorted.slice(0, limit) : sorted;
    },

    getDashboardTransactions: (limit = null) => {
        const sorted = [...appData.transactions]
            .filter(t => t.category !== 'Loan' && t.category !== 'Loan Settlement' && !DataManager.isCreditCardTransaction(t))
            .sort((a, b) => {
                const dateDiff = new Date(b.date) - new Date(a.date);
                if (dateDiff !== 0) return dateDiff;
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            });
        return limit ? sorted.slice(0, limit) : sorted;
    },

    getAccountTransfers: (accountId) => {
        return [...appData.transactions]
            .filter(t => t.category === 'Transfer' && (t.accountId === accountId || t.toAccountId === accountId))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
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

    getCanonicalSystemCategory: (category) => {
        if (!category) return null;
        const lower = category.trim().toLowerCase();
        const systemCategories = {
            'loan': 'Loan',
            'loan settlement': 'Loan Settlement',
            'transfer': 'Transfer',
            'investment': 'Investment'
        };
        return systemCategories[lower] || null;
    },

    getCategories: () => {
        const defaultCategories = ['Business', 'Credit Card', 'Entertainment', 'Food', 'Gift', 'Healthcare', 'Housing', 'Interest', 'Refund', 'Salary', 'Shopping', 'Transport', 'Utilities'];
        const existing = (appData.categories && Array.isArray(appData.categories)) ? appData.categories : [];
        const extracted = (appData.transactions || [])
            .filter(t => t.category && !DataManager.getCanonicalSystemCategory(t.category))
            .map(t => t.category);

        const map = new Map();
        [...defaultCategories, ...existing, ...extracted].forEach(cat => {
            if (!cat || typeof cat !== 'string') return;
            const trimmed = cat.trim();
            if (!trimmed) return;
            const lower = trimmed.toLowerCase();
            if (lower === 'credit card') {
                map.set(lower, 'Credit Card');
            } else if (!map.has(lower)) {
                map.set(lower, trimmed);
            }
        });
        appData.categories = Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return [...appData.categories];
    },

    addCategory: (name) => {
        DataManager.getCategories();
        const lowerName = name.trim().toLowerCase();
        if (appData.categories.some(c => c.toLowerCase() === lowerName)) {
            return false;
        }
        appData.categories.push(name.trim());
        appData.categories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        DataManager.saveData();
        return true;
    },

    deleteCategory: (name, fallbackName) => {
        // Protect 'Credit Card' category from deletion
        if (name.trim().toLowerCase() === 'credit card') {
            return false;
        }

        DataManager.getCategories();
        const idx = appData.categories.findIndex(c => c === name);
        if (idx !== -1) {
            appData.categories.splice(idx, 1);
        }

        const lowerFallback = fallbackName.trim().toLowerCase();
        if (!appData.categories.some(c => c.toLowerCase() === lowerFallback)) {
            appData.categories.push(fallbackName.trim());
            appData.categories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        }

        appData.transactions.forEach(t => {
            if (t.category === name) {
                t.category = fallbackName.trim();
            }
        });

        DataManager.saveData();
        return true;
    },

    editCategory: (oldName, newName) => {
        // Protect 'Credit Card' category from being renamed
        if (oldName.trim().toLowerCase() === 'credit card') {
            return false;
        }

        DataManager.getCategories();
        const lowerNewName = newName.trim().toLowerCase();
        const lowerOldName = oldName.toLowerCase();
        
        // Cannot rename another category to 'Credit Card'
        if (lowerNewName === 'credit card') {
            return false;
        }

        // If the name didn't practically change, do nothing
        if (lowerOldName === lowerNewName && oldName.trim() === newName.trim()) return true;

        // Check for collision
        if (lowerOldName !== lowerNewName && appData.categories.some(c => c.toLowerCase() === lowerNewName)) {
            return false; // New name already exists
        }

        const idx = appData.categories.findIndex(c => c === oldName);
        if (idx !== -1) {
            appData.categories[idx] = newName.trim();
            appData.categories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        } else {
            appData.categories.push(newName.trim());
            appData.categories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        }

        // Update all transactions using the old category
        appData.transactions.forEach(t => {
            if (t.category === oldName) {
                t.category = newName.trim();
            }
        });

        DataManager.saveData();
        return true;
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

    getLocalDateString: (date = new Date()) => {
        if (!date) date = new Date();
        if (typeof date === 'string') {
            const trimmed = date.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return trimmed;
            }
        }
        const d = date instanceof Date ? date : new Date(date);
        const validDate = isNaN(d.getTime()) ? new Date() : d;
        const year = validDate.getFullYear();
        const month = String(validDate.getMonth() + 1).padStart(2, '0');
        const day = String(validDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    parseLocalDate: (dateStr) => {
        if (!dateStr) return new Date();
        if (dateStr instanceof Date) return dateStr;
        const str = String(dateStr).trim();
        const parts = str.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return new Date(y, m, d, 12, 0, 0);
        }
        return new Date(dateStr);
    },

    escapeHtml: (str) => {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    addTransaction: (transaction) => {
        if (transaction.category) {
            transaction.category = transaction.category.trim();
            if (transaction.category === '') {
                transaction.category = 'Uncategorized';
            } else {
                const canonicalSystem = DataManager.getCanonicalSystemCategory(transaction.category);
                if (canonicalSystem) {
                    transaction.category = canonicalSystem;
                } else {
                    DataManager.addCategory(transaction.category);
                }
            }
        }
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
            if (t.isDecoupled) {
                // Decoupled transfer/payment with a deleted account: do not adjust account balance to avoid phantom money
                appData.transactions.splice(index, 1);
                DataManager.saveData();
                return true;
            }
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
        if (updatedTransaction.category) {
            updatedTransaction.category = updatedTransaction.category.trim();
            if (updatedTransaction.category === '') {
                updatedTransaction.category = 'Uncategorized';
            } else {
                const canonicalSystem = DataManager.getCanonicalSystemCategory(updatedTransaction.category);
                if (canonicalSystem) {
                    updatedTransaction.category = canonicalSystem;
                } else {
                    DataManager.addCategory(updatedTransaction.category);
                }
            }
        }
        const index = appData.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            const oldT = appData.transactions[index];
            if (oldT.isDecoupled) {
                // Decoupled transfer with deleted account: guard balance and account mutators
                updatedTransaction.amount = oldT.amount;
                updatedTransaction.accountId = oldT.accountId;
                updatedTransaction.toAccountId = oldT.toAccountId;
                updatedTransaction.isDecoupled = true;
                updatedTransaction.decoupledDirection = oldT.decoupledDirection;
                updatedTransaction.deletedAccountName = oldT.deletedAccountName;
                appData.transactions[index] = { ...oldT, ...updatedTransaction };
                DataManager.saveData();
                return true;
            }
            
            // Revert old transaction effect on source account
            const oldAccount = appData.accounts.find(a => a.id === parseInt(oldT.accountId));
            if (oldAccount) {
                oldAccount.balance -= parseFloat(oldT.amount);
            }
            // Revert old transaction effect on destination account (if it was a transfer/payment)
            if (oldT.toAccountId) {
                const oldDestAccount = appData.accounts.find(a => a.id === parseInt(oldT.toAccountId));
                if (oldDestAccount) {
                    oldDestAccount.balance += parseFloat(oldT.amount);
                }
            }
            
            // Apply new transaction effect on source account
            const newAccountId = updatedTransaction.accountId !== undefined ? parseInt(updatedTransaction.accountId) : parseInt(oldT.accountId);
            const newAmount = updatedTransaction.amount !== undefined ? parseFloat(updatedTransaction.amount) : parseFloat(oldT.amount);
            const newAccount = appData.accounts.find(a => a.id === newAccountId);
            if (newAccount) {
                newAccount.balance += newAmount;
            }
            // Apply new transaction effect on destination account (if it is a transfer/payment)
            const newToAccountId = updatedTransaction.toAccountId !== undefined ? (updatedTransaction.toAccountId ? parseInt(updatedTransaction.toAccountId) : null) : (oldT.toAccountId ? parseInt(oldT.toAccountId) : null);
            if (newToAccountId) {
                const newDestAccount = appData.accounts.find(a => a.id === newToAccountId);
                if (newDestAccount) {
                    newDestAccount.balance -= newAmount;
                }
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

    findLoanDisbursementTransaction: (loanId) => {
        return appData.transactions.find(t =>
            t.loanId === loanId &&
            (t.merchant.startsWith('Loan Given:') || t.merchant.startsWith('Loan Received:'))
        );
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
            DataManager.recordLoanRepayment(opLoan.id, offset, accountId, isDirectPayment, `Offset against new loan: ${loan.description || ''}`, loan.date);
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


    editLoanRepayment: (transactionId, loanId, updatedData) => {
        const txIndex = appData.transactions.findIndex(t => t.id === transactionId);
        const loan = appData.loans.find(l => l.id === loanId);
        if (txIndex === -1 || !loan) return false;

        const oldTx = appData.transactions[txIndex];
        const oldAbsAmount = Math.abs(oldTx.amount);
        const newAbsAmount = updatedData.amount;
        const amountDiff = newAbsAmount - oldAbsAmount;

        // Revert old transaction effect on account
        const oldAccount = appData.accounts.find(a => a.id === parseInt(oldTx.accountId));
        if (oldAccount) {
            oldAccount.balance -= parseFloat(oldTx.amount);
        }

        // Adjust loan settledAmount
        // Overpayments aren't handled during edit currently (complex edge cases), so just bound to max
        loan.settledAmount += amountDiff;
        if (loan.settledAmount < 0) loan.settledAmount = 0;

        if (loan.settledAmount >= loan.amount) {
            loan.status = 'settled';
        } else {
            loan.status = 'active';
        }

        // Form new merchant string
        let merchant = loan.type === 'given' ? 'Loan Repayment From: ' + loan.person : 'Loan Repayment To: ' + loan.person;
        if (updatedData.description) merchant += ` (${updatedData.description})`;

        // New transaction amount sign
        const txAmount = loan.type === 'given' ? Math.abs(newAbsAmount) : -Math.abs(newAbsAmount);

        // Apply new transaction effect on account
        const newAccount = appData.accounts.find(a => a.id === parseInt(updatedData.accountId));
        if (newAccount) {
            newAccount.balance += parseFloat(txAmount);
        }

        // Update transaction object
        appData.transactions[txIndex] = {
            ...oldTx,
            date: updatedData.date,
            amount: txAmount,
            accountId: updatedData.accountId,
            merchant: merchant
        };

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

        // If the account changed, move the original disbursement transaction to the new account
        const originalTx = DataManager.findLoanDisbursementTransaction(loanId);
        if (originalTx && parseInt(originalTx.accountId) !== parseInt(accountId)) {
            DataManager.editTransaction(originalTx.id, { accountId: accountId, amount: originalTx.amount });
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
                date: DataManager.getLocalDateString(),
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

    recordLoanRepayment: (loanId, amount, accountId, isDirectPayment = false, description = '', date = null) => {
        const loan = appData.loans.find(l => l.id === loanId);
        if (!loan) return;
        
        const repaymentDate = date || DataManager.getLocalDateString();
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
                date: repaymentDate,
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
                date: repaymentDate,
                description: description || `Overpayment from loan #${loan.id}`,
                settlementType: isDirectPayment ? 'direct' : 'cash'
            }, accountId);
        }
        
        DataManager.saveData();
    },
    
    mutualSettlement: (personName, amount) => {
        const lowerName = (personName || '').toLowerCase();
        const offsetAmount = Math.abs(amount);

        const applyDirectSettlement = (loanType) => {
            const loans = appData.loans.filter(l =>
                (l.person || '').toLowerCase() === lowerName &&
                l.type === loanType && l.status === 'active'
            ).sort((a, b) => a.date.localeCompare(b.date));

            let remainingToSettle = offsetAmount;
            for (const loan of loans) {
                if (remainingToSettle <= 0) break;
                const unsettledAmount = loan.amount - loan.settledAmount;
                const toSettle = Math.min(remainingToSettle, unsettledAmount);
                loan.settledAmount += toSettle;
                if (loan.settledAmount >= loan.amount) loan.status = 'settled';
                remainingToSettle -= toSettle;
            }
        };

        applyDirectSettlement('received'); // I owe them — offset first
        applyDirectSettlement('given');    // They owe me — offset same amount

        DataManager.saveData();
    },

    transferFunds: (fromAccountId, toAccountId, amount, date, note) => {
        const fromAccount = appData.accounts.find(a => a.id === fromAccountId);
        const toAccount = appData.accounts.find(a => a.id === toAccountId);
        if (!fromAccount || !toAccount || fromAccountId === toAccountId || amount <= 0) return false;

        const isCashAdvance = fromAccount.type === 'Credit';
        const prefix = isCashAdvance ? 'Cash Advance' : 'Transfer';
        const description = note ? ` (${note})` : '';
        const transferAmount = Math.abs(amount);

        const card = (isCashAdvance && typeof CreditCardManager !== 'undefined') ? CreditCardManager.getCreditCardByAccountId(fromAccountId) : null;

        DataManager.addTransaction({
            date: date,
            merchant: `${prefix}: ${fromAccount.name} → ${toAccount.name}${description}`,
            category: 'Transfer',
            amount: -transferAmount,
            accountId: fromAccountId,
            toAccountId: toAccountId,
            targetCardId: card ? card.id : null,
            isCashAdvance: isCashAdvance,
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
        id = parseInt(id);
        const deletedAccount = (appData.accounts || []).find(a => a.id === id);
        const deletedAccName = deletedAccount ? deletedAccount.name : 'Deleted Account';

        // Check if the account being deleted is linked to a credit card
        const deletedCard = (typeof CreditCardManager !== 'undefined') ? CreditCardManager.getCreditCardByAccountId(id) : null;
        const deletedCardId = deletedCard ? deletedCard.id : null;

        // Remove the account
        appData.accounts = (appData.accounts || []).filter(a => a.id !== id);
        
        // Preserve history on surviving accounts while decoupling references to the deleted account
        const updatedTransactions = [];
        (appData.transactions || []).forEach(t => {
            const isSource = t.accountId === id;
            const isDest = t.toAccountId === id;

            if (isSource && isDest) {
                // Internal transaction entirely inside deleted account: drop
                return;
            }

            if (isDest && !isSource) {
                // Surviving account was the source (e.g. transfer/payment sent from Checking to Deleted Account).
                // Keep transaction on source account, decouple toAccountId reference so history is preserved.
                t.toAccountId = null;
                t.isDecoupled = true;
                t.decoupledDirection = 'outgoing';
                t.deletedAccountName = deletedAccName;
                if (deletedCardId && t.targetCardId === deletedCardId) {
                    t.targetCardId = null;
                }
                if (t.merchant && !t.merchant.includes('(Deleted)')) {
                    t.merchant = `${t.merchant} (Deleted)`;
                }
                updatedTransactions.push(t);
            } else if (isSource && t.toAccountId && !isDest) {
                // Surviving account was the destination (e.g. transfer received by Checking from Deleted Account).
                // Keep record as an incoming transfer on the surviving destination account.
                t.accountId = t.toAccountId;
                t.toAccountId = null;
                t.amount = Math.abs(t.amount);
                t.isDecoupled = true;
                t.decoupledDirection = 'incoming';
                t.deletedAccountName = deletedAccName;
                if (deletedCardId && t.targetCardId === deletedCardId) {
                    t.targetCardId = null;
                }
                if (t.merchant && !t.merchant.includes('(Deleted)')) {
                    t.merchant = `${t.merchant} (from ${deletedAccName} - Deleted)`;
                } else if (!t.merchant) {
                    t.merchant = `Transfer from ${deletedAccName} (Deleted)`;
                }
                updatedTransactions.push(t);
            } else if (!isSource && !isDest) {
                // Unrelated transaction: keep intact
                updatedTransactions.push(t);
            }
            // else isSource && !t.toAccountId: standalone transaction on deleted account (e.g. retail charge): drop
        });

        appData.transactions = updatedTransactions;
        
        // Remove any linked credit card
        if (appData.creditCards) {
            appData.creditCards = appData.creditCards.filter(c => c.accountId !== id);
        }
        
        DataManager.saveData();
    },

    formatMathInput: (inputElement) => {
        if (!inputElement || !inputElement.value) return;

        const rawValue = inputElement.value.trim();
        // Skip if it's already a clean decimal or empty
        if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
            // Apply min/max checks if any
            const numVal = parseFloat(rawValue);
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
            }
            return;
        }

        try {
            // Allow only numbers, operators, parens, and decimal points
            const sanitized = rawValue.replace(/[^0-9+\-*/().]/g, '');
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

const CreditCardManager = {
    syncWithAccounts: () => {
        if (!appData.creditCards) appData.creditCards = [];
        if (!appData.accounts) appData.accounts = [];

        // For any account of type 'Credit', ensure a card config exists
        appData.accounts.forEach(acc => {
            if (acc.type === 'Credit') {
                let card = appData.creditCards.find(c => c.accountId === acc.id);
                if (!card) {
                    const nextId = appData.creditCards.length > 0 ? Math.max(...appData.creditCards.map(c => c.id)) + 1 : 1;
                    card = {
                        id: nextId,
                        accountId: acc.id,
                        name: acc.name,
                        bank: 'Credit Card',
                        last4: '4128',
                        creditLimit: 5000,
                        apr: 24.99,
                        billingCycleDay: 15,
                        gracePeriodDays: 25,
                        minPaymentPercent: 3.5,
                        minPaymentFloor: 25,
                        foreignTxFee: 3.0,
                        annualFee: 0,
                        colorTheme: 'obsidian'
                    };
                    appData.creditCards.push(card);
                }
            }
        });

        // Remove cards whose linked account no longer exists or is no longer of type 'Credit'
        appData.creditCards = appData.creditCards.filter(c => appData.accounts.some(a => a.id === c.accountId && a.type === 'Credit'));
        return appData.creditCards;
    },

    getCreditCards: () => {
        return CreditCardManager.syncWithAccounts();
    },

    getCreditCardById: (id) => {
        const cards = CreditCardManager.getCreditCards();
        return cards.find(c => c.id === parseInt(id));
    },

    getCreditCardByAccountId: (accId) => {
        const cards = CreditCardManager.getCreditCards();
        return cards.find(c => c.accountId === parseInt(accId));
    },

    saveCreditCard: (cardData) => {
        CreditCardManager.syncWithAccounts();
        const id = cardData.id ? parseInt(cardData.id) : null;
        let card = id ? appData.creditCards.find(c => c.id === id) : null;

        if (card) {
            card.name = cardData.name || card.name;
            card.bank = cardData.bank || card.bank;
            card.last4 = cardData.last4 || card.last4;
            card.creditLimit = parseFloat(cardData.creditLimit) || 5000;
            card.apr = parseFloat(cardData.apr) || 24.99;
            card.cashAdvanceApr = (cardData.cashAdvanceApr !== undefined && cardData.cashAdvanceApr !== '') ? parseFloat(cardData.cashAdvanceApr) : (card.cashAdvanceApr !== undefined ? card.cashAdvanceApr : 27.99);
            card.cashAdvanceFee = (cardData.cashAdvanceFee !== undefined && cardData.cashAdvanceFee !== '') ? parseFloat(cardData.cashAdvanceFee) : (card.cashAdvanceFee !== undefined ? card.cashAdvanceFee : 3.0);
            card.billingCycleDay = Math.min(31, Math.max(1, parseInt(cardData.billingCycleDay) || 15));
            card.gracePeriodDays = Math.max(1, parseInt(cardData.gracePeriodDays) || 25);
            card.minPaymentPercent = parseFloat(cardData.minPaymentPercent) || 3.5;
            card.minPaymentFloor = parseFloat(cardData.minPaymentFloor) || 25;
            card.foreignTxFee = parseFloat(cardData.foreignTxFee) || 0;
            card.annualFee = parseFloat(cardData.annualFee) || 0;
            card.colorTheme = cardData.colorTheme || card.colorTheme || 'obsidian';

            // Also update linked account
            const account = DataManager.getAccountById(card.accountId);
            if (account) {
                account.name = card.name;
            }
        } else {
            // New card: also create an account with type 'Credit'
            const nextAccountId = appData.accounts.length > 0 ? Math.max(...appData.accounts.map(a => a.id)) + 1 : 1;
            const newAccount = {
                id: nextAccountId,
                name: cardData.name || 'Credit Card',
                type: 'Credit',
                balance: cardData.initialBalance ? -Math.abs(parseFloat(cardData.initialBalance)) : 0,
                color: 'var(--danger)'
            };
            appData.accounts.push(newAccount);

            const nextCardId = appData.creditCards.length > 0 ? Math.max(...appData.creditCards.map(c => c.id)) + 1 : 1;
            card = {
                id: nextCardId,
                accountId: nextAccountId,
                name: cardData.name || 'Credit Card',
                bank: cardData.bank || 'Bank',
                last4: cardData.last4 || '0000',
                creditLimit: parseFloat(cardData.creditLimit) || 5000,
                apr: parseFloat(cardData.apr) || 24.99,
                cashAdvanceApr: (cardData.cashAdvanceApr !== undefined && cardData.cashAdvanceApr !== '') ? parseFloat(cardData.cashAdvanceApr) : 27.99,
                cashAdvanceFee: (cardData.cashAdvanceFee !== undefined && cardData.cashAdvanceFee !== '') ? parseFloat(cardData.cashAdvanceFee) : 3.0,
                billingCycleDay: Math.min(31, Math.max(1, parseInt(cardData.billingCycleDay) || 15)),
                gracePeriodDays: Math.max(1, parseInt(cardData.gracePeriodDays) || 25),
                minPaymentPercent: parseFloat(cardData.minPaymentPercent) || 3.5,
                minPaymentFloor: parseFloat(cardData.minPaymentFloor) || 25,
                foreignTxFee: parseFloat(cardData.foreignTxFee) || 0,
                annualFee: parseFloat(cardData.annualFee) || 0,
                colorTheme: cardData.colorTheme || 'obsidian'
            };
            appData.creditCards.push(card);
        }

        DataManager.saveData();
        return card;
    },

    deleteCreditCard: (id) => {
        const cardId = parseInt(id);
        const cardIndex = appData.creditCards.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            const card = appData.creditCards[cardIndex];
            appData.creditCards.splice(cardIndex, 1);
            // Delegate account and transaction deletion to DataManager.deleteAccount
            if (card.accountId) {
                DataManager.deleteAccount(card.accountId);
            }
            // Decouple any surviving transactions referencing targetCardId
            (appData.transactions || []).forEach(t => {
                if (t.targetCardId === cardId) {
                    t.targetCardId = null;
                }
            });
            DataManager.saveData();
            return true;
        }
        return false;
    },

    getCardBillingCycle: (card, refDate = new Date()) => {
        const d = refDate instanceof Date ? refDate : new Date(refDate);
        const validDate = isNaN(d.getTime()) ? new Date() : d;
        const cycleDay = Math.min(31, Math.max(1, parseInt(card.billingCycleDay) || 15));
        const graceDays = Math.max(1, parseInt(card.gracePeriodDays) || 25);

        const year = validDate.getFullYear();
        const month = validDate.getMonth(); // 0-indexed
        const day = validDate.getDate();

        const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
        const thisMonthCutDay = Math.min(cycleDay, getDaysInMonth(year, month));

        let endYear, endMonth, endDay, priorYear, priorMonth, priorDay;

        if (day > thisMonthCutDay) {
            // Current cycle ends next month on effective cycleDay
            endYear = month === 11 ? year + 1 : year;
            endMonth = (month + 1) % 12;
            endDay = Math.min(cycleDay, getDaysInMonth(endYear, endMonth));

            // Prior cycle ended this month on effective cycleDay
            priorYear = year;
            priorMonth = month;
            priorDay = thisMonthCutDay;
        } else {
            // Current cycle ends this month on effective cycleDay
            endYear = year;
            endMonth = month;
            endDay = thisMonthCutDay;

            // Prior cycle ended previous month on effective cycleDay
            priorYear = month === 0 ? year - 1 : year;
            priorMonth = (month + 11) % 12;
            priorDay = Math.min(cycleDay, getDaysInMonth(priorYear, priorMonth));
        }

        const cycleEnd = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);
        // Start is strictly the day after the effective prior statement date (prevents short-month overlapping)
        const cycleStart = new Date(priorYear, priorMonth, priorDay + 1, 0, 0, 0, 0);

        const dueDate = new Date(cycleEnd.getTime() + (graceDays * 24 * 60 * 60 * 1000));
        dueDate.setHours(23, 59, 59, 999);

        // Days remaining
        const msPerDay = 24 * 60 * 60 * 1000;
        const startOfRefDay = new Date(validDate.getFullYear(), validDate.getMonth(), validDate.getDate()).getTime();
        const startOfCutDay = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), cycleEnd.getDate()).getTime();
        const startOfDueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();

        const daysUntilCut = Math.max(0, Math.round((startOfCutDay - startOfRefDay) / msPerDay));
        const daysUntilDue = Math.max(0, Math.round((startOfDueDay - startOfRefDay) / msPerDay));

        return {
            startDate: cycleStart,
            endDate: cycleEnd,
            dueDate: dueDate,
            daysUntilCut,
            daysUntilDue,
            startDateStr: DataManager.getLocalDateString(cycleStart),
            endDateStr: DataManager.getLocalDateString(cycleEnd),
            dueDateStr: DataManager.getLocalDateString(dueDate)
        };
    },

    getCardMetrics: (card, refDate = new Date()) => {
        const account = DataManager.getAccountById(card.accountId);
        const cycle = CreditCardManager.getCardBillingCycle(card, refDate);
        const cycleStartMs = cycle.startDate.getTime();
        const cycleEndMs = cycle.endDate.getTime();

        // Outstanding balance:
        // In NexFinance, credit accounts have negative balance when spent (e.g. -1500 means $1500 owed)
        const accountBalance = account ? account.balance : 0;
        const totalOutstanding = accountBalance < 0 ? Math.abs(accountBalance) : 0;

        // Current cycle transactions
        let cyclePurchases = 0;
        let cyclePayments = 0;
        let cashAdvancePurchases = 0;
        let cashAdvanceInterest = 0;
        let cashAdvanceFees = 0;
        const cardTransactions = [];
        const apr = parseFloat(card.apr) || 0;
        const dailyRate = apr > 0 ? (apr / 100) / 365 : 0;
        const cashAdvanceApr = (card.cashAdvanceApr !== undefined && !isNaN(parseFloat(card.cashAdvanceApr))) ? parseFloat(card.cashAdvanceApr) : (apr || 27.99);
        const cashAdvanceDailyRate = cashAdvanceApr > 0 ? (cashAdvanceApr / 100) / 365 : 0;
        const cashAdvanceFeeRate = ((card.cashAdvanceFee !== undefined && !isNaN(parseFloat(card.cashAdvanceFee))) ? parseFloat(card.cashAdvanceFee) : 3.0) / 100;

        let priorCashAdvances = 0;

        (appData.transactions || []).forEach(t => {
            const isCardExpense = t.accountId === card.accountId && t.amount < 0;
            const isCardPayment = (t.toAccountId === card.accountId && !t.isCashAdvance) ||
                                  (t.targetCardId === card.id && !t.isCashAdvance) ||
                                  (t.accountId === card.accountId && t.amount > 0) ||
                                  (t.category && t.category.toLowerCase() === 'credit card' && (t.targetCardId === card.id || t.toAccountId === card.accountId));

            if (isCardExpense || isCardPayment) {
                cardTransactions.push(t);
                const tDate = DataManager.parseLocalDate(t.date);
                const tTime = tDate.getTime();
                if (tTime >= cycleStartMs && tTime <= cycleEndMs) {
                    if (isCardExpense) {
                        cyclePurchases += Math.abs(t.amount);
                        if (t.isCashAdvance) {
                            cashAdvancePurchases += Math.abs(t.amount);
                            const daysFromTx = Math.max(1, Math.round((cycleEndMs - tTime) / (24 * 60 * 60 * 1000)));
                            cashAdvanceInterest += Math.abs(t.amount) * cashAdvanceDailyRate * daysFromTx;
                            cashAdvanceFees += Math.abs(t.amount) * cashAdvanceFeeRate;
                        }
                    } else if (isCardPayment) {
                        cyclePayments += Math.abs(t.amount);
                    }
                } else if (tTime < cycleStartMs && isCardExpense && t.isCashAdvance) {
                    priorCashAdvances += Math.abs(t.amount);
                }
            }
        });

        // Carried balance from prior statement (unpaid balance before current cycle)
        const regularPurchases = Math.max(0, cyclePurchases - cashAdvancePurchases);
        const priorUnpaid = Math.max(0, totalOutstanding - cyclePurchases);
        const carriedCashAdvance = Math.min(priorUnpaid, priorCashAdvances);
        const carriedRegularPurchases = Math.max(0, priorUnpaid - carriedCashAdvance);
        const isGracePeriodActive = carriedRegularPurchases <= 0.01;

        const cycleDays = Math.max(28, Math.min(31, Math.round((cycleEndMs - cycleStartMs) / (24 * 60 * 60 * 1000))));

        // Cash advances accrue interest immediately with zero grace period
        let carriedCashAdvanceInterest = 0;
        if (carriedCashAdvance > 0 && cashAdvanceDailyRate > 0) {
            carriedCashAdvanceInterest = carriedCashAdvance * cashAdvanceDailyRate * cycleDays;
        }

        let regularInterest = 0;
        if (!isGracePeriodActive && apr > 0) {
            const avgDailyRegularBalance = carriedRegularPurchases + (regularPurchases * 0.5);
            regularInterest = avgDailyRegularBalance * dailyRate * cycleDays;
        }

        let estimatedInterest = cashAdvanceFees + cashAdvanceInterest + carriedCashAdvanceInterest + regularInterest;

        const projectedStatementTotal = Math.max(0, totalOutstanding + estimatedInterest);

        // Projected Minimum Due calculation
        const minFloor = parseFloat(card.minPaymentFloor) || 25;
        const minPercent = (parseFloat(card.minPaymentPercent) || 3.5) / 100;
        let projectedMinDue = 0;
        if (projectedStatementTotal > 0) {
            const percentAmount = (projectedStatementTotal * minPercent) + estimatedInterest;
            projectedMinDue = Math.min(projectedStatementTotal, Math.max(minFloor, percentAmount));
        }

        // Credit Utilization Rate
        const limit = parseFloat(card.creditLimit) || 5000;
        const utilizationRate = limit > 0 ? (totalOutstanding / limit) * 100 : 0;
        const utilizationClamped = Math.min(100, Math.max(0, utilizationRate));

        // Health Zone
        let healthStatus = 'optimal'; // < 30%
        let healthLabel = 'Optimal (<30%)';
        let healthColor = 'var(--success)';
        if (utilizationRate > 50) {
            healthStatus = 'high';
            healthLabel = 'High Utilization (>50%)';
            healthColor = 'var(--danger)';
        } else if (utilizationRate >= 30) {
            healthStatus = 'moderate';
            healthLabel = 'Moderate (30%-50%)';
            healthColor = 'var(--warning)';
        }

        // Safe Spend remaining before reaching 30%
        const safeSpendRemaining = Math.max(0, (limit * 0.30) - totalOutstanding);

        // Payment required to get to 30%
        const payToReach30 = Math.max(0, totalOutstanding - (limit * 0.30));

        return {
            totalOutstanding,
            limit,
            cyclePurchases,
            cyclePayments,
            cashAdvancePurchases,
            cashAdvanceInterest,
            cashAdvanceFees,
            cashAdvanceFeePercent: cashAdvanceFeeRate * 100,
            cashAdvanceApr,
            priorUnpaid,
            isGracePeriodActive,
            estimatedInterest,
            projectedStatementTotal,
            projectedMinDue,
            utilizationRate,
            utilizationClamped,
            healthStatus,
            healthLabel,
            healthColor,
            safeSpendRemaining,
            payToReach30,
            cycle,
            cardTransactions: cardTransactions.sort((a, b) => new Date(b.date) - new Date(a.date))
        };
    },

    getAggregateMetrics: (refDate = new Date()) => {
        const cards = CreditCardManager.getCreditCards();
        let totalLimit = 0;
        let totalOutstanding = 0;
        let totalProjectedBills = 0;
        let totalEstimatedInterest = 0;

        const cardDetails = cards.map(card => {
            const metrics = CreditCardManager.getCardMetrics(card, refDate);
            totalLimit += metrics.limit;
            totalOutstanding += metrics.totalOutstanding;
            totalProjectedBills += metrics.projectedStatementTotal;
            totalEstimatedInterest += metrics.estimatedInterest;
            return { card, metrics };
        });

        const overallUtilization = totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;

        return {
            totalLimit,
            totalOutstanding,
            totalProjectedBills,
            totalEstimatedInterest,
            overallUtilization,
            cardCount: cards.length,
            cardDetails
        };
    },

    recordCardPayment: ({ fromAccountId, cardId, amount, date, note }) => {
        const card = CreditCardManager.getCreditCardById(cardId);
        if (!card) return false;

        const payAmount = Math.abs(parseFloat(amount));
        if (isNaN(payAmount) || payAmount <= 0) return false;

        const txDate = date || DataManager.getLocalDateString();
        const baseDescription = `Payment to ${card.name} (···${card.last4})`;
        const description = note ? `${baseDescription} (${note})` : baseDescription;

        const paymentTx = {
            date: txDate,
            merchant: description,
            category: 'Credit Card',
            amount: -payAmount,
            accountId: parseInt(fromAccountId),
            toAccountId: card.accountId,
            targetCardId: card.id,
            status: 'Completed'
        };

        DataManager.addTransaction(paymentTx);
        return true;
    }
};

DataManager.CreditCardManager = CreditCardManager;
if (typeof window !== 'undefined') {
    window.CreditCardManager = CreditCardManager;
}

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

// One-time migration to trim all transaction categories
if (!appData?.migratedTrimCategories) {
    if (appData && appData.transactions) {
        appData.transactions.forEach(t => {
            if (t.category) {
                t.category = t.category.trim();
                if (t.category === '') t.category = 'Uncategorized';
            }
        });
    }
    if (appData) {
        appData.migratedTrimCategories = true;

        // Wait a tick for DataManager to be fully initialized before calling save
        setTimeout(() => {
            if (typeof DataManager !== 'undefined') {
                DataManager.saveData();
            }
        }, 100);
    }
}
