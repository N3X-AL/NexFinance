/**
 * NexFinance - Credit Cards Module
 * Tracks credit card accounts, billing cycles, projected statement bills,
 * Average Daily Balance (ADB) interest charges, credit utilization, and payoff simulations.
 */

let _activeCreditCardId = null;

const CreditCardsView = {
    getActiveCardId: () => {
        const cards = CreditCardManager.getCreditCards();
        if (cards.length === 0) return null;
        if (!_activeCreditCardId || !cards.some(c => c.id === _activeCreditCardId)) {
            _activeCreditCardId = cards[0].id;
        }
        return _activeCreditCardId;
    },

    setActiveCardId: (id) => {
        _activeCreditCardId = parseInt(id);
        if (typeof app !== 'undefined' && app.currentRoute === 'credit-cards') {
            app.navigate('credit-cards');
        }
    },

    getThemeGradient: (theme) => {
        const gradients = {
            obsidian: 'linear-gradient(135deg, #1f242d 0%, #0d1117 100%)',
            royal: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
            emerald: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
            gold: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)',
            titanium: 'linear-gradient(135deg, #374151 0%, #111827 100%)'
        };
        return gradients[theme] || gradients.obsidian;
    }
};

Views['credit-cards'] = () => {
    const cards = CreditCardManager.getCreditCards();
    const aggregate = CreditCardManager.getAggregateMetrics();

    // If no cards exist
    if (cards.length === 0) {
        return `
            <div class="card animate-slide-up" style="text-align: center; padding: 48px 24px; max-width: 600px; margin: 40px auto;">
                <div style="width: 64px; height: 64px; border-radius: var(--radius-full); background: rgba(99, 102, 241, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                    <span class="material-icons-round" style="font-size: 32px;">credit_card</span>
                </div>
                <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">No Credit Cards Added Yet</h3>
                <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px; line-height: 1.5;">
                    Add your credit cards to forecast your upcoming statement bills, track credit utilization, and simulate finance charges based on your card's documentation.
                </p>
                <button class="btn btn-primary" onclick="app.showAddCreditCardModal()">
                    <span class="material-icons-round">add</span> Add Your First Credit Card
                </button>
            </div>
        `;
    }

    const activeCardId = CreditCardsView.getActiveCardId();
    const activeCard = CreditCardManager.getCreditCardById(activeCardId) || cards[0];
    const metrics = CreditCardManager.getCardMetrics(activeCard);

    // Aggregate Utilization color
    let aggUtilColor = 'var(--success)';
    if (aggregate.overallUtilization > 50) aggUtilColor = 'var(--danger)';
    else if (aggregate.overallUtilization >= 30) aggUtilColor = 'var(--warning)';

    // Timeline calculations
    const cycleTotalDays = Math.max(1, Math.round((metrics.cycle.endDate.getTime() - metrics.cycle.startDate.getTime()) / (24 * 60 * 60 * 1000)));
    const cycleElapsedDays = Math.min(cycleTotalDays, Math.max(0, cycleTotalDays - metrics.cycle.daysUntilCut));
    const cycleProgressPercent = Math.min(100, Math.round((cycleElapsedDays / cycleTotalDays) * 100));

    // Payoff Simulator baseline
    const simBal = metrics.projectedStatementTotal;
    const simApr = activeCard.apr || 24.99;
    const dailyApr = (simApr / 100) / 365;

    return `
        <!-- Top Aggregate KPIs -->
        <div class="grid-cols-4" style="margin-bottom: 24px;">
            <div class="card stat-card animate-slide-up">
                <div class="card-header" style="margin-bottom: 0;">
                    <h3 class="card-title text-secondary">Total Credit Limit</h3>
                    <div class="stat-icon bg-primary-light text-primary">
                        <span class="material-icons-round">account_balance_wallet</span>
                    </div>
                </div>
                <div class="stat-value">${DataManager.formatCurrency(aggregate.totalLimit)}</div>
                <div class="stat-change text-secondary" style="font-size: 12px;">
                    Across ${aggregate.cardCount} active ${aggregate.cardCount === 1 ? 'card' : 'cards'}
                </div>
            </div>

            <div class="card stat-card animate-slide-up">
                <div class="card-header" style="margin-bottom: 0;">
                    <h3 class="card-title text-secondary">Total Current Balance</h3>
                    <div class="stat-icon bg-danger-light text-danger">
                        <span class="material-icons-round">trending_down</span>
                    </div>
                </div>
                <div class="stat-value">${DataManager.formatCurrency(aggregate.totalOutstanding)}</div>
                <div class="stat-change text-secondary" style="font-size: 12px;">
                    ${DataManager.formatCurrency(Math.max(0, aggregate.totalLimit - aggregate.totalOutstanding))} available
                </div>
            </div>

            <div class="card stat-card animate-slide-up">
                <div class="card-header" style="margin-bottom: 0;">
                    <h3 class="card-title text-secondary">Projected Upcoming Bills</h3>
                    <div class="stat-icon bg-warning-light text-warning">
                        <span class="material-icons-round">receipt</span>
                    </div>
                </div>
                <div class="stat-value" style="color: var(--warning);">${DataManager.formatCurrency(aggregate.totalProjectedBills)}</div>
                <div class="stat-change text-secondary" style="font-size: 12px;">
                    ${aggregate.totalEstimatedInterest > 0 ? `Est. ${DataManager.formatCurrency(aggregate.totalEstimatedInterest)} interest` : 'Grace period active (0% interest)'}
                </div>
            </div>

            <div class="card stat-card animate-slide-up">
                <div class="card-header" style="margin-bottom: 0;">
                    <h3 class="card-title text-secondary">Credit Utilization</h3>
                    <div class="stat-icon" style="background: rgba(16, 185, 129, 0.1); color: ${aggUtilColor};">
                        <span class="material-icons-round">speed</span>
                    </div>
                </div>
                <div class="stat-value" style="color: ${aggUtilColor};">${aggregate.overallUtilization.toFixed(1)}%</div>
                <div style="width: 100%; height: 6px; background: var(--bg-base); border-radius: 4px; overflow: hidden; margin-top: 8px;">
                    <div style="width: ${Math.min(100, aggregate.overallUtilization)}%; height: 100%; background: ${aggUtilColor}; border-radius: 4px; transition: width 0.4s ease;"></div>
                </div>
            </div>
        </div>

        <!-- Card Selector Tabs & Actions -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
            <div style="display: flex; gap: 8px; overflow-x: auto; max-width: 100%; padding-bottom: 4px;">
                ${cards.map(c => {
                    const isSelected = c.id === activeCard.id;
                    return `
                        <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'}" 
                                style="padding: 8px 16px; font-size: 13px; white-space: nowrap; border-radius: var(--radius-full);"
                                onclick="CreditCardsView.setActiveCardId(${c.id})">
                            <span class="material-icons-round" style="font-size: 16px;">credit_card</span>
                            ${c.name} (···${c.last4})
                        </button>
                    `;
                }).join('')}
            </div>

            <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary" onclick="app.showAddCreditCardModal()">
                    <span class="material-icons-round">add</span> Add Card
                </button>
                <button class="btn btn-primary" onclick="app.showPayCreditCardModal(${activeCard.id})">
                    <span class="material-icons-round">payments</span> Pay Bill
                </button>
            </div>
        </div>

        <!-- Main Detail Grid -->
        <div style="display: grid; grid-template-columns: minmax(320px, 420px) 1fr; gap: 24px; margin-bottom: 24px;">
            
            <!-- Left Column: Realistic Virtual Card & Quick Actions -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
                
                <!-- Realistic Virtual Card Item -->
                <div class="virtual-card-container animate-slide-up" style="background: ${CreditCardsView.getThemeGradient(activeCard.colorTheme)};">
                    <div class="virtual-card-glass"></div>
                    <div class="virtual-card-top">
                        <div class="virtual-card-bank">${activeCard.bank || 'Credit Card'}</div>
                        <div class="virtual-card-contactless">
                            <span class="material-icons-round" style="font-size: 20px;">contactless</span>
                        </div>
                    </div>
                    
                    <div class="virtual-card-chip"></div>

                    <div class="virtual-card-number">
                        •••• •••• •••• ${activeCard.last4 || '0000'}
                    </div>

                    <div class="virtual-card-bottom">
                        <div>
                            <div class="virtual-card-sublabel">CARDHOLDER</div>
                            <div class="virtual-card-holder">${activeCard.name}</div>
                        </div>
                        <div style="text-align: right;">
                            <div class="virtual-card-sublabel">LIMIT</div>
                            <div class="virtual-card-holder">${DataManager.formatCurrency(activeCard.creditLimit)}</div>
                        </div>
                    </div>
                </div>

                <!-- Utilization Health Card -->
                <div class="card animate-slide-up" style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-weight: 600; font-size: 14px;">Card Credit Utilization</span>
                        <span class="tag" style="background: rgba(${metrics.healthStatus === 'optimal' ? '16, 185, 129' : metrics.healthStatus === 'moderate' ? '245, 158, 11' : '239, 68, 68'}, 0.15); color: ${metrics.healthColor}; font-weight: 600; font-size: 11px;">
                            ${metrics.healthLabel}
                        </span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                        <span style="font-size: 24px; font-weight: 700; color: ${metrics.healthColor};">${metrics.utilizationRate.toFixed(1)}%</span>
                        <span style="font-size: 13px; color: var(--text-secondary);">${DataManager.formatCurrency(metrics.totalOutstanding)} of ${DataManager.formatCurrency(metrics.limit)}</span>
                    </div>

                    <!-- Utilization Multi-zone Bar -->
                    <div style="position: relative; width: 100%; height: 10px; background: var(--bg-base); border-radius: 6px; overflow: hidden; margin-bottom: 14px;">
                        <div style="width: ${metrics.utilizationClamped}%; height: 100%; background: ${metrics.healthColor}; border-radius: 6px; transition: width 0.4s ease;"></div>
                    </div>

                    <!-- Utilization Advice Box -->
                    <div style="background: var(--bg-base); border-radius: var(--radius-md); padding: 12px; font-size: 12px; color: var(--text-secondary); line-height: 1.5; border-left: 3px solid ${metrics.healthColor};">
                        ${metrics.healthStatus === 'optimal' ? `
                            <span class="material-icons-round" style="font-size: 15px; vertical-align: -2px; color: var(--success); margin-right: 4px;">check_circle</span>
                            <strong>Safe Zone:</strong> You can spend up to <strong>${DataManager.formatCurrency(metrics.safeSpendRemaining)}</strong> more this cycle before exceeding the recommended 30% credit limit.
                        ` : `
                            <span class="material-icons-round" style="font-size: 15px; vertical-align: -2px; color: ${metrics.healthColor}; margin-right: 4px;">info</span>
                            <strong>Tip for Credit Score:</strong> Pay <strong>${DataManager.formatCurrency(metrics.payToReach30)}</strong> before your statement closes on <strong>${metrics.cycle.endDateStr}</strong> to drop below 30% before the bank reports to credit bureaus.
                        `}
                    </div>
                </div>

                <!-- Quick Action Buttons -->
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary" style="flex: 1;" onclick="app.showEditCreditCardModal(${activeCard.id})">
                        <span class="material-icons-round" style="font-size: 16px;">settings</span> Edit Rates
                    </button>
                    <button class="btn btn-primary" style="flex: 1;" onclick="app.showPayCreditCardModal(${activeCard.id})">
                        <span class="material-icons-round" style="font-size: 16px;">payments</span> Make Payment
                    </button>
                </div>
            </div>

            <!-- Right Column: Statement Cycle & Projected Bill Breakdown -->
            <div style="display: flex; flex-direction: column; gap: 20px;">

                <!-- Billing Cycle Progress Card -->
                <div class="card animate-slide-up" style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div>
                            <h3 style="font-size: 16px; font-weight: 600;">Active Billing Cycle</h3>
                            <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                                ${metrics.cycle.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${metrics.cycle.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                        <div style="text-align: right;">
                            <span class="tag" style="background: rgba(99, 102, 241, 0.15); color: var(--primary); font-weight: 600;">
                                ${metrics.cycle.daysUntilCut === 0 ? 'Statement cuts today' : `${metrics.cycle.daysUntilCut} days until statement cuts`}
                            </span>
                        </div>
                    </div>

                    <!-- Progress Bar -->
                    <div style="position: relative; width: 100%; height: 8px; background: var(--bg-base); border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
                        <div style="width: ${cycleProgressPercent}%; height: 100%; background: var(--primary); border-radius: 4px;"></div>
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
                        <span>Cycle Start: ${metrics.cycle.startDateStr}</span>
                        <span>Statement Cut: ${metrics.cycle.endDateStr}</span>
                        <span>Due Date: ${metrics.cycle.dueDateStr} (${metrics.cycle.daysUntilDue}d)</span>
                    </div>
                </div>

                <!-- Projected Bill Card (Detailed Calculation) -->
                <div class="card animate-slide-up" style="padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid var(--border-light); padding-bottom: 16px;">
                        <div>
                            <span style="font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Projected Next Statement Bill</span>
                            <div style="font-size: 32px; font-weight: 700; color: var(--text-primary); margin-top: 4px;">
                                ${DataManager.formatCurrency(metrics.projectedStatementTotal)}
                            </div>
                        </div>

                        <div style="text-align: right;">
                            <span style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">Minimum Due:</span>
                            <div style="font-size: 18px; font-weight: 700; color: var(--warning); margin-top: 2px;">
                                ${DataManager.formatCurrency(metrics.projectedMinDue)}
                            </div>
                        </div>
                    </div>

                    <!-- Math Breakdown Rows -->
                    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text-secondary);">Previous Carried Balance (Unpaid from last statement):</span>
                            <span style="font-weight: 600;">${DataManager.formatCurrency(metrics.priorUnpaid)}</span>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text-secondary);">Current Cycle Purchases (Unbilled Spending):</span>
                            <span style="font-weight: 600; color: var(--danger);">+${DataManager.formatCurrency(metrics.cyclePurchases)}</span>
                        </div>

                        ${metrics.cashAdvancePurchases > 0 ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-left: 12px; font-size: 12px;">
                            <span style="color: var(--warning); display: flex; align-items: center; gap: 4px;">
                                <span class="material-icons-round" style="font-size: 15px;">payments</span> Includes Cash Advance:
                            </span>
                            <span style="font-weight: 600; color: var(--warning);">${DataManager.formatCurrency(metrics.cashAdvancePurchases)} (Fee: ${DataManager.formatCurrency(metrics.cashAdvanceFees)} @ ${metrics.cashAdvanceFeePercent}%)</span>
                        </div>
                        ` : ''}

                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text-secondary);">Payments & Credits in this Cycle:</span>
                            <span style="font-weight: 600; color: var(--success);">${metrics.cyclePayments > 0 ? '-' : ''}${DataManager.formatCurrency(metrics.cyclePayments)}</span>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-light); padding-top: 10px;">
                            <span style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary);">
                                Estimated Finance Charges / Interest:
                                <span class="tag ${metrics.isGracePeriodActive && metrics.cashAdvanceInterest === 0 ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}" style="font-size: 10px; padding: 2px 6px;">
                                    ${metrics.cashAdvanceInterest > 0 ? `Cash Advance APR ${metrics.cashAdvanceApr}% (No Grace Period)` : (metrics.isGracePeriodActive ? 'Grace Period Active (0%)' : `APR ${activeCard.apr}%`)}
                                </span>
                            </span>
                            <span style="font-weight: 600; color: ${metrics.estimatedInterest > 0 ? 'var(--danger)' : 'var(--success)'};">
                                ${metrics.estimatedInterest > 0 ? '+' : ''}${DataManager.formatCurrency(metrics.estimatedInterest)}
                            </span>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-base); padding: 12px; border-radius: var(--radius-md); margin-top: 4px;">
                            <span style="font-weight: 600; font-size: 14px;">Total To Pay (To Avoid Interest):</span>
                            <span style="font-weight: 700; font-size: 16px; color: var(--primary);">${DataManager.formatCurrency(metrics.projectedStatementTotal)}</span>
                        </div>
                    </div>
                </div>

                <!-- Payoff & Interest Simulator Widget -->
                <div class="card animate-slide-up" style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                        <h4 style="font-size: 15px; font-weight: 600;">Payoff & Interest Scenario Simulator</h4>
                        <span style="font-size: 12px; color: var(--text-muted);">Test different payment amounts</span>
                    </div>

                    <div style="margin-bottom: 12px;">
                        <label style="font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 6px;">
                            If you pay on due date: <strong id="sim-pay-label" style="color: var(--primary); font-size: 14px;">${DataManager.formatCurrency(metrics.projectedStatementTotal)}</strong>
                        </label>
                        <input type="range" id="sim-slider" min="0" max="${Math.max(100, Math.ceil(metrics.projectedStatementTotal))}" step="10" value="${metrics.projectedStatementTotal}" style="width: 100%; cursor: pointer;"
                               oninput="
                                    const val = parseFloat(this.value);
                                    document.getElementById('sim-pay-label').textContent = DataManager.formatCurrency(val);
                                    const remaining = Math.max(0, ${metrics.projectedStatementTotal} - val);
                                    const estInterest = remaining > 0 ? (remaining * ${dailyApr} * 30) : 0;
                                    document.getElementById('sim-remaining-val').textContent = DataManager.formatCurrency(remaining);
                                    document.getElementById('sim-interest-val').textContent = DataManager.formatCurrency(estInterest);
                                    const graceEl = document.getElementById('sim-grace-status');
                                    if (remaining <= 0) {
                                        graceEl.innerHTML = '<span class=\\'tag bg-success-light text-success\\'>Preserved (0% Interest)</span>';
                                    } else {
                                        graceEl.innerHTML = '<span class=\\'tag bg-danger-light text-danger\\'>Lost (Interest will accrue)</span>';
                                    }
                               ">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; background: var(--bg-base); padding: 12px; border-radius: var(--radius-md); font-size: 12px;">
                        <div>
                            <div style="color: var(--text-secondary); margin-bottom: 2px;">Carried Balance</div>
                            <strong id="sim-remaining-val" style="font-size: 13px;">${DataManager.formatCurrency(0)}</strong>
                        </div>
                        <div>
                            <div style="color: var(--text-secondary); margin-bottom: 2px;">Next Month Interest</div>
                            <strong id="sim-interest-val" style="font-size: 13px; color: var(--danger);">${DataManager.formatCurrency(0)}</strong>
                        </div>
                        <div>
                            <div style="color: var(--text-secondary); margin-bottom: 2px;">Grace Period</div>
                            <div id="sim-grace-status">
                                <span class="tag bg-success-light text-success">Preserved (0% Interest)</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <!-- Recent Card Activity / Transactions Table -->
        <div class="card animate-slide-up" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                <div>
                    <h3 style="font-size: 16px; font-weight: 600;">Activity on ${activeCard.name}</h3>
                    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                        Showing purchases and bill payment credits (${metrics.cardTransactions.length} recorded)
                    </p>
                </div>
                <button class="btn btn-secondary" style="font-size: 13px; padding: 6px 12px;" onclick="app.showAddTransactionModal()">
                    <span class="material-icons-round" style="font-size: 16px;">add</span> Add Transaction
                </button>
            </div>

            ${metrics.cardTransactions.length === 0 ? `
                <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); font-size: 14px;">
                    No transactions recorded on this credit card yet.
                </div>
            ` : Components.transactionTable(metrics.cardTransactions.slice(0, 15))}
        </div>
    `;
};
