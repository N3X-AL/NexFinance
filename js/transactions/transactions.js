let _transactionsDocClickHandler = null;

Views.transactions = () => {
    const regularTxs = DataManager.getRegularTransactions();

    const regularHTML = regularTxs.length > 0 ? Components.transactionTable(regularTxs) : Components.emptyState('receipt_long', 'No transactions yet', 'Start adding your income and expenses to track your finances.');

    setTimeout(() => {
        if (!document.getElementById('net-cashflow-chart-canvas')) return;

        let currentMonths = 1;
        let chartInstance = null;
        let isDateFiltered = false;

        const restoreTransactionView = () => {
            isDateFiltered = false;
            const container = document.getElementById('transactions-page-container');
            if (container) container.innerHTML = regularHTML;
        };

        const renderNetChart = () => {
            isDateFiltered = false;
            const ctx = document.getElementById('net-cashflow-chart-canvas').getContext('2d');

            const now = new Date();
            now.setHours(23, 59, 59, 999);
            const startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - currentMonths);
            startDate.setHours(0, 0, 0, 0);

            // Group all transactions by day, summing net (income positive, expense negative)
            const grouped = {};
            regularTxs
                .filter(t => new Date(t.date) >= startDate)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .forEach(t => {
                    const d = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    grouped[d] = (grouped[d] || 0) + t.amount;
                });

            const labels = Object.keys(grouped);
            const data = Object.values(grouped);

            // Update summary stat
            const totalNet = data.reduce((a, b) => a + b, 0);
            const netLabel = document.getElementById('net-total-label');
            const netAmount = document.getElementById('net-total-amount');
            if (netLabel) netLabel.textContent = totalNet >= 0 ? 'Net Gain' : 'Net Loss';
            if (netAmount) {
                netAmount.textContent = DataManager.formatCurrency(Math.abs(totalNet));
                netAmount.style.color = totalNet >= 0 ? 'var(--success)' : 'var(--danger)';
            }

            // Reset table
            const container = document.getElementById('transactions-page-container');
            if (container) container.innerHTML = regularHTML;

            if (chartInstance) chartInstance.destroy();

            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Net',
                        data,
                        backgroundColor: data.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                        borderColor: data.map(v => v >= 0 ? '#10b981' : '#ef4444'),
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const clickedLabel = chart.data.labels[elements[0].index];
                            const txsForDay = regularTxs.filter(t =>
                                new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) === clickedLabel
                            );
                            const txContainer = document.getElementById('transactions-page-container');
                            if (txContainer) {
                                isDateFiltered = true;
                                txContainer.innerHTML = txsForDay.length > 0
                                    ? Components.transactionTable(txsForDay)
                                    : Components.emptyState('receipt_long', 'No transactions', 'No transactions on ' + clickedLabel + '.');
                            }
                        } else {
                            restoreTransactionView();
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const val = context.raw;
                                    const sign = val >= 0 ? '+' : '';
                                    return sign + DataManager.formatCurrency(val);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: {
                                color: '#9ca3af',
                                callback: function(value) {
                                    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'k';
                                    return value;
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#9ca3af', maxTicksLimit: 8, maxRotation: 0 }
                        }
                    }
                }
            });
        };

        if (typeof Chart !== 'undefined') {
            renderNetChart();
        }

        const onDocClick = (e) => {
            const canvas = document.getElementById('net-cashflow-chart-canvas');
            if (!canvas) {
                document.removeEventListener('click', _transactionsDocClickHandler);
                _transactionsDocClickHandler = null;
                return;
            }
            if (!canvas.contains(e.target) && isDateFiltered) {
                restoreTransactionView();
            }
        };
        if (_transactionsDocClickHandler) document.removeEventListener('click', _transactionsDocClickHandler);
        _transactionsDocClickHandler = onDocClick;
        document.addEventListener('click', onDocClick);

        document.getElementById('tx-chart-months-slider').addEventListener('input', (e) => {
            currentMonths = parseInt(e.target.value);
            document.getElementById('tx-chart-months-label').textContent = currentMonths + (currentMonths === 1 ? ' Mo' : ' Mos');
            renderNetChart();
        });

    }, 50);

    return `
        <div class="card animate-slide-up" style="margin-bottom: 24px;">
            <div class="card-header" style="flex-wrap: wrap; gap: 16px;">
                <div>
                    <h3 class="card-title">Daily Net Cashflow</h3>
                    <p style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">Net gain or loss per day — tap a bar to see that day's transactions</p>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; background: var(--bg-surface-solid); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                    <span class="material-icons-round text-secondary" style="font-size: 18px;">date_range</span>
                    <input type="range" id="tx-chart-months-slider" min="1" max="6" value="1" style="width: 80px; accent-color: var(--primary);">
                    <span id="tx-chart-months-label" style="font-weight: 600; width: 45px; text-align: right;">1 Mo</span>
                </div>
            </div>
            <div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: center; margin-top: 16px;">
                <div style="min-width: 110px;">
                    <div id="net-total-label" style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Net Gain</div>
                    <div id="net-total-amount" style="font-size: 26px; font-weight: 700; color: var(--success);">$0.00</div>
                    <div style="display: flex; gap: 12px; margin-top: 12px;">
                        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
                            <span style="width: 10px; height: 10px; border-radius: 2px; background: #10b981; display: inline-block;"></span>Gained
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
                            <span style="width: 10px; height: 10px; border-radius: 2px; background: #ef4444; display: inline-block;"></span>Lost
                        </div>
                    </div>
                </div>
                <div style="flex: 1; min-width: 260px; height: 200px; position: relative;">
                    <canvas id="net-cashflow-chart-canvas"></canvas>
                </div>
            </div>
        </div>

        <div class="card animate-slide-up">
            <div class="card-header" style="flex-direction: column; align-items: flex-start; gap: 16px;">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <h3 class="card-title">All Transactions</h3>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-secondary"><span class="material-icons-round" style="font-size: 18px;">download</span> Export</button>
                    </div>
                </div>
            </div>
            <div id="transactions-page-container">
                \${regularHTML}
            </div>
        </div>
    `;
};
