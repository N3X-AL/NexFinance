/**
 * NexFinance - Tax & Compliance Module
 * Pakistan Fiscal Year Expense Reporting & Loan Capital Reconciliation
 * Strictly separates deductible expenses from loan capital movements to prevent tax falsification.
 */

let _taxChartInstance = null;

const TaxManager = {
    /**
     * Compute Pakistan's Fiscal Year (July 1 to June 30)
     */
    getPakistanFiscalYear: (refDate = new Date()) => {
        const d = refDate instanceof Date ? refDate : new Date(refDate);
        const validDate = isNaN(d.getTime()) ? new Date() : d;
        const year = validDate.getFullYear();
        const month = validDate.getMonth(); // 0-indexed: 6 is July

        let startYear, endYear;
        if (month >= 6) {
            // July (6) to December (11): Current calendar year to next calendar year
            startYear = year;
            endYear = year + 1;
        } else {
            // January (0) to June (5): Previous calendar year to current calendar year
            startYear = year - 1;
            endYear = year;
        }

        return {
            startYear,
            endYear,
            taxYear: endYear,
            label: `Tax Year ${endYear} (FY ${startYear}-${String(endYear).slice(2)})`,
            startDate: `${startYear}-07-01`,
            endDate: `${endYear}-06-30`
        };
    },

    getPreviousPakistanFiscalYear: (refDate = new Date()) => {
        const curr = TaxManager.getPakistanFiscalYear(refDate);
        const startYear = curr.startYear - 1;
        const endYear = curr.endYear - 1;
        return {
            startYear,
            endYear,
            taxYear: endYear,
            label: `Tax Year ${endYear} (FY ${startYear}-${String(endYear).slice(2)})`,
            startDate: `${startYear}-07-01`,
            endDate: `${endYear}-06-30`
        };
    },

    /**
     * Determine reference date based on latest transaction date or today
     */
    getReferenceDate: () => {
        const txs = appData.transactions || [];
        if (txs.length === 0) return new Date();
        let maxTime = 0;
        for (const t of txs) {
            const time = new Date(t.date).getTime();
            if (!isNaN(time) && time > maxTime) {
                maxTime = time;
            }
        }
        return maxTime > 0 ? new Date(maxTime) : new Date();
    },

    /**
     * Compute estimated income tax liability according to Pakistan's statutory tax slabs
     * (Finance Act / Tax Year 2025, 2026, 2027)
     */
    calculatePakistanTaxLiability: (taxableIncome, taxpayerType = 'salaried') => {
        const income = Math.max(0, parseFloat(taxableIncome) || 0);
        let annualTax = 0;
        let marginalRate = 0;
        let currentSlab = '';

        if (taxpayerType === 'salaried') {
            // Salaried Individuals (where salary > 75% of taxable income)
            if (income <= 600000) {
                annualTax = 0;
                marginalRate = 0;
                currentSlab = 'Up to PKR 600,000 (0% Exempt)';
            } else if (income <= 1200000) {
                annualTax = (income - 600000) * 0.05;
                marginalRate = 5;
                currentSlab = 'PKR 600,001 – 1,200,000 (5%)';
            } else if (income <= 2200000) {
                annualTax = 30000 + (income - 1200000) * 0.15;
                marginalRate = 15;
                currentSlab = 'PKR 1,200,001 – 2,200,000 (15%)';
            } else if (income <= 3200000) {
                annualTax = 180000 + (income - 2200000) * 0.25;
                marginalRate = 25;
                currentSlab = 'PKR 2,200,001 – 3,200,000 (25%)';
            } else if (income <= 4100000) {
                annualTax = 430000 + (income - 3200000) * 0.30;
                marginalRate = 30;
                currentSlab = 'PKR 3,200,001 – 4,100,000 (30%)';
            } else {
                annualTax = 700000 + (income - 4100000) * 0.35;
                marginalRate = 35;
                currentSlab = 'Above PKR 4,100,000 (35%)';
            }
        } else {
            // Non-Salaried / Business Individuals
            if (income <= 600000) {
                annualTax = 0;
                marginalRate = 0;
                currentSlab = 'Up to PKR 600,000 (0% Exempt)';
            } else if (income <= 1200000) {
                annualTax = (income - 600000) * 0.15;
                marginalRate = 15;
                currentSlab = 'PKR 600,001 – 1,200,000 (15%)';
            } else if (income <= 1600000) {
                annualTax = 90000 + (income - 1200000) * 0.20;
                marginalRate = 20;
                currentSlab = 'PKR 1,200,001 – 1,600,000 (20%)';
            } else if (income <= 3200000) {
                annualTax = 170000 + (income - 1600000) * 0.30;
                marginalRate = 30;
                currentSlab = 'PKR 1,600,001 – 3,200,000 (30%)';
            } else if (income <= 5600000) {
                annualTax = 650000 + (income - 3200000) * 0.40;
                marginalRate = 40;
                currentSlab = 'PKR 3,200,001 – 5,600,000 (40%)';
            } else {
                annualTax = 1610000 + (income - 5600000) * 0.45;
                marginalRate = 45;
                currentSlab = 'Above PKR 5,600,000 (45%)';
            }
        }

        const monthlyTax = annualTax / 12;
        const effectiveRate = income > 0 ? (annualTax / income) * 100 : 0;
        const netTakeHome = income - annualTax;

        return {
            taxableIncome: income,
            taxpayerType,
            annualTax,
            monthlyTax,
            effectiveRate,
            marginalRate,
            currentSlab,
            netTakeHome
        };
    },

    /**
     * Query transactions and loans within a date range and categorize for tax purposes
     */
    getTaxReportData: (startDateStr, endDateStr) => {
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);

        const allTxs = appData.transactions || [];

        // 1. Deductible Expenses (amount < 0, excluding transfers, loans, and investments)
        const deductibleExpenses = [];
        let totalExpenses = 0;

        // 2. Declared Income (amount > 0, excluding transfers and loans)
        const declaredIncomes = [];
        let totalIncome = 0;

        // 3. Category Breakdown for Expenses
        const categoryMap = {};

        // 4. Loan Capital Movements within period
        const loanCapitalMovements = [];
        let totalLoansGiven = 0;
        let totalLoansReceived = 0;
        let totalLoanRecoveries = 0;
        let totalLoanRepaymentsPaid = 0;

        allTxs.forEach(t => {
            const txDateStr = (t.date || '').slice(0, 10);
            if (txDateStr && (txDateStr < startDateStr || txDateStr > endDateStr)) return;

            const isTransfer = t.category === 'Transfer' || !!t.toAccountId;
            const isInvestment = t.category === 'Investment';
            const isLoanTx = t.category === 'Loan' || t.category === 'Loan Settlement';

            if (isTransfer) {
                // Internal account transfer: purely balance sheet, no tax impact
                return;
            }

            if (isLoanTx) {
                // Friendly loan movement (capital asset or liability)
                const merchant = t.merchant || '';
                const isDisbursement = merchant.startsWith('Loan Given:') || merchant.includes('(Lent):');
                const isBorrowing = merchant.startsWith('Loan Received:') || merchant.includes('(Borrowed):');
                const isSettlement = t.category === 'Loan Settlement' || /repayment|settlement/i.test(merchant);

                let treatment = '';
                let note = '';
                const absAmount = Math.abs(t.amount);

                if (isSettlement) {
                    if (t.amount > 0 || merchant.includes('From:')) {
                        treatment = 'Capital Recovery';
                        note = 'Principal recovered from debtor (Non-taxable)';
                        totalLoanRecoveries += absAmount;
                    } else {
                        treatment = 'Liability Discharge';
                        note = 'Debt repayment to creditor (Non-deductible)';
                        totalLoanRepaymentsPaid += absAmount;
                    }
                } else if (isDisbursement || t.amount < 0) {
                    treatment = 'Capital Asset (Debtor)';
                    note = 'Non-deductible loan disbursement';
                    totalLoansGiven += absAmount;
                } else if (isBorrowing || t.amount > 0) {
                    treatment = 'Capital Liability (Creditor)';
                    note = 'Non-taxable borrowed capital (Sec 111)';
                    totalLoansReceived += absAmount;
                } else {
                    treatment = t.amount < 0 ? 'Capital Outflow' : 'Capital Inflow';
                    note = 'Loan-related movement';
                }

                loanCapitalMovements.push({
                    id: t.id,
                    date: t.date,
                    merchant: t.merchant,
                    category: t.category,
                    amount: t.amount,
                    absAmount,
                    accountId: t.accountId,
                    loanId: t.loanId,
                    taxTreatment: treatment,
                    taxNote: note
                });
                return;
            }

            if (isInvestment) {
                // Investment capital asset
                return;
            }

            // Regular Transaction
            if (t.amount < 0) {
                const absVal = Math.abs(t.amount);
                totalExpenses += absVal;
                deductibleExpenses.push({
                    ...t,
                    absAmount: absVal,
                    taxTreatment: 'Allowable Expense',
                    taxNote: 'Deductible living / business outlay'
                });

                const cat = t.category || 'Uncategorized';
                if (!categoryMap[cat]) {
                    categoryMap[cat] = {
                        category: cat,
                        amount: 0,
                        count: 0
                    };
                }
                categoryMap[cat].amount += absVal;
                categoryMap[cat].count += 1;
            } else if (t.amount > 0) {
                totalIncome += t.amount;
                declaredIncomes.push({
                    ...t,
                    absAmount: t.amount,
                    taxTreatment: 'Declared Inflow',
                    taxNote: 'Gross revenue / taxable inflow'
                });
            }
        });

        // Convert category map to sorted array
        const categories = Object.values(categoryMap)
            .map(c => ({
                ...c,
                percentage: totalExpenses > 0 ? (c.amount / totalExpenses) * 100 : 0
            }))
            .sort((a, b) => b.amount - a.amount);

        // Calculate Cash Outflows vs Tax Deductible Expenses (Anti-Falsification Reconciliation)
        const totalCashOutflow = totalExpenses + totalLoansGiven + totalLoanRepaymentsPaid;
        const totalExcludedOutflows = totalLoansGiven + totalLoanRepaymentsPaid;
        const totalCashInflow = totalIncome + totalLoansReceived + totalLoanRecoveries;
        const totalExcludedInflows = totalLoansReceived + totalLoanRecoveries;

        return {
            startDate: startDateStr,
            endDate: endDateStr,
            totalExpenses,
            totalIncome,
            categories,
            deductibleExpenses,
            declaredIncomes,
            loanCapitalMovements,
            totalLoansGiven,
            totalLoansReceived,
            totalLoanRecoveries,
            totalLoanRepaymentsPaid,
            totalCashOutflow,
            totalExcludedOutflows,
            totalCashInflow,
            totalExcludedInflows
        };
    },

    /**
     * Generate and download a formatted CSV report for tax filing
     */
    exportTaxCSV: (reportData, taxpayerType = 'salaried') => {
        const rows = [];
        const curr = appData.currency || 'USD';

        rows.push(['NEXFINANCE TAX & COMPLIANCE REPORT']);
        rows.push(['Reporting Period', `${reportData.startDate} to ${reportData.endDate}`]);
        rows.push(['Generated On', new Date().toLocaleString()]);
        rows.push(['Currency', curr]);
        rows.push([]);

        // Section 1: Executive Tax Summary
        rows.push(['EXECUTIVE TAX SUMMARY']);
        rows.push(['Metric', 'Amount', 'Tax Regulatory Classification']);
        rows.push(['Total Allowable Expenses', reportData.totalExpenses.toFixed(2), 'Tax Deductible (Living/Business Outlays)']);
        rows.push(['Total Declared Inflows/Income', reportData.totalIncome.toFixed(2), 'Taxable / Declared Inflows']);
        rows.push(['Capital Lent (Loans Given)', reportData.totalLoansGiven.toFixed(2), 'Balance Sheet Asset / Debtor (Non-Deductible)']);
        rows.push(['Capital Borrowed (Loans Received)', reportData.totalLoansReceived.toFixed(2), 'Balance Sheet Liability / Creditor (Non-Taxable)']);
        rows.push(['Principal Recoveries Received', reportData.totalLoanRecoveries.toFixed(2), 'Capital Recovery (Non-Taxable)']);
        rows.push(['Debt Repayments Paid', reportData.totalLoanRepaymentsPaid.toFixed(2), 'Liability Discharge (Non-Deductible)']);
        rows.push(['Total Cash Disbursed', reportData.totalCashOutflow.toFixed(2), 'All cash paid out']);
        rows.push(['Excluded Capital Outflows', reportData.totalExcludedOutflows.toFixed(2), 'Disbursements quarantined to prevent tax falsification']);
        rows.push([]);

        // Section 2: Pakistan Tax Liability Estimate
        const taxEst = TaxManager.calculatePakistanTaxLiability(reportData.totalIncome, taxpayerType);
        rows.push(['ESTIMATED PAKISTAN INCOME TAX (STATUTORY SLABS)']);
        rows.push(['Taxpayer Classification', taxpayerType === 'salaried' ? 'Salaried Individual' : 'Business / Non-Salaried']);
        rows.push(['Taxable Income Base', taxEst.taxableIncome.toFixed(2)]);
        rows.push(['Applicable Statutory Slab', `"${taxEst.currentSlab}"`]);
        rows.push(['Estimated Annual Tax Liability', taxEst.annualTax.toFixed(2)]);
        rows.push(['Estimated Monthly Withholding', taxEst.monthlyTax.toFixed(2)]);
        rows.push(['Effective Tax Rate', `${taxEst.effectiveRate.toFixed(2)}%`]);
        rows.push(['Marginal Tax Bracket', `${taxEst.marginalRate}%`]);
        rows.push(['Net Post-Tax Income', taxEst.netTakeHome.toFixed(2)]);
        rows.push([]);

        // Section 3: Expense Breakdown by Category
        rows.push(['EXPENSE BREAKDOWN BY CATEGORY ("WHAT WENT WHERE")']);
        rows.push(['Category', 'Total Amount', 'Percentage of Allowable Expenses', 'Transaction Count']);
        reportData.categories.forEach(c => {
            rows.push([c.category, c.amount.toFixed(2), `${c.percentage.toFixed(2)}%`, c.count]);
        });
        rows.push([]);

        // Section 4: Loan Capital Movements
        rows.push(['LOAN CAPITAL RECONCILIATION (ANTI-FALSIFICATION AUDIT TRAIL)']);
        rows.push(['Date', 'Description / Counterparty', 'Amount', 'Tax Balance Sheet Classification', 'Compliance Audit Note']);
        reportData.loanCapitalMovements.forEach(m => {
            rows.push([m.date, `"${(m.merchant || '').replace(/"/g, '""')}"`, m.absAmount.toFixed(2), m.taxTreatment, m.taxNote]);
        });
        rows.push([]);

        // Section 5: Itemized Deductible Expenses
        rows.push(['ITEMIZED ALLOWABLE EXPENSES']);
        rows.push(['Date', 'Description / Payee', 'Category', 'Account', 'Amount', 'Tax Treatment']);
        reportData.deductibleExpenses.forEach(e => {
            const acc = DataManager.getAccountById(e.accountId);
            const accName = acc ? acc.name : 'Unknown';
            rows.push([e.date, `"${(e.merchant || '').replace(/"/g, '""')}"`, e.category, `"${accName.replace(/"/g, '""')}"`, e.absAmount.toFixed(2), e.taxTreatment]);
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `NexFinance_Tax_Report_${reportData.startDate}_to_${reportData.endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    renderTaxDashboardHTML: (currentReport, taxpayerType = 'salaried', incomeOverride = null, selectedCategory = 'all', selectedAccountId = 'all', searchQuery = '', isExpensesAuditCollapsed = false, isLoanAuditCollapsed = false) => {
        // Compute Tax Liability
        const effectiveIncome = incomeOverride !== null ? incomeOverride : currentReport.totalIncome;
        const taxEst = TaxManager.calculatePakistanTaxLiability(effectiveIncome, taxpayerType);

        // Top Metrics HTML
        const metricsHTML = `
            <div class="dashboard-grid" style="margin-bottom: 24px;">
                <!-- Total Allowable Expenses -->
                <div class="col-span-3 animate-slide-up">
                    <div class="card stat-card" style="height: 100%;">
                        <div class="card-header" style="margin-bottom: 0;">
                            <h3 class="card-title text-secondary">Allowable Expenses</h3>
                            <div class="stat-icon bg-danger-light text-danger">
                                <span class="material-icons-round">receipt</span>
                            </div>
                        </div>
                        <div class="stat-value" style="color: var(--danger);">
                            ${DataManager.formatCurrency(currentReport.totalExpenses)}
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                            <span class="tax-tag tax-tag-deductible">Tax Deductible</span>
                            <span>${currentReport.deductibleExpenses.length} verified outlays</span>
                        </div>
                    </div>
                </div>

                <!-- Capital Lent (Loans Given) -->
                <div class="col-span-3 animate-slide-up">
                    <div class="card stat-card" style="height: 100%;">
                        <div class="card-header" style="margin-bottom: 0;">
                            <h3 class="card-title text-secondary">Capital Lent (Debtors)</h3>
                            <div class="stat-icon bg-warning-light text-warning">
                                <span class="material-icons-round">arrow_upward</span>
                            </div>
                        </div>
                        <div class="stat-value" style="color: var(--warning);">
                            ${DataManager.formatCurrency(currentReport.totalLoansGiven)}
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                            <span class="tax-tag tax-tag-capital-asset">Balance Sheet Asset</span>
                            <span>Excluded from expenses</span>
                        </div>
                    </div>
                </div>

                <!-- Capital Inflows (Borrowed & Recoveries) -->
                <div class="col-span-3 animate-slide-up">
                    <div class="card stat-card" style="height: 100%;">
                        <div class="card-header" style="margin-bottom: 0;">
                            <h3 class="card-title text-secondary">Capital Inflows</h3>
                            <div class="stat-icon bg-accent-light text-accent">
                                <span class="material-icons-round">arrow_downward</span>
                            </div>
                        </div>
                        <div class="stat-value" style="color: var(--accent);">
                            ${DataManager.formatCurrency(currentReport.totalLoansReceived + currentReport.totalLoanRecoveries)}
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                            <span class="tax-tag tax-tag-liability">Capital Movement</span>
                            <span>Non-taxable principal</span>
                        </div>
                    </div>
                </div>

                <!-- Anti-Falsification Reconciliation -->
                <div class="col-span-3 animate-slide-up">
                    <div class="card stat-card" style="height: 100%;">
                        <div class="card-header" style="margin-bottom: 0;">
                            <h3 class="card-title text-secondary">Anti-Falsification Audit</h3>
                            <div class="stat-icon bg-primary-light text-primary">
                                <span class="material-icons-round">balance</span>
                            </div>
                        </div>
                        <div class="stat-value" style="font-size: 22px;">
                            ${DataManager.formatCurrency(currentReport.totalCashOutflow)}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">
                            Total Cash Outflow · <strong>${DataManager.formatCurrency(currentReport.totalExcludedOutflows)}</strong> quarantined capital loans
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Pakistan Tax Slab Estimator HTML
        const taxSlabHTML = `
            <div class="card tax-slab-card animate-slide-up" style="margin-bottom: 24px;">
                <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
                    <div>
                        <div class="tax-card-header-flex" style="display: flex; align-items: center; gap: 8px;">
                            <h3 class="card-title">Pakistan Income Tax Slab Estimator</h3>
                            <span class="tax-tag tax-tag-deductible">Finance Act Statutory Slabs</span>
                        </div>
                        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                            Estimated annual tax liability and monthly payroll withholding based on declared gross revenue/salary.
                        </p>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; max-width: 320px;">
                        <div class="tax-type-toggle">
                            <button class="tax-type-btn ${taxpayerType === 'salaried' ? 'active' : ''}" id="tax-toggle-salaried" data-type="salaried">
                                Salaried Individual
                            </button>
                            <button class="tax-type-btn ${taxpayerType === 'business' ? 'active' : ''}" id="tax-toggle-business" data-type="business">
                                Business / Non-Salaried
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Taxable Base & Slab Overview -->
                <div class="tax-base-row" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 16px;">
                    <div class="tax-base-row-input-group" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <span style="font-size: 13px; font-weight: 500;">Taxable Income Base:</span>
                        <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
                            <input type="number" id="tax-income-input" value="${taxEst.taxableIncome}" style="background: var(--bg-base); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); padding: 5px 10px; font-size: 14px; font-weight: 600; width: 140px; min-width: 0;" min="0">
                            <button class="btn btn-secondary" id="tax-income-reset-btn" style="padding: 4px 8px; font-size: 11px; flex-shrink: 0;" title="Reset to actual period income">
                                <span class="material-icons-round" style="font-size: 14px;">sync</span> Actual
                            </button>
                        </div>
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary);">
                        Current Bracket: <strong id="tax-slab-bracket-val" style="color: var(--primary);">${taxEst.currentSlab}</strong>
                    </div>
                </div>

                <!-- Slab Metric Grid -->
                <div class="tax-slab-grid">
                    <div class="tax-slab-metric-box">
                        <span class="tax-slab-metric-label">Estimated Annual Tax</span>
                        <span class="tax-slab-metric-val" id="tax-slab-annual-val" style="color: var(--danger);">${DataManager.formatCurrency(taxEst.annualTax)}</span>
                        <span class="tax-slab-metric-sub">Full year estimated liability</span>
                    </div>

                    <div class="tax-slab-metric-box">
                        <span class="tax-slab-metric-label">Monthly Withholding</span>
                        <span class="tax-slab-metric-val" id="tax-slab-monthly-val" style="color: var(--warning);">${DataManager.formatCurrency(taxEst.monthlyTax)}</span>
                        <span class="tax-slab-metric-sub">Average deduction per month</span>
                    </div>

                    <div class="tax-slab-metric-box">
                        <span class="tax-slab-metric-label">Effective Tax Rate</span>
                        <span class="tax-slab-metric-val" id="tax-slab-rate-val" style="color: var(--accent);">${taxEst.effectiveRate.toFixed(1)}%</span>
                        <span class="tax-slab-metric-sub" id="tax-slab-marginal-val">Marginal bracket: ${taxEst.marginalRate}%</span>
                    </div>

                    <div class="tax-slab-metric-box">
                        <span class="tax-slab-metric-label">Net Post-Tax Income</span>
                        <span class="tax-slab-metric-val" id="tax-slab-takehome-val" style="color: var(--success);">${DataManager.formatCurrency(taxEst.netTakeHome)}</span>
                        <span class="tax-slab-metric-sub">Estimated disposable income</span>
                    </div>
                </div>
            </div>
        `;

        // Category Breakdown Section
        const hasExpenses = currentReport.totalExpenses > 0;
        const categoryBreakdownHTML = `
            <div class="dashboard-grid" style="margin-bottom: 24px;">
                <!-- Left: Category Chart -->
                <div class="col-span-5 animate-slide-up">
                    <div class="card" style="height: 100%; display: flex; flex-direction: column;">
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">Expense Distribution</h3>
                                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                                    Category-wise allocation of allowable expenses
                                </p>
                            </div>
                            <span class="tax-tag tax-tag-deductible">${currentReport.categories.length} Categories</span>
                        </div>
                        
                        <div class="chart-container" style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 220px; position: relative; width: 100%;">
                            ${hasExpenses ? `
                                <canvas id="tax-category-chart"></canvas>
                            ` : Components.emptyState('pie_chart', 'No expenses recorded', 'No deductible expenses found in the selected time frame.')}
                        </div>
                    </div>
                </div>

                <!-- Right: "What Went Where" Detailed Breakdown List -->
                <div class="col-span-7 animate-slide-up">
                    <div class="card" style="height: 100%;">
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">What Went Where (Category Breakdown)</h3>
                                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                                    Click any category to filter the itemized transaction audit below
                                </p>
                            </div>
                            ${selectedCategory !== 'all' ? `
                                <button class="btn btn-secondary" id="tax-clear-cat-filter" style="padding: 4px 10px; font-size: 12px;">
                                    <span class="material-icons-round" style="font-size: 14px;">close</span> Clear Category
                                </button>
                            ` : ''}
                        </div>

                        <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
                            ${hasExpenses ? currentReport.categories.map(c => {
                                const isSelected = selectedCategory === c.category;
                                return `
                                    <div class="tax-breakdown-item ${isSelected ? 'selected' : ''}" data-cat="${encodeURIComponent(c.category)}">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span class="material-icons-round" style="font-size: 18px; color: var(--primary);">category</span>
                                                <span style="font-weight: 500; font-size: 14px;">${c.category}</span>
                                                <span style="font-size: 11px; color: var(--text-muted);">(${c.count} txs)</span>
                                            </div>
                                            <div style="text-align: right;">
                                                <span style="font-weight: 600; font-size: 14px;">${DataManager.formatCurrency(c.amount)}</span>
                                                <span style="font-size: 12px; color: var(--text-secondary); margin-left: 6px;">${c.percentage.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        <div class="progress-container" style="height: 6px; background: rgba(255,255,255,0.06);">
                                            <div class="progress-bar" style="width: ${c.percentage}%; background: var(--primary);"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('') : Components.emptyState('receipt_long', 'No expenses found', 'Adjust your dates to view breakdown.')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Loan Capital Movements & Anti-Falsification Section
        const hasLoans = currentReport.loanCapitalMovements.length > 0;
        const loanReconciliationHTML = `
            <div class="card animate-slide-up" style="margin-bottom: 24px;">
                <div class="card-header card-header-collapsible" id="tax-loan-audit-header" style="margin-bottom: 0;">
                    <div>
                        <div class="tax-card-header-flex" style="display: flex; align-items: center; gap: 8px;">
                            <h3 class="card-title">Loan Capital Reconciliation (Assets & Liabilities Audit)</h3>
                            <span class="tax-tag tax-tag-capital-asset">Balance Sheet Quarantined</span>
                        </div>
                        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                            Strict segregation of friendly loans to protect Wealth Statement (Form 114) integrity and prevent tax falsification.
                        </p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="text-secondary" style="font-size: 12px;">${currentReport.loanCapitalMovements.length} records</span>
                        <div class="icon-btn" style="width: 32px; height: 32px; border: none; background: var(--bg-surface-hover); pointer-events: none;">
                            <span class="material-icons-round" id="tax-loan-chevron">${isLoanAuditCollapsed ? 'expand_more' : 'expand_less'}</span>
                        </div>
                    </div>
                </div>

                <div id="tax-loan-audit-body" style="display: ${isLoanAuditCollapsed ? 'none' : 'block'}; margin-top: 16px;">
                    ${hasLoans ? `
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Counterparty / Description</th>
                                        <th>Tax Classification</th>
                                        <th>Regulatory Treatment</th>
                                        <th style="text-align: right;">Principal Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${currentReport.loanCapitalMovements.map(m => {
                                        let tagClass = 'tax-tag-discharge';
                                        if (m.taxTreatment.includes('Asset')) tagClass = 'tax-tag-capital-asset';
                                        else if (m.taxTreatment.includes('Liability')) tagClass = 'tax-tag-liability';
                                        else if (m.taxTreatment.includes('Recovery')) tagClass = 'tax-tag-recovery';

                                        const isOutflow = m.amount < 0;
                                        const amountColor = isOutflow ? 'var(--warning)' : 'var(--accent)';

                                        return `
                                            <tr>
                                                <td data-label="Date" style="font-size: 13px; color: var(--text-secondary);">${DataManager.formatDate(m.date)}</td>
                                                <td data-label="Counterparty">
                                                    <div style="font-weight: 500;">${m.merchant}</div>
                                                </td>
                                                <td data-label="Classification"><span class="tax-tag ${tagClass}">${m.taxTreatment}</span></td>
                                                <td data-label="Regulatory" style="font-size: 12px; color: var(--text-secondary);">${m.taxNote}</td>
                                                <td data-label="Principal Amount" style="text-align: right; font-weight: 600; color: ${amountColor};">
                                                    ${isOutflow ? '-' : '+'}${DataManager.formatCurrency(m.absAmount)}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="padding: 24px; text-align: center; color: var(--text-secondary); font-size: 13px;">
                            <span class="material-icons-round" style="font-size: 28px; color: var(--text-muted); display: block; margin-bottom: 8px;">check_circle_outline</span>
                            No loan disbursements, borrowings, or settlement transactions occurred within this time frame.
                        </div>
                    `}
                </div>
            </div>
        `;

        // Detailed Itemized Transaction Audit Log
        const allAccounts = appData.accounts || [];
        let filteredExpenses = currentReport.deductibleExpenses;
        if (selectedCategory !== 'all') {
            filteredExpenses = filteredExpenses.filter(e => e.category === selectedCategory);
        }
        if (selectedAccountId !== 'all') {
            const accId = parseInt(selectedAccountId);
            filteredExpenses = filteredExpenses.filter(e => e.accountId === accId);
        }
        if (searchQuery.trim() !== '') {
            const q = searchQuery.trim().toLowerCase();
            filteredExpenses = filteredExpenses.filter(e => 
                (e.merchant || '').toLowerCase().includes(q) ||
                (e.category || '').toLowerCase().includes(q)
            );
        }
        const hasActiveFilters = selectedCategory !== 'all' || selectedAccountId !== 'all' || searchQuery.trim() !== '';

        const transactionAuditHTML = `
            <div class="card animate-slide-up">
                <div class="card-header card-header-collapsible" id="tax-expenses-audit-header" style="margin-bottom: 0;">
                    <div>
                        <h3 class="card-title">Itemized Allowable Expenses Audit</h3>
                        <p id="tax-audit-count-label" style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                            Showing <strong>${filteredExpenses.length}</strong> of ${currentReport.deductibleExpenses.length} deductible transactions
                        </p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="btn btn-secondary" id="tax-reset-table-filters" style="display: ${hasActiveFilters ? 'inline-flex' : 'none'}; padding: 4px 10px; font-size: 12px;">
                            <span class="material-icons-round" style="font-size: 14px;">filter_alt_off</span> Reset Filters
                        </button>
                        <div class="icon-btn" style="width: 32px; height: 32px; border: none; background: var(--bg-surface-hover); pointer-events: none;">
                            <span class="material-icons-round" id="tax-expenses-chevron">${isExpensesAuditCollapsed ? 'expand_more' : 'expand_less'}</span>
                        </div>
                    </div>
                </div>

                <div id="tax-expenses-audit-body" style="display: ${isExpensesAuditCollapsed ? 'none' : 'block'}; margin-top: 16px;">
                    <!-- Search & Account Filters -->
                    <div class="tax-table-toolbar">
                        <div class="tax-search-box">
                            <span class="material-icons-round" style="font-size: 18px; color: var(--text-secondary);">search</span>
                            <input type="text" id="tax-tx-search" placeholder="Search payee, merchant, category..." value="${searchQuery}">
                            ${searchQuery ? `
                                <span class="material-icons-round" id="tax-tx-search-clear" style="font-size: 16px; color: var(--text-secondary); cursor: pointer;">close</span>
                            ` : ''}
                        </div>

                        <div class="tax-account-filter-wrap" style="display: flex; align-items: center; gap: 10px;">
                            <span class="text-secondary" style="font-size: 13px;">Account:</span>
                            <select id="tax-tx-account-filter">
                                <option value="all"${selectedAccountId === 'all' ? ' selected' : ''}>All Accounts</option>
                                ${allAccounts.map(a => `
                                    <option value="${a.id}"${selectedAccountId === String(a.id) ? ' selected' : ''}>${a.name}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <div id="tax-audit-empty-state" style="display: ${filteredExpenses.length === 0 ? 'block' : 'none'};">
                        ${Components.emptyState('receipt_long', 'No matching transactions', 'No allowable expenses match the selected search and filter criteria.')}
                    </div>

                    <div class="table-container" id="tax-audit-table-container" style="display: ${filteredExpenses.length > 0 ? 'block' : 'none'};">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Payee / Description</th>
                                    <th>Category</th>
                                    <th>Account</th>
                                    <th>Audit Status</th>
                                    <th style="text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody id="tax-audit-table-tbody">
                                ${filteredExpenses.map(t => {
                                    const acc = DataManager.getAccountById(t.accountId);
                                    return `
                                        <tr>
                                            <td data-label="Date" style="font-size: 13px; color: var(--text-secondary);">${DataManager.formatDate(t.date)}</td>
                                            <td data-label="Payee"><div style="font-weight: 500;">${t.merchant}</div></td>
                                            <td data-label="Category"><span class="tag bg-primary-light">${t.category}</span></td>
                                            <td data-label="Account">${acc ? acc.name : 'Unknown'}</td>
                                            <td data-label="Audit Status"><span class="tax-tag tax-tag-deductible">Allowable Deduction</span></td>
                                            <td data-label="Amount" style="text-align: right; font-weight: 600; color: var(--danger);">
                                                -${DataManager.formatCurrency(t.absAmount)}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        return metricsHTML + taxSlabHTML + categoryBreakdownHTML + loanReconciliationHTML + transactionAuditHTML;
    }
};

if (typeof window !== 'undefined') window.TaxManager = TaxManager;
else if (typeof global !== 'undefined') global.TaxManager = TaxManager;

Views.tax = () => {
    // Determine initial dates based on Pakistan Fiscal Year
    const refDate = TaxManager.getReferenceDate();
    const currentFY = TaxManager.getPakistanFiscalYear(refDate);
    const prevFY = TaxManager.getPreviousPakistanFiscalYear(refDate);

    // Initial state
    let activePreset = 'current-fy';
    let startDate = currentFY.startDate;
    let endDate = currentFY.endDate;
    let selectedCategory = 'all';
    let selectedAccountId = 'all';
    let searchQuery = '';
    let taxpayerType = 'salaried'; // 'salaried' | 'business'
    let incomeOverride = null; // null = use currentReport.totalIncome
    let isExpensesAuditCollapsed = false;
    let isLoanAuditCollapsed = false;

    // Generate initial dashboard content synchronously so view renders immediately without flashing
    const initialReport = TaxManager.getTaxReportData(startDate, endDate);
    const initialContentHTML = TaxManager.renderTaxDashboardHTML(
        initialReport,
        taxpayerType,
        incomeOverride,
        selectedCategory,
        selectedAccountId,
        searchQuery,
        isExpensesAuditCollapsed,
        isLoanAuditCollapsed
    );

    // Return the HTML layout
    const html = `
        <div id="tax-page-container">
            <!-- Tax Compliance Alert Banner -->
            <div class="tax-compliance-banner animate-slide-up">
                <div class="tax-compliance-icon">
                    <span class="material-icons-round">verified_user</span>
                </div>
                <div class="tax-compliance-content">
                    <div class="tax-compliance-title">
                        <span>Pakistan Tax & Wealth Statement Compliance</span>
                        <span class="tax-tag tax-tag-deductible">FBR IRIS Form 114 Ready</span>
                    </div>
                    <div class="tax-compliance-text">
                        Under Pakistan tax law (Income Tax Ordinance 2001, Section 111 & Wealth Reconciliation), allowable living and business expenses are strictly quarantined from friendly loans. Lending money creates a capital asset (receivable), while borrowing creates a liability. Treating loaned amounts as deductible expenses constitutes tax falsification. This report provides certified reconciliation between cash outflows and allowable deductions.
                    </div>
                </div>
            </div>

            <!-- Filter Toolbar -->
            <div class="tax-filter-bar animate-slide-up">
                <div class="tax-presets">
                    <button class="tax-preset-pill active" id="preset-current-fy" data-preset="current-fy">
                        ${currentFY.label}
                    </button>
                    <button class="tax-preset-pill" id="preset-prev-fy" data-preset="prev-fy">
                        Previous FY (${prevFY.startYear}-${String(prevFY.endYear).slice(2)})
                    </button>
                    <button class="tax-preset-pill" id="preset-last-12m" data-preset="last-12m">
                        Last 12 Months
                    </button>
                    <button class="tax-preset-pill" id="preset-all" data-preset="all">
                        All Time
                    </button>
                </div>
                
                <div class="tax-filter-controls">
                    <div class="tax-date-inputs">
                        <div class="tax-date-field">
                            <span class="text-secondary" style="font-size: 12px; font-weight: 500;">From</span>
                            <input type="date" id="tax-start-date" value="${startDate}">
                        </div>
                        <div class="tax-date-field">
                            <span class="text-secondary" style="font-size: 12px; font-weight: 500;">To</span>
                            <input type="date" id="tax-end-date" value="${endDate}">
                        </div>
                    </div>
                    <div class="tax-actions-row">
                        <button class="btn btn-secondary" id="tax-export-btn" title="Download Tax Filing CSV">
                            <span class="material-icons-round" style="font-size: 18px;">download</span>
                            <span>Export CSV</span>
                        </button>
                        <button class="btn btn-secondary" id="tax-print-btn" title="Print Tax Summary">
                            <span class="material-icons-round" style="font-size: 18px;">print</span>
                            <span>Print</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Dynamic Tax Content Area -->
            <div id="tax-dynamic-content">
                ${initialContentHTML}
            </div>
        </div>
    `;

    // Defer initialization to attach events & chart
    setTimeout(() => {
        if (typeof document === 'undefined' || !document.getElementById) return;
        const container = document.getElementById('tax-page-container');
        if (!container) return;

        const startDateInput = document.getElementById('tax-start-date');
        const endDateInput = document.getElementById('tax-end-date');
        const presetButtons = document.querySelectorAll('.tax-preset-pill');
        const exportBtn = document.getElementById('tax-export-btn');
        const printBtn = document.getElementById('tax-print-btn');

        let currentReport = TaxManager.getTaxReportData(startDate, endDate);

        const updatePresetActiveUI = (presetKey) => {
            activePreset = presetKey;
            presetButtons.forEach(btn => {
                if (btn.getAttribute('data-preset') === presetKey) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        };

        const getFilteredExpenses = () => {
            let result = currentReport.deductibleExpenses;
            if (selectedCategory !== 'all') {
                result = result.filter(e => e.category === selectedCategory);
            }
            if (selectedAccountId !== 'all') {
                const accId = parseInt(selectedAccountId);
                result = result.filter(e => e.accountId === accId);
            }
            if (searchQuery.trim() !== '') {
                const q = searchQuery.trim().toLowerCase();
                result = result.filter(e => 
                    (e.merchant || '').toLowerCase().includes(q) ||
                    (e.category || '').toLowerCase().includes(q)
                );
            }
            return result;
        };

        const updateAuditTableBodyOnly = () => {
            const tbody = document.getElementById('tax-audit-table-tbody');
            const countLabel = document.getElementById('tax-audit-count-label');
            const emptyState = document.getElementById('tax-audit-empty-state');
            const tableContainer = document.getElementById('tax-audit-table-container');
            const resetBtn = document.getElementById('tax-reset-table-filters');

            const filtered = getFilteredExpenses();

            if (countLabel) {
                countLabel.innerHTML = `Showing <strong>${filtered.length}</strong> of ${currentReport.deductibleExpenses.length} deductible transactions`;
            }

            const hasActiveFilters = selectedCategory !== 'all' || selectedAccountId !== 'all' || searchQuery.trim() !== '';
            if (resetBtn) {
                resetBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';
            }

            if (filtered.length === 0) {
                if (tableContainer) tableContainer.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
            } else {
                if (tableContainer) tableContainer.style.display = 'block';
                if (emptyState) emptyState.style.display = 'none';
                if (tbody) {
                    tbody.innerHTML = filtered.map(t => {
                        const acc = DataManager.getAccountById(t.accountId);
                        return `
                            <tr>
                                <td data-label="Date" style="font-size: 13px; color: var(--text-secondary);">${DataManager.formatDate(t.date)}</td>
                                <td data-label="Payee"><div style="font-weight: 500;">${t.merchant}</div></td>
                                <td data-label="Category"><span class="tag bg-primary-light">${t.category}</span></td>
                                <td data-label="Account">${acc ? acc.name : 'Unknown'}</td>
                                <td data-label="Audit Status"><span class="tax-tag tax-tag-deductible">Allowable Deduction</span></td>
                                <td data-label="Amount" style="text-align: right; font-weight: 600; color: var(--danger);">
                                    -${DataManager.formatCurrency(t.absAmount)}
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }
        };

        const renderTaxDashboard = (skipHTML = false) => {
            const dynamicArea = document.getElementById('tax-dynamic-content');
            if (!dynamicArea) return;

            currentReport = TaxManager.getTaxReportData(startDate, endDate);

            if (!skipHTML) {
                dynamicArea.innerHTML = TaxManager.renderTaxDashboardHTML(
                    currentReport,
                    taxpayerType,
                    incomeOverride,
                    selectedCategory,
                    selectedAccountId,
                    searchQuery,
                    isExpensesAuditCollapsed,
                    isLoanAuditCollapsed
                );
            }

            const hasExpenses = currentReport.totalExpenses > 0;
            // Render Chart.js Donut Chart
            if (hasExpenses) {
                const chartCanvas = document.getElementById('tax-category-chart');
                if (chartCanvas) {
                    if (_taxChartInstance) {
                        _taxChartInstance.destroy();
                        _taxChartInstance = null;
                    }

                    const topCats = currentReport.categories.slice(0, 7);
                    const otherCats = currentReport.categories.slice(7);
                    const labels = topCats.map(c => c.category);
                    const dataPoints = topCats.map(c => c.amount);

                    if (otherCats.length > 0) {
                        labels.push('Others');
                        dataPoints.push(otherCats.reduce((s, c) => s + c.amount, 0));
                    }

                    const bgColors = [
                        '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#64748b'
                    ];

                    const ctx = chartCanvas.getContext('2d');
                    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
                    _taxChartInstance = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: labels,
                            datasets: [{
                                data: dataPoints,
                                backgroundColor: bgColors.slice(0, labels.length),
                                borderWidth: 0,
                                hoverOffset: 4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: isMobile ? 'bottom' : 'right',
                                    labels: {
                                        color: '#94a3b8',
                                        font: { family: 'Outfit', size: isMobile ? 10 : 11 },
                                        boxWidth: isMobile ? 10 : 12,
                                        padding: isMobile ? 6 : 10
                                    }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: (context) => {
                                            const val = context.parsed || 0;
                                            const pct = currentReport.totalExpenses > 0 ? ((val / currentReport.totalExpenses) * 100).toFixed(1) : 0;
                                            return ` ${context.label}: ${DataManager.formatCurrency(val)} (${pct}%)`;
                                        }
                                    }
                                }
                            },
                            cutout: '65%'
                        }
                    });
                }
            }

            const updateTaxSlabUIOnly = () => {
                const effectiveIncome = incomeOverride !== null ? incomeOverride : currentReport.totalIncome;
                const est = TaxManager.calculatePakistanTaxLiability(effectiveIncome, taxpayerType);

                const bracketEl = document.getElementById('tax-slab-bracket-val');
                const annualEl = document.getElementById('tax-slab-annual-val');
                const monthlyEl = document.getElementById('tax-slab-monthly-val');
                const rateEl = document.getElementById('tax-slab-rate-val');
                const marginalEl = document.getElementById('tax-slab-marginal-val');
                const takehomeEl = document.getElementById('tax-slab-takehome-val');

                if (bracketEl) bracketEl.textContent = est.currentSlab;
                if (annualEl) annualEl.textContent = DataManager.formatCurrency(est.annualTax);
                if (monthlyEl) monthlyEl.textContent = DataManager.formatCurrency(est.monthlyTax);
                if (rateEl) rateEl.textContent = `${est.effectiveRate.toFixed(1)}%`;
                if (marginalEl) marginalEl.textContent = `Marginal bracket: ${est.marginalRate}%`;
                if (takehomeEl) takehomeEl.textContent = DataManager.formatCurrency(est.netTakeHome);
            };

            // Bind Tax Slab Toggle Listeners (Feature 4)
            const toggleSalaried = document.getElementById('tax-toggle-salaried');
            const toggleBusiness = document.getElementById('tax-toggle-business');
            if (toggleSalaried) {
                toggleSalaried.addEventListener('click', () => {
                    taxpayerType = 'salaried';
                    toggleSalaried.classList.add('active');
                    if (toggleBusiness) toggleBusiness.classList.remove('active');
                    updateTaxSlabUIOnly();
                });
            }
            if (toggleBusiness) {
                toggleBusiness.addEventListener('click', () => {
                    taxpayerType = 'business';
                    toggleBusiness.classList.add('active');
                    if (toggleSalaried) toggleSalaried.classList.remove('active');
                    updateTaxSlabUIOnly();
                });
            }

            // Tax Income Input Listener
            const incomeInput = document.getElementById('tax-income-input');
            if (incomeInput) {
                incomeInput.addEventListener('input', (e) => {
                    incomeOverride = parseFloat(e.target.value) || 0;
                    updateTaxSlabUIOnly();
                });
            }

            const incomeResetBtn = document.getElementById('tax-income-reset-btn');
            if (incomeResetBtn) {
                incomeResetBtn.addEventListener('click', () => {
                    incomeOverride = null;
                    if (incomeInput) incomeInput.value = currentReport.totalIncome;
                    updateTaxSlabUIOnly();
                });
            }

            // Bind Category Breakdown Clicks
            document.querySelectorAll('.tax-breakdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const cat = decodeURIComponent(item.getAttribute('data-cat'));
                    selectedCategory = selectedCategory === cat ? 'all' : cat;
                    if (selectedCategory !== 'all') {
                        isExpensesAuditCollapsed = false; // Auto-expand when category clicked
                    }
                    renderTaxDashboard();
                });
            });

            // Toggle Loan Capital Reconciliation Collapsible
            const loanHeader = document.getElementById('tax-loan-audit-header');
            const loanBody = document.getElementById('tax-loan-audit-body');
            const loanChevron = document.getElementById('tax-loan-chevron');
            if (loanHeader && loanBody && loanChevron) {
                loanHeader.addEventListener('click', () => {
                    isLoanAuditCollapsed = !isLoanAuditCollapsed;
                    loanBody.style.display = isLoanAuditCollapsed ? 'none' : 'block';
                    loanChevron.textContent = isLoanAuditCollapsed ? 'expand_more' : 'expand_less';
                });
            }

            // Toggle Expenses Audit Collapsible
            const expensesHeader = document.getElementById('tax-expenses-audit-header');
            const expensesBody = document.getElementById('tax-expenses-audit-body');
            const expensesChevron = document.getElementById('tax-expenses-chevron');
            if (expensesHeader && expensesBody && expensesChevron) {
                expensesHeader.addEventListener('click', (e) => {
                    if (e.target.closest('#tax-reset-table-filters')) return;
                    isExpensesAuditCollapsed = !isExpensesAuditCollapsed;
                    expensesBody.style.display = isExpensesAuditCollapsed ? 'none' : 'block';
                    expensesChevron.textContent = isExpensesAuditCollapsed ? 'expand_more' : 'expand_less';
                });
            }

            const clearFilterBtn = document.getElementById('tax-clear-cat-filter');
            if (clearFilterBtn) {
                clearFilterBtn.addEventListener('click', () => {
                    selectedCategory = 'all';
                    renderTaxDashboard();
                });
            }

            // Search & Account Filters Listeners (Feature 6)
            const searchInput = document.getElementById('tax-tx-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    searchQuery = e.target.value;
                    updateAuditTableBodyOnly();
                });
            }

            const searchClear = document.getElementById('tax-tx-search-clear');
            if (searchClear) {
                searchClear.addEventListener('click', () => {
                    searchQuery = '';
                    if (searchInput) searchInput.value = '';
                    updateAuditTableBodyOnly();
                });
            }

            const accountSelect = document.getElementById('tax-tx-account-filter');
            if (accountSelect) {
                accountSelect.addEventListener('change', (e) => {
                    selectedAccountId = e.target.value;
                    updateAuditTableBodyOnly();
                });
            }

            const resetTableFiltersBtn = document.getElementById('tax-reset-table-filters');
            if (resetTableFiltersBtn) {
                resetTableFiltersBtn.addEventListener('click', () => {
                    selectedCategory = 'all';
                    selectedAccountId = 'all';
                    searchQuery = '';
                    renderTaxDashboard();
                });
            }
        };

        // Date input change listeners
        if (startDateInput) {
            startDateInput.addEventListener('change', () => {
                startDate = startDateInput.value;
                updatePresetActiveUI('custom');
                selectedCategory = 'all';
                searchQuery = '';
                selectedAccountId = 'all';
                renderTaxDashboard();
            });
        }

        if (endDateInput) {
            endDateInput.addEventListener('change', () => {
                endDate = endDateInput.value;
                updatePresetActiveUI('custom');
                selectedCategory = 'all';
                searchQuery = '';
                selectedAccountId = 'all';
                renderTaxDashboard();
            });
        }

        // Preset button listeners
        presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                updatePresetActiveUI(preset);
                selectedCategory = 'all';
                searchQuery = '';
                selectedAccountId = 'all';

                if (preset === 'current-fy') {
                    startDate = currentFY.startDate;
                    endDate = currentFY.endDate;
                } else if (preset === 'prev-fy') {
                    startDate = prevFY.startDate;
                    endDate = prevFY.endDate;
                } else if (preset === 'last-12m') {
                    const today = new Date();
                    const pastYear = new Date(today);
                    pastYear.setFullYear(pastYear.getFullYear() - 1);
                    startDate = DataManager.getLocalDateString(pastYear);
                    endDate = DataManager.getLocalDateString(today);
                } else if (preset === 'all') {
                    startDate = '1970-01-01';
                    endDate = '2099-12-31';
                }

                if (startDateInput) startDateInput.value = startDate;
                if (endDateInput) endDateInput.value = endDate;
                renderTaxDashboard();
            });
        });

        // Export button listener
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                TaxManager.exportTaxCSV(currentReport, taxpayerType);
            });
        }

        // Print button listener
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                window.print();
            });
        }

        // Initial render: HTML already rendered synchronously into DOM, skip re-injecting HTML
        renderTaxDashboard(true);
    }, 0);

    return html;
};
