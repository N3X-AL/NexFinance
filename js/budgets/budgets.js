Views.budgets = () => {
    return `
        <div class="card animate-slide-up" style="margin-bottom: 24px;">
            <div class="card-header">
                <h3 class="card-title">Monthly Budget Overview</h3>
                <button class="btn btn-primary"><span class="material-icons-round" style="font-size: 18px;">add</span> New Budget</button>
            </div>
            <div class="grid-cols-2">
                ${appData.budgets.map(b => Components.budgetCard(b)).join('')}
            </div>
        </div>
    `;
};
