Views.settings = () => {
    let currencies = [];
    if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
        try {
            const codes = Intl.supportedValuesOf('currency');
            currencies = codes.map(code => {
                const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, maximumFractionDigits: 0 });
                const parts = formatter.formatToParts(0);
                const symbolPart = parts.find(p => p.type === 'currency');
                const symbol = symbolPart ? symbolPart.value : code;
                return { code, label: `${code} (${symbol})` };
            });
        } catch (e) {
            console.warn('Could not generate dynamic currencies', e);
        }
    }
    
    if (currencies.length === 0) {
        // Fallback to basic list if API is unavailable
        currencies = [
            { code: 'USD', label: 'USD ($)' },
            { code: 'EUR', label: 'EUR (€)' },
            { code: 'GBP', label: 'GBP (£)' },
            { code: 'JPY', label: 'JPY (¥)' },
            { code: 'INR', label: 'INR (₹)' },
            { code: 'CAD', label: 'CAD ($)' },
            { code: 'AUD', label: 'AUD ($)' },
            { code: 'CHF', label: 'CHF (CHF)' },
            { code: 'CNY', label: 'CNY (¥)' }
        ];
    }

    const currentCurrency = DataManager.getCurrency();
    const currencyOptions = currencies.map(c => 
        `<option value="${c.code}" ${c.code === currentCurrency ? 'selected' : ''}>${c.label}</option>`
    ).join('');

    return `
    <div class="card animate-slide-up" style="max-width: 600px; margin: 0 auto;">
        <div class="card-header">
            <h3 class="card-title">Data Management</h3>
        </div>
        
        <div style="margin-bottom: 24px;">
            <p style="color: var(--text-secondary); margin-bottom: 16px;">Import your financial data from other applications like Everplan, EveryDollar, or Mint. We support <strong>CSV</strong> files or direct <strong>SQLite3 database files</strong>.</p>
            
            <div style="border: 1px dashed var(--border); padding: 24px; border-radius: var(--radius-md); text-align: center; background: var(--bg-surface-hover);">
                <input type="file" id="csv-upload" accept=".csv,.sqlite,.sqlite3,.db" style="display: none;" onchange="app.handleFileUpload(event)">
                <button class="btn btn-primary" onclick="document.getElementById('csv-upload').click()">
                    <span class="material-icons-round">upload_file</span> Select File
                </button>
                <p style="font-size: 13px; color: var(--text-muted); margin-top: 12px;" id="upload-status">No file chosen</p>
            </div>
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--border); margin: 24px 0;">
        
        <div>
            <h4 style="margin-bottom: 12px;">App Preferences</h4>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
                <div>
                    <div style="font-weight: 500;">Currency</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">Select your preferred currency</div>
                </div>
                <select class="form-control" style="width: 120px;" onchange="app.changeCurrency(this.value)">
                    ${currencyOptions}
                </select>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; margin-top: 12px; border-top: 1px solid var(--border-light);">
                <div>
                    <div style="font-weight: 500;">Dark Mode</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">Toggle application theme</div>
                </div>
                <button class="btn btn-secondary"><span class="material-icons-round">dark_mode</span></button>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; margin-top: 12px; border-top: 1px solid var(--border-light);">
                <div>
                    <div style="font-weight: 500; color: var(--danger);">Danger Zone</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">Permanently delete all your data and start fresh</div>
                </div>
                <button class="btn btn-danger" onclick="app.resetData()"><span class="material-icons-round">delete_forever</span> Reset Data</button>
            </div>
        </div>
    </div>
    `;
};
