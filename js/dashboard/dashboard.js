Views.dashboard = () => {
    const netWorth = DataManager.getNetWorth();
    const income = DataManager.getMonthlyIncome();
    const expenses = DataManager.getMonthlyExpenses();
    const recentTransactions = DataManager.getTransactions(5);
    const trends = DataManager.getTrendStats();

    setTimeout(() => {
        if (!document.getElementById('main-dashboard-chart')) return;
        
        const ctx = document.getElementById('main-dashboard-chart').getContext('2d');
        let currentType = 'expense';
        let currentMonths = 6;
        let chartInstance = null;
        
        const renderChart = () => {
            const chartData = DataManager.getChartData(currentType, currentMonths);
            
            const textColor = '#9ca3af';
            const gridColor = 'rgba(255, 255, 255, 0.05)';
            
            let lineColor, bgColor;
            if (currentType === 'expense') { lineColor = '#ef4444'; bgColor = 'rgba(239, 68, 68, 0.1)'; }
            else if (currentType === 'income') { lineColor = '#10b981'; bgColor = 'rgba(16, 185, 129, 0.1)'; }
            else { lineColor = '#6366f1'; bgColor = 'rgba(99, 102, 241, 0.1)'; }

            if (chartInstance) {
                chartInstance.destroy();
            }

            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: currentType === 'networth' ? 'Net Worth' : currentType.charAt(0).toUpperCase() + currentType.slice(1),
                        data: chartData.data,
                        borderColor: lineColor,
                        backgroundColor: bgColor,
                        borderWidth: 2,
                        pointBackgroundColor: lineColor,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
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
                            ticks: { color: textColor }
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

    }, 100);

    return `
        <div class="dashboard-grid">
            <!-- Stats Row -->
            <div class="col-span-4" style="animation-delay: 0.1s;">
                ${Components.statCard('Net Worth', DataManager.formatCurrency(netWorth), trends.netWorth, 'account_balance_wallet', 'primary')}
            </div>
            <div class="col-span-4" style="animation-delay: 0.2s;">
                ${Components.statCard('Monthly Income', DataManager.formatCurrency(income), trends.income, 'arrow_downward', 'success')}
            </div>
            <div class="col-span-4" style="animation-delay: 0.3s;">
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
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; background: var(--bg-surface-solid); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                                <span class="material-icons-round text-secondary" style="font-size: 18px;">date_range</span>
                                <input type="range" id="chart-months-slider" min="1" max="6" value="6" style="width: 100px; accent-color: var(--primary);">
                                <span id="chart-months-label" style="font-weight: 600; width: 45px; text-align: right;">6 Mos</span>
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
                    <div class="card-header">
                        <h3 class="card-title">Recent Transactions</h3>
                        <button class="btn btn-secondary" onclick="app.navigate('transactions')">View All</button>
                    </div>
                    ${recentTransactions.length > 0 ? Components.transactionTable(recentTransactions) : Components.emptyState('receipt_long', 'No transactions yet', 'Your recent transactions will appear here once you add them.')}
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
