let _transactionsDocClickHandler = null;

Views.transactions = () => {
    const regularTxs = DataManager.getRegularTransactions();

    const regularHTML = regularTxs.length > 0 ? Components.transactionTable(regularTxs) : Components.emptyState('receipt_long', 'No transactions yet', 'Start adding your income and expenses to track your finances.');

    setTimeout(() => {
        if (!document.getElementById('tx-cashflow-chart-canvas')) return;

        let currentMonths = 1;
        let chartInstance = null;
        let isDateFiltered = false;
        let currentChartType = 'net'; // 'net' | 'income' | 'expense'
        let currentViewMode = 'daily'; // 'daily' | 'monthly'
        const txNow = new Date();
        let currentMonthlyMonth = txNow.getMonth();
        let currentMonthlyYear = txNow.getFullYear();

        let currentCategory = 'all';
        let currentDateFilterLabel = null;

        const renderTransactionsTable = () => {
            const container = document.getElementById('transactions-page-container');
            if (!container) return;

            let txsToRender = regularTxs;

            // Apply date filter if active
            if (isDateFiltered && currentDateFilterLabel) {
                txsToRender = txsToRender.filter(t =>
                    new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) === currentDateFilterLabel
                );
                if (currentChartType === 'income') txsToRender = txsToRender.filter(t => t.amount > 0);
                if (currentChartType === 'expense') txsToRender = txsToRender.filter(t => t.amount < 0);
            }

            // Apply category filter
            if (currentCategory !== 'all') {
                txsToRender = txsToRender.filter(t => t.category === currentCategory);
            }

            let emptyMessage = 'No transactions found';
            let emptySubMessage = 'No transactions match the selected filter.';
            if (isDateFiltered) {
                emptyMessage = 'No transactions';
                emptySubMessage = 'No transactions on ' + currentDateFilterLabel + (currentCategory !== 'all' ? ' matching the category filter.' : '.');
            }

            container.innerHTML = txsToRender.length > 0
                ? Components.transactionTable(txsToRender)
                : Components.emptyState('receipt_long', emptyMessage, emptySubMessage);
        };

        const restoreTransactionView = () => {
            isDateFiltered = false;
            currentDateFilterLabel = null;
            renderTransactionsTable();
        };

        const updateTxViewModeUI = () => {
            const sliderContainer = document.getElementById('tx-chart-slider-container');
            const monthPicker = document.getElementById('tx-chart-month-picker');
            const titleEl = document.getElementById('tx-chart-title');
            if (currentViewMode === 'monthly') {
                if (titleEl) titleEl.textContent = 'Monthly Cashflow';
                if (sliderContainer) sliderContainer.style.display = 'none';
                if (monthPicker) {
                    monthPicker.style.display = 'flex';
                    const yearSelect = document.getElementById('tx-chart-year-select');
                    if (yearSelect && yearSelect.dataset.populated !== 'true') {
                        const years = DataManager.getTransactionYears();
                        yearSelect.innerHTML = years.map(y => `<option value="${y}"${y === currentMonthlyYear ? ' selected' : ''}>${y}</option>`).join('');
                        yearSelect.dataset.populated = 'true';
                    }
                    const monthSelect = document.getElementById('tx-chart-month-select');
                    if (monthSelect) monthSelect.value = currentMonthlyMonth;
                    const yearSelectEl = document.getElementById('tx-chart-year-select');
                    if (yearSelectEl) yearSelectEl.value = currentMonthlyYear;
                }
            } else {
                if (titleEl) titleEl.textContent = 'Daily Cashflow';
                if (sliderContainer) sliderContainer.style.display = 'flex';
                if (monthPicker) monthPicker.style.display = 'none';
            }
        };

        const renderChart = () => {
            isDateFiltered = false;
            const ctx = document.getElementById('tx-cashflow-chart-canvas').getContext('2d');

            let labels, data, chartColor, chartBorderColor, statLabel, statColor;

            if (currentChartType === 'net') {
                // Group all transactions by day, summing net
                let filteredTxs;
                if (currentViewMode === 'monthly') {
                    const startDate = new Date(currentMonthlyYear, currentMonthlyMonth, 1);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(currentMonthlyYear, currentMonthlyMonth + 1, 0);
                    endDate.setHours(23, 59, 59, 999);
                    filteredTxs = regularTxs.filter(t => {
                        const d = new Date(t.date);
                        return d >= startDate && d <= endDate;
                    });
                } else {
                    const now = new Date();
                    now.setHours(23, 59, 59, 999);
                    const startDate = new Date(now);
                    startDate.setMonth(startDate.getMonth() - currentMonths);
                    startDate.setHours(0, 0, 0, 0);
                    filteredTxs = regularTxs.filter(t => new Date(t.date) >= startDate);
                }
                const grouped = {};
                filteredTxs
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .forEach(t => {
                        const d = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        grouped[d] = (grouped[d] || 0) + t.amount;
                    });
                labels = Object.keys(grouped);
                data = Object.values(grouped);
                const totalNet = data.reduce((a, b) => a + b, 0);
                statLabel = totalNet >= 0 ? 'Net Gain' : 'Net Loss';
                statColor = totalNet >= 0 ? 'var(--success)' : 'var(--danger)';
                chartColor = data.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)');
                chartBorderColor = data.map(v => v >= 0 ? '#10b981' : '#ef4444');
                const statAmountEl = document.getElementById('tx-stat-amount');
                const statLabelEl = document.getElementById('tx-stat-label');
                if (statLabelEl) statLabelEl.textContent = statLabel;
                if (statAmountEl) { statAmountEl.textContent = DataManager.formatCurrency(Math.abs(totalNet)); statAmountEl.style.color = statColor; }
                const legendEl = document.getElementById('tx-chart-legend');
                if (legendEl) legendEl.style.display = 'flex';
            } else {
                // Use DataManager for income/expense data
                const chartData = currentViewMode === 'monthly'
                    ? DataManager.getDailyChartDataForMonth(currentChartType, currentMonthlyYear, currentMonthlyMonth)
                    : DataManager.getChartData(currentChartType, currentMonths);
                labels = chartData.labels;
                data = chartData.data;
                const total = data.reduce((a, b) => a + b, 0);
                if (currentChartType === 'income') {
                    statLabel = 'Total Income';
                    statColor = 'var(--success)';
                    chartColor = 'rgba(16, 185, 129, 0.7)';
                    chartBorderColor = '#10b981';
                } else {
                    statLabel = 'Total Expenses';
                    statColor = 'var(--danger)';
                    chartColor = 'rgba(239, 68, 68, 0.7)';
                    chartBorderColor = '#ef4444';
                }
                const statAmountEl = document.getElementById('tx-stat-amount');
                const statLabelEl = document.getElementById('tx-stat-label');
                if (statLabelEl) statLabelEl.textContent = statLabel;
                if (statAmountEl) { statAmountEl.textContent = DataManager.formatCurrency(total); statAmountEl.style.color = statColor; }
                const legendEl = document.getElementById('tx-chart-legend');
                if (legendEl) legendEl.style.display = 'none';
            }

            // Reset table
            renderTransactionsTable();

            if (chartInstance) chartInstance.destroy();

            const onChartClick = (event, elements, chart) => {
                if (elements.length > 0) {
                    currentDateFilterLabel = chart.data.labels[elements[0].index];
                    isDateFiltered = true;
                    renderTransactionsTable();
                } else {
                    restoreTransactionView();
                }
            };

            const tickCallback = function(value) {
                if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'k';
                return value;
            };

            if (currentChartType === 'net') {
                chartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Net',
                            data,
                            backgroundColor: chartColor,
                            borderColor: chartBorderColor,
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        onClick: onChartClick,
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
                                ticks: { color: '#9ca3af', callback: tickCallback }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: '#9ca3af', maxTicksLimit: 8, maxRotation: 0 }
                            }
                        }
                    }
                });
            } else {
                // Income/Expense — filled line chart matching dashboard style
                chartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: currentChartType === 'income' ? 'Income' : 'Expense',
                            data,
                            borderColor: chartBorderColor,
                            backgroundColor: currentChartType === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            borderWidth: 2,
                            pointBackgroundColor: chartBorderColor,
                            pointRadius: data.length > 45 ? 0 : 3,
                            pointHitRadius: 10,
                            pointHoverRadius: 6,
                            fill: true,
                            tension: 0.2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        onClick: onChartClick,
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
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: '#9ca3af', callback: tickCallback }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: '#9ca3af', maxTicksLimit: 8, maxRotation: 0 }
                            }
                        }
                    }
                });
            }
        };

        if (typeof Chart !== 'undefined') {
            renderChart();
            updateTxViewModeUI();
        }

        const onDocClick = (e) => {
            const canvas = document.getElementById('tx-cashflow-chart-canvas');
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

        document.querySelectorAll('.tx-chart-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tx-chart-tab').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                });
                e.currentTarget.style.background = 'var(--primary)';
                e.currentTarget.style.color = 'white';
                currentChartType = e.currentTarget.getAttribute('data-type');
                renderChart();
            });
        });

        document.querySelectorAll('.tx-chart-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tx-chart-mode-btn').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                });
                e.currentTarget.style.background = 'var(--primary)';
                e.currentTarget.style.color = 'white';
                currentViewMode = e.currentTarget.getAttribute('data-mode');
                updateTxViewModeUI();
                renderChart();
            });
        });

        document.getElementById('tx-chart-months-slider').addEventListener('input', (e) => {
            currentMonths = parseInt(e.target.value);
            document.getElementById('tx-chart-months-label').textContent = currentMonths + (currentMonths === 1 ? ' Mo' : ' Mos');
            renderChart();
        });

        const txMonthSelectEl = document.getElementById('tx-chart-month-select');
        if (txMonthSelectEl) {
            txMonthSelectEl.addEventListener('change', (e) => {
                currentMonthlyMonth = parseInt(e.target.value);
                renderChart();
            });
        }

        const txYearSelectEl = document.getElementById('tx-chart-year-select');
        if (txYearSelectEl) {
            txYearSelectEl.addEventListener('change', (e) => {
                currentMonthlyYear = parseInt(e.target.value);
                renderChart();
            });
        }

        const categoryFilter = document.getElementById('tx-category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                currentCategory = e.target.value;
                // renderTransactionsTable will apply both currentCategory and currentDateFilterLabel
                renderTransactionsTable();
            });
        }

    }, 50);

    return `
        <div class="card animate-slide-up" style="margin-bottom: 24px;">
            <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
                <div>
                    <h3 class="card-title" id="tx-chart-title">Daily Cashflow</h3>
                    <p style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">Tap a bar to see that day's transactions</p>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div class="chart-type-tabs" style="display: flex; gap: 4px; background: var(--bg-surface-solid); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <button class="btn tx-chart-tab" data-type="net" style="padding: 6px 14px; border: none; background: var(--primary); color: white; border-radius: var(--radius-md); font-size: 13px;">Net</button>
                        <button class="btn tx-chart-tab" data-type="income" style="padding: 6px 14px; border: none; background: transparent; color: var(--text-secondary); border-radius: var(--radius-md); font-size: 13px;">Income</button>
                        <button class="btn tx-chart-tab" data-type="expense" style="padding: 6px 14px; border: none; background: transparent; color: var(--text-secondary); border-radius: var(--radius-md); font-size: 13px;">Expense</button>
                    </div>
                    <div style="display: flex; gap: 4px; background: var(--bg-surface-solid); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <button class="btn tx-chart-mode-btn" data-mode="daily" style="padding: 5px 12px; border: none; background: var(--primary); color: white; border-radius: var(--radius-md); font-size: 13px;">Daily</button>
                        <button class="btn tx-chart-mode-btn" data-mode="monthly" style="padding: 5px 12px; border: none; background: transparent; color: var(--text-secondary); border-radius: var(--radius-md); font-size: 13px;">Monthly</button>
                    </div>
                    <div id="tx-chart-slider-container" style="display: flex; align-items: center; gap: 8px; font-size: 14px; background: var(--bg-surface-solid); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <span class="material-icons-round text-secondary" style="font-size: 18px;">date_range</span>
                        <input type="range" id="tx-chart-months-slider" min="1" max="6" value="1" style="width: 80px; accent-color: var(--primary);">
                        <span id="tx-chart-months-label" style="font-weight: 600; width: 45px; text-align: right;">1 Mo</span>
                    </div>
                    <div id="tx-chart-month-picker" style="display: none; align-items: center; gap: 8px; font-size: 14px; background: var(--bg-surface-solid); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <span class="material-icons-round text-secondary" style="font-size: 18px;">calendar_month</span>
                        <select id="tx-chart-month-select" style="background: transparent; border: none; color: var(--text-primary); font-size: 13px; outline: none; cursor: pointer;">
                            <option value="0">January</option>
                            <option value="1">February</option>
                            <option value="2">March</option>
                            <option value="3">April</option>
                            <option value="4">May</option>
                            <option value="5">June</option>
                            <option value="6">July</option>
                            <option value="7">August</option>
                            <option value="8">September</option>
                            <option value="9">October</option>
                            <option value="10">November</option>
                            <option value="11">December</option>
                        </select>
                        <select id="tx-chart-year-select" style="background: transparent; border: none; color: var(--text-primary); font-size: 13px; outline: none; cursor: pointer;"></select>
                    </div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 20px; margin-top: 14px; margin-bottom: 10px; flex-wrap: wrap;">
                <div>
                    <div id="tx-stat-label" style="color: var(--text-secondary); font-size: 13px; margin-bottom: 2px;">Net Gain</div>
                    <div id="tx-stat-amount" style="font-size: 22px; font-weight: 700; color: var(--success);">$0.00</div>
                </div>
                <div id="tx-chart-legend" style="display: flex; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
                        <span style="width: 10px; height: 10px; border-radius: 2px; background: #10b981; display: inline-block;"></span>Gained
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
                        <span style="width: 10px; height: 10px; border-radius: 2px; background: #ef4444; display: inline-block;"></span>Lost
                    </div>
                </div>
            </div>
            <div style="height: 200px; position: relative; width: 100%;">
                <canvas id="tx-cashflow-chart-canvas"></canvas>
            </div>
        </div>

        <div class="card animate-slide-up">
            <div class="card-header" style="flex-direction: column; align-items: flex-start; gap: 16px;">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <h3 class="card-title">All Transactions</h3>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <select id="tx-category-filter" aria-label="Filter transactions by category" style="background: var(--bg-surface-solid); border: 1px solid var(--border); color: var(--text-primary); font-size: 13px; padding: 6px 12px; border-radius: var(--radius-md); outline: none; cursor: pointer;">
                            <option value="all">All Categories</option>
                            ${[...new Set(regularTxs.map(t => t.category))].sort().map(c => {
                                const escaped = (c || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                                return `<option value="${escaped}">${escaped}</option>`;
                            }).join('')}
                        </select>
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
