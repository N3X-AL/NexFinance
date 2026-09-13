const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Create mock global object
global.window = global;
global.Views = {};
global.localStorage = {
    _data: {},
    getItem(key) { return this._data[key] || null; },
    setItem(key, val) { this._data[key] = String(val); },
    removeItem(key) { delete this._data[key]; }
};
global.document = {
    addEventListener() {}
};

// Evaluate scripts in the global context while preserving lexical identifiers and attaching to global
const evalFile = (path) => {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(/const\s+(DataManager|Components|CloudSync|appData|defaultData|savedData)\s*=/g, 'var $1 = global.$1 =');
    vm.runInThisContext(code);
};

evalFile('./js/data.js');
evalFile('./js/components.js');
evalFile('./js/loans/loans.js');

console.log("Running Loan History Sorting Tests...");

// Reset Data in DataManager
const loans = global.DataManager.getLoans();
loans.length = 0;
global.appData.transactions.length = 0;

// Add loan
global.DataManager.addLoan({
    person: 'Alice',
    type: 'given',
    amount: 5000,
    date: '2026-01-01',
    description: 'Initial loan'
}, 1);

const createdLoan = global.DataManager.getLoans()[0];

// Record repayments in non-chronological order
global.DataManager.recordLoanRepayment(createdLoan.id, 300, 1, false, 'Part 1', '2026-01-05');
global.DataManager.recordLoanRepayment(createdLoan.id, 700, 1, false, 'Part 3', '2026-01-15');
global.DataManager.recordLoanRepayment(createdLoan.id, 500, 1, false, 'Part 2', '2026-01-10');

const personData = {
    name: 'Alice',
    activeLoans: [createdLoan],
    settledLoans: [],
    netBalance: 3500
};

const cardHtml = global.Components.personLoanCard(personData);

// Check order of repayment descriptions in rendered HTML
const posPart3 = cardHtml.indexOf('Part 3');
const posPart2 = cardHtml.indexOf('Part 2');
const posPart1 = cardHtml.indexOf('Part 1');

assert(posPart3 !== -1 && posPart2 !== -1 && posPart1 !== -1, "All repayments should be rendered");
assert(posPart3 < posPart2, "Part 3 (Jan 15) should appear before Part 2 (Jan 10)");
assert(posPart2 < posPart1, "Part 2 (Jan 10) should appear before Part 1 (Jan 5)");

console.log("✔ Repayment history descending order test passed!");

// Test 2: Settled Loans list sorting
loans.length = 0;
global.appData.transactions.length = 0;
global.DataManager.addLoan({ person: 'Bob', type: 'given', amount: 1000, date: '2026-02-01', description: 'Old Loan' }, 1);
const oldLoan = global.DataManager.getLoans()[0];
global.DataManager.recordLoanRepayment(oldLoan.id, 1000, 1, false, 'Full Pay', '2026-02-01');

global.DataManager.addLoan({ person: 'Bob', type: 'given', amount: 2000, date: '2026-02-20', description: 'New Loan' }, 1);
const newLoan = global.DataManager.getLoans().find(l => l.description === 'New Loan');
global.DataManager.recordLoanRepayment(newLoan.id, 2000, 1, false, 'Full Pay', '2026-02-20');

const viewHtml = global.Views.loans();
const posNewLoan = viewHtml.indexOf('New Loan');
const posOldLoan = viewHtml.indexOf('Old Loan');

assert(posNewLoan !== -1 && posOldLoan !== -1, "Both settled loans should be rendered");
assert(posNewLoan < posOldLoan, "New Loan (Feb 20) should appear before Old Loan (Feb 1)");

console.log("✔ Settled loans list descending order test passed!");

// Test 3: CloudSync returns false if data is identical (preventing duplicate UI render)
(async () => {
    global.CloudSync.isConfigured = () => true;
    global.CloudSync.getGistId = () => 'test-gist-id';
    global.CloudSync.pullFromGist = async () => JSON.parse(JSON.stringify(global.appData));

    const syncedWhenIdentical = await global.DataManager.syncFromCloud();
    assert.strictEqual(syncedWhenIdentical, false, "syncFromCloud should return false when remote data is identical");
    console.log("✔ CloudSync duplicate render prevention test passed!");

    // Test when remote data is different
    const differentRemoteData = JSON.parse(JSON.stringify(global.appData));
    differentRemoteData.currency = 'EUR';
    global.CloudSync.pullFromGist = async () => differentRemoteData;

    const syncedWhenDifferent = await global.DataManager.syncFromCloud();
    assert.strictEqual(syncedWhenDifferent, true, "syncFromCloud should return true when remote data differs");
    assert.strictEqual(global.appData.currency, 'EUR', "appData should be updated with new currency");
    console.log("✔ CloudSync sync on actual changes test passed!");

    // Test 4: Tax view synchronous initial render
    evalFile('./js/tax/tax.js');
    const taxHtml = global.Views.tax();
    assert(taxHtml.includes('id="tax-dynamic-content"'), "tax view should contain dynamic content container");
    assert(!taxHtml.includes('<!-- Injected via renderTaxDashboard() -->'), "tax view should not have empty placeholder comment");
    assert(taxHtml.includes('Itemized Allowable Expenses Audit'), "tax view should render audit section synchronously");
    console.log("✔ Tax view synchronous initial render test passed!");

    // Test 5: Transactions view synchronous initial render
    evalFile('./js/transactions/transactions.js');
    const txHtml = global.Views.transactions();
    assert(txHtml.includes('id="transactions-page-container"'), "transactions view should contain transactions-page-container");
    console.log("✔ Transactions view synchronous initial render test passed!");

    console.log("All tests passed successfully!");
})();
