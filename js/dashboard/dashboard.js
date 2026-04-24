Views.dashboard = () => {
    const netWorth = DataManager.getNetWorth();
    const moneyInHand = DataManager.getMoneyInHand();
    const income = DataManager.getMonthlyIncome();
    const expenses = DataManager.getMonthlyExpenses();
    const recentTransactions = DataManager.getDashboardTransactions(5);
    const trends = DataManager.getTrendStats();

    const regularTxHTML = recentTransactions.length > 0 ? Components.transactionTable(recentTransactions) : Components.emptyState('receipt_long', 'No transactions yet', 'Your recent transactions will appear here once you add them.');

    const loanTxHTML = (() => {
        const loans = DataManager.getLoans();
        const personGroups = {};
        loans.forEach(l => {
            if (l.status === 'settled') return;
            const key = l.person.toLowerCase();
            if (!personGroups[key]) {
                personGroups[key] = { name: l.person, netBalance: 0 };
            }
            personGroups[key].netBalance += (l.type === 'given' ? (l.amount - l.settledAmount) : -(l.amount - l.settledAmount));
        });
        const persons = Object.values(personGroups).sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
        if (persons.length === 0) return Components.emptyState('handshake', 'No active loans', 'Your active loans will appear here.');
        return `<div style="display: flex; flex-direction: column; gap: 0;">
            ${persons.map(p => {
                const isLoaned = p.netBalance > 0;
                const color = isLoaned ? 'var(--warning)' : 'var(--accent)';
                const label = isLoaned ? 'Loaned' : 'Borrowed';
                return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid var(--border-light);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: var(--radius-full); background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 15px; color: ${color};">${p.name.charAt(0).toUpperCase()}</div>
                        <span style="font-weight: 500;">${p.name}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: ${color};">${DataManager.formatCurrency(Math.abs(p.netBalance))}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${label}</div>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    })();

    setTimeout(() => {
        if (!document.getElementById('main-dashboard-chart')) return;
        
        const ctx = document.getElementById('main-dashboard-chart').getContext('2d');
        let currentType = 'expense';
        let currentMonths = 1;
        let chartInstance = null;
        let isDateFiltered = false;

        const allDashboardTxs = DataManager.getDashboardTransactions();

        const restoreDashboardTx = () => {
            isDateFiltered = false;
            const container = document.getElementById('dashboard-tx-container');
            if (container) container.innerHTML = regularTxHTML;
        };
        
        const renderChart = () => {
            isDateFiltered = false;
            const container = document.getElementById('dashboard-tx-container');
            if (container) container.innerHTML = regularTxHTML;

            const chartData = DataManager.getChartData(currentType, currentMonths);
            
            const textColor = '#9ca3af';
            const gridColor = 'rgba(255, 255, 255, 0.05)';
            
            let lineColor, bgColor;
            if (currentType === 'expense') { lineColor = '#ef4444'; bgColor = 'rgba(239, 68, 68, 0.1)'; }
            else if (currentType === 'income') { lineColor = '#10b981'; bgColor = 'rgba(16, 185, 129, 0.1)'; }
            else if (currentType === 'moneyinhand') { lineColor = '#f59e0b'; bgColor = 'rgba(245, 158, 11, 0.1)'; }
            else { lineColor = '#6366f1'; bgColor = 'rgba(99, 102, 241, 0.1)'; }

            if (chartInstance) {
                chartInstance.destroy();
            }

            let chartLabel = currentType.charAt(0).toUpperCase() + currentType.slice(1);
            if (currentType === 'networth') chartLabel = 'Net Worth';
            if (currentType === 'moneyinhand') chartLabel = 'Money in Hand';

            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: chartLabel,
                        data: chartData.data,
                        borderColor: lineColor,
                        backgroundColor: bgColor,
                        borderWidth: 2,
                        pointBackgroundColor: lineColor,
                        pointRadius: chartData.data.length > 45 ? 0 : 3,
                        pointHitRadius: 10,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const clickedLabel = chart.data.labels[elements[0].index];
                            const filtered = allDashboardTxs.filter(t =>
                                new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) === clickedLabel
                            );
                            const txContainer = document.getElementById('dashboard-tx-container');
                            if (txContainer) {
                                isDateFiltered = true;
                                txContainer.innerHTML = filtered.length > 0
                                    ? Components.transactionTable(filtered)
                                    : Components.emptyState('receipt_long', 'No transactions', `No transactions on ${clickedLabel}.`);
                            }
                        } else {
                            restoreDashboardTx();
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return DataManager.formatCurrency(context.raw);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                callback: function(value) {
                                    if (value >= 1000 || value <= -1000) return (value / 1000).toFixed(1) + 'k';
                                    return value;
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { 
                                color: textColor,
                                maxTicksLimit: 8,
                                maxRotation: 0
                            }
                        }
                    }
                }
            });
        };

        if (typeof Chart !== 'undefined') {
            renderChart();
        } else {
            // Retry once if CDN is slow
            setTimeout(renderChart, 500);
        }

        const onDocClick = (e) => {
            const canvas = document.getElementById('main-dashboard-chart');
            if (!canvas) {
                document.removeEventListener('click', onDocClick);
                return;
            }
            if (!canvas.contains(e.target) && isDateFiltered) {
                restoreDashboardTx();
            }
        };
        document.addEventListener('click', onDocClick);

        // Bind events
        document.querySelectorAll('.chart-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-tab').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                });
                e.target.style.background = 'var(--primary)';
                e.target.style.color = 'white';
                currentType = e.target.getAttribute('data-type');
                renderChart();
            });
        });

        document.getElementById('chart-months-slider').addEventListener('input', (e) => {
            currentMonths = parseInt(e.target.value);
            document.getElementById('chart-months-label').textContent = currentMonths + (currentMonths === 1 ? ' Mo' : ' Mos');
            renderChart();
        });

        document.querySelectorAll('.dashboard-tx-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.dashboard-tx-tab').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                });
                
                const target = e.currentTarget;
                target.style.background = 'var(--primary)';
                target.style.color = 'white';
                
                const type = target.getAttribute('data-type');
                const container = document.getElementById('dashboard-tx-container');
                if (type === 'regular') {
                    container.innerHTML = regularTxHTML;
                } else {
                    container.innerHTML = loanTxHTML;
                }
            });
        });

    }, 100);

    return `
        <div class="dashboard-grid">
            <!-- Stats Row -->
            <div class="col-span-3" style="animation-delay: 0.1s;">
                ${Components.statCard('Net Worth', DataManager.formatCurrency(netWorth), trends.netWorth, 'account_balance_wallet', 'primary')}
            </div>
            <div class="col-span-3" style="animation-delay: 0.15s;">
                ${Components.statCard('Money in Hand', DataManager.formatCurrency(moneyInHand), trends.moneyInHand, 'payments', 'success')}
            </div>
            <div class="col-span-3" style="animation-delay: 0.2s;">
                ${Components.statCard('Monthly Income', DataManager.formatCurrency(income), trends.income, 'arrow_downward', 'success')}
            </div>
            <div class="col-span-3" style="animation-delay: 0.3s;">
                ${Components.statCard('Monthly Expenses', DataManager.formatCurrency(expenses), trends.expense, 'arrow_upward', 'danger')}
            </div>

            <!-- Chart Row -->
            <div class="col-span-12 animate-slide-up" style="animation-delay: 0.35s;">
                <div class="card">
                    <div class="card-header" style="flex-wrap: wrap; gap: 16px;">
                        <h3 class="card-title">Financial Trends</h3>
                        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                            <div style="display: flex; gap: 4px; background: var(--bg-surface-solid); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                                <button class="btn chart-tab active" data-type="expense" style="padding: 6px 16px; border: none; background: var(--primary); color: white; border-radius: var(--radius-md);">Expense</button>
                                <button class="btn chart-tab" data-type="income" style="padding: 6px 16px; border: none; background: transparent; color: var(--text-secondary); border-radius: var(--radius-md);">Income</button>
                                <button class="btn chart-tab" data-type="networth" style="padding: 6px 16px; border: none; background: transparent; color: var(--text-secondary); border-radius: var(--radius-md);">Net Worth</button>
                                <button class="btn chart-tab" data-type="moneyinhand" style="padding: 6px 16px; border: none; background: transparent; color: var(--text-secondary); border-radius: var(--radius-md);">Money in Hand</button>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; background: var(--bg-surface-solid); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                                <span class="material-icons-round text-secondary" style="font-size: 18px;">date_range</span>
                                <input type="range" id="chart-months-slider" min="1" max="6" value="1" style="width: 100px; accent-color: var(--primary);">
                                <span id="chart-months-label" style="font-weight: 600; width: 45px; text-align: right;">1 Mo</span>
                            </div>
                        </div>
                    </div>
                    <div class="chart-container" style="height: 300px; width: 100%; position: relative;">
                        <canvas id="main-dashboard-chart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Main Content Row -->
            <div class="col-span-8 animate-slide-up" style="animation-delay: 0.4s;">
                <div class="card" style="height: 100%;">
                    <div class="card-header" style="flex-wrap: wrap; gap: 16px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <h3 class="card-title">Recent Transactions</h3>
                            <div style="display: flex; gap: 8px; margin-top: 4px; background: var(--bg-surface-solid); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border); width: fit-content;">
                                <button class="dashboard-tx-tab" data-type="regular" style="padding: 4px 12px; border: none; background: var(--primary); color: white; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer;">Regular</button>
                                <button class="dashboard-tx-tab" data-type="loans" style="padding: 4px 12px; border: none; background: transparent; color: var(--text-secondary); border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer;">Loans</button>
                            </div>
                        </div>
                        <button class="btn btn-secondary" onclick="app.navigate('transactions')">View All</button>
                    </div>
                    <div id="dashboard-tx-container">
                        ${regularTxHTML}
                    </div>
                </div>
            </div>

            <!-- Side Content Row -->
            <div class="col-span-4 grid-cols-1 animate-slide-up" style="animation-delay: 0.5s; align-content: start;">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Your Accounts</h3>
                        <span class="material-icons-round card-action" onclick="app.navigate('accounts')">arrow_forward</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${appData.accounts.slice(0, 3).map(acc => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--border-light);">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 10px; height: 10px; border-radius: var(--radius-full); background: ${acc.color}; box-shadow: 0 0 8px ${acc.color}80;"></div>
                                    <div>
                                        <div style="font-weight: 500;">${acc.name}</div>
                                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${acc.type}</div>
                                    </div>
                                </div>
                                <div style="font-weight: 600;">${DataManager.formatCurrency(acc.balance)}</div>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-secondary" style="width: 100%; margin-top: 16px;" onclick="app.navigate('accounts')">Manage Accounts</button>
                </div>
            </div>
        </div>
    `;
};
