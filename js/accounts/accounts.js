Views.accounts = () => {
    return `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
            <button class="btn btn-secondary" onclick="app.showTransferFundsModal()">
                <span class="material-icons-round">swap_horiz</span>
                Transfer Funds
            </button>
        </div>
        <div class="grid-cols-3">
            ${appData.accounts.map(acc => Components.accountCard(acc)).join('')}
            
            <div class="card animate-slide-up" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 160px; cursor: pointer; border: 1px dashed var(--text-muted); background: transparent;" onclick="app.showAddAccountModal()">
                <div style="width: 48px; height: 48px; border-radius: var(--radius-full); background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: var(--primary);">
                    <span class="material-icons-round">add</span>
                </div>
                <div style="font-weight: 500;">Add New Account</div>
            </div>
        </div>
    `;
};
