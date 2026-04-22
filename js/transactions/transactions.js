Views.transactions = () => {
    const regularTxs = DataManager.getRegularTransactions();
    const loanTxs = DataManager.getLoanTransactions();

    const regularHTML = regularTxs.length > 0 ? Components.transactionTable(regularTxs) : Components.emptyState('receipt_long', 'No transactions yet', 'Start adding your income and expenses to track your finances.');
    const loanHTML = loanTxs.length > 0 ? Components.transactionTable(loanTxs) : Components.emptyState('handshake', 'No loan entries yet', 'Your borrow and lend history will appear here.');

    setTimeout(() => {
        // Tab switching
        document.querySelectorAll('.tx-page-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tx-page-tab').forEach(b => {
                    b.classList.remove('active-tab');
                    b.style.color = 'var(--text-secondary)';
                    b.style.borderBottom = 'none';
                });
                
                const target = e.currentTarget;
                target.classList.add('active-tab');
                target.style.color = 'var(--primary)';
                target.style.borderBottom = '2px solid var(--primary)';
                
                const type = target.getAttribute('data-type');
                const container = document.getElementById('transactions-page-container');
                if (type === 'regular') {
                    container.innerHTML = regularHTML;
                } else {
                    container.innerHTML = loanHTML;
                }
            });
        });

        // Category Chart Logic
        if (!document.getElementById('category-chart-canvas')) return;
        
        let currentType = 'expense'; // 'expense' or 'income'
        let currentCategory = '';
        let currentMonths = 1;
        let chartInstance = null;
        
        const renderCategoryChart = () => {
            const ctx = document.getElementById('category-chart-canvas').getContext('2d');
            
            const now = new Date();
            now.setHours(23, 59, 59, 999);
            const startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - currentMonths);
            startDate.setHours(0, 0, 0, 0);
            
            const dataToUse = regularTxs.filter(t => {
                if (new Date(t.date) < startDate) return false;
                return currentType === 'expense' ? t.amount < 0 : t.amount > 0;
            });
            
            // Get unique categories for this type that have data
            const categories = [...new Set(dataToUse.map(t => t.category))].filter(c => c);
            
            // Populate category select if empty
            const catSelect = document.getElementById('cat-chart-select');
            if (catSelect.children.length === 0 || catSelect.dataset.renderedType !== currentType) {
                catSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
                if (categories.length > 0) {
                    currentCategory = categories[0];
                } else {
                    currentCategory = '';
                    catSelect.innerHTML = '<option value="">No data</option>';
                }
                catSelect.dataset.renderedType = currentType;
            } else {
                currentCategory = catSelect.value;
            }
            
            let chartLabels = [];
            let chartDataPoints = [];
            let totalAmount = 0;
            
            if (currentCategory) {
                // Group by date for the selected category
                const catTxs = dataToUse.filter(t => t.category === currentCategory).sort((a,b) => new Date(a.date) - new Date(b.date));
                const grouped = {};
                catTxs.forEach(t => {
                    const amt = Math.abs(t.amount);
                    totalAmount += amt;
                    const d = new Date(t.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
                    grouped[d] = (grouped[d] || 0) + amt;
                });
                
                chartLabels = Object.keys(grouped);
                chartDataPoints = Object.values(grouped);
            }
            
            document.getElementById('cat-total-amount').textContent = currentCategory ? DataManager.formatCurrency(totalAmount) : '$0.00';
            
            if (chartInstance) chartInstance.destroy();
            
            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: currentCategory,
                        data: chartDataPoints,
                        borderColor: currentType === 'expense' ? '#ef4444' : '#10b981',
                        backgroundColor: currentType === 'expense' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        pointBackgroundColor: currentType === 'expense' ? '#ef4444' : '#10b981',
                        fill: true,
                        tension: 0.2
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
                        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
                        x: { grid: { display: false }, ticks: { color: '#9ca3af', maxTicksLimit: 6 } }
                    }
                }
            });
        };

        if (typeof Chart !== 'undefined') {
            renderCategoryChart();
        }
        
        document.querySelectorAll('.cat-type-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.cat-type-tab').forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-secondary');
                });
                const target = e.currentTarget;
                target.classList.remove('btn-secondary');
                target.classList.add('btn-primary');
                
                currentType = target.getAttribute('data-type');
                renderCategoryChart();
            });
        });
        
        document.getElementById('cat-chart-select').addEventListener('change', (e) => {
            currentCategory = e.target.value;
            renderCategoryChart();
        });

        document.getElementById('tx-chart-months-slider').addEventListener('input', (e) => {
            currentMonths = parseInt(e.target.value);
            document.getElementById('tx-chart-months-label').textContent = currentMonths + (currentMonths === 1 ? ' Mo' : ' Mos');
            renderCategoryChart();
        });

    }, 50);

    return `
        <div class="card animate-slide-up" style="margin-bottom: 24px;">
            <div class="card-header" style="flex-wrap: wrap; gap: 16px;">
                <div>
                    <h3 class="card-title">Category Insights</h3>
                    <p style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">Analyze trends and totals for specific categories</p>
                </div>
                <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary cat-type-tab" data-type="expense">Expense</button>
                        <button class="btn btn-secondary cat-type-tab" data-type="income">Income</button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; background: var(--bg-surface-solid); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <span class="material-icons-round text-secondary" style="font-size: 18px;">date_range</span>
                        <input type="range" id="tx-chart-months-slider" min="1" max="6" value="1" style="width: 100px; accent-color: var(--primary);">
                        <span id="tx-chart-months-label" style="font-weight: 600; width: 45px; text-align: right;">1 Mo</span>
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: start; margin-top: 16px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="margin-bottom: 12px; color: var(--text-secondary); font-size: 14px;">Select Category</div>
                    <select id="cat-chart-select" class="form-input" style="width: 100%; appearance: auto; background-color: var(--bg-surface-solid); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 12px; color: var(--text-primary); outline: none;">
                    </select>
                    
                    <div style="margin-top: 24px;">
                        <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 4px;">Total Amount</div>
                        <div id="cat-total-amount" style="font-size: 28px; font-weight: 700;">$0.00</div>
                    </div>
                </div>
                <div style="flex: 3; min-width: 300px; height: 200px; position: relative;">
                    <canvas id="category-chart-canvas"></canvas>
                </div>
            </div>
        </div>

        <div class="card animate-slide-up">
            <div class="card-header" style="flex-direction: column; align-items: flex-start; gap: 16px;">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <h3 class="card-title">All Transactions</h3>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-secondary"><span class="material-icons-round" style="font-size: 18px;">filter_list</span> Filter</button>
                        <button class="btn btn-secondary"><span class="material-icons-round" style="font-size: 18px;">download</span> Export</button>
                    </div>
                </div>
                
                <div class="tabs" style="display: flex; gap: 24px; border-bottom: 1px solid var(--border-light); width: 100%;">
                    <button class="tx-page-tab active-tab" data-type="regular" style="border: none; background: transparent; padding: 8px 4px; color: var(--primary); font-weight: 500; cursor: pointer; border-bottom: 2px solid var(--primary); font-size: 15px;">Regular Transactions</button>
                    <button class="tx-page-tab" data-type="loans" style="border: none; background: transparent; padding: 8px 4px; color: var(--text-secondary); font-weight: 500; cursor: pointer; font-size: 15px;">Loan Entries</button>
                </div>
            </div>
            <div id="transactions-page-container">
                ${regularHTML}
            </div>
        </div>
    `;
};
