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
    addEventListener() {},
    getElementById(id) { return null; },
    querySelectorAll() { return []; }
};

// Evaluate scripts in the global context while preserving lexical identifiers and attaching to global
const evalFile = (path) => {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(/const\s+(DataManager|CreditCardManager|CreditCardsView|Components|CloudSync|appData|defaultData|savedData)\s*=/g, 'var $1 = global.$1 =');
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

    // Test 6: CSS animation fill-mode is both (prevents flash-before-animation)
    const cssContent = fs.readFileSync('./css/components.css', 'utf8').replace(/\r\n/g, '\n');
    assert(cssContent.includes('.animate-slide-up {\n    animation: slideInUp 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both;'), "CSS animate-slide-up must use both fill-mode");
    console.log("✔ CSS animation-fill-mode both test passed!");

    // Test 7: Dashboard view synchronous render and no animation-delay
    evalFile('./js/dashboard/dashboard.js');
    const dashboardHtml = global.Views.dashboard();
    assert(dashboardHtml.includes('id="dashboard-tx-container"'), "dashboard view should contain dashboard-tx-container");
    assert(!dashboardHtml.includes('animation-delay'), "dashboard view must not contain animation-delay");
    assert(!global.Views.loans().includes('animation-delay'), "loans view must not contain animation-delay");
    assert(!global.Views.tax().includes('animation-delay'), "tax view must not contain animation-delay");
    // Test 8: Tax view mobile table data-label attributes
    global.appData.transactions.push({
        id: 999,
        date: '2026-08-01',
        amount: -500,
        category: 'Food',
        merchant: 'Lunch Cafe',
        accountId: 1
    });
    const taxWithRows = global.Views.tax();
    assert(taxWithRows.includes('data-label="Date"'), "tax tables must include data-label='Date' for mobile responsiveness");
    assert(taxWithRows.includes('data-label="Payee"'), "tax allowable expenses table must include data-label='Payee' for mobile responsiveness");
    assert(taxWithRows.includes('data-label="Amount"'), "tax tables must include data-label='Amount' for mobile responsiveness");
    console.log("✔ Tax view mobile table data-label test passed!");

    // Test 9: CSS grid definitions and mobile responsiveness rules for tax
    const layoutCss = fs.readFileSync('./css/layout.css', 'utf8');
    assert(layoutCss.includes('.col-span-7 { grid-column: span 7; }'), "layout.css must define .col-span-7");
    assert(layoutCss.includes('.col-span-5 { grid-column: span 5; }'), "layout.css must define .col-span-5");
    assert(layoutCss.includes('overflow-x: hidden;'), "layout.css must prevent horizontal overflow on main content");
    assert(cssContent.includes('.tax-presets') && cssContent.includes('overflow-x: auto;'), "components.css must include mobile scrolling for tax-presets");
    assert(cssContent.includes('.tax-date-field'), "components.css must include .tax-date-field styling");
    assert(cssContent.includes('#tax-page-container'), "components.css must include #tax-page-container constraints");
    // Test 10: Credit Card Category Protection & Deduplication
    const initialCategories = global.DataManager.getCategories();
    assert(initialCategories.includes('Credit Card'), "Categories must include 'Credit Card'");
    
    // Attempting to delete 'Credit Card' must be blocked
    const deleteResult = global.DataManager.deleteCategory('Credit Card', 'Shopping');
    assert(deleteResult === false, "Deleting 'Credit Card' category must return false");
    assert(global.DataManager.getCategories().includes('Credit Card'), "'Credit Card' must still exist after delete attempt");

    // Attempting to rename 'Credit Card' must be blocked
    const editResult = global.DataManager.editCategory('Credit Card', 'My Credit Cards');
    assert(editResult === false, "Renaming 'Credit Card' category must return false");
    assert(global.DataManager.getCategories().includes('Credit Card'), "'Credit Card' must not be renamed");

    // Attempting to rename another category to 'Credit Card' must be blocked
    const editCollisionResult = global.DataManager.editCategory('Shopping', 'Credit Card');
    assert(editCollisionResult === false, "Renaming another category to 'Credit Card' must return false");

    // Deduplication check: adding 'credit card' (case-insensitive) must be rejected
    const addDuplicateResult = global.DataManager.addCategory('credit card');
    assert(addDuplicateResult === false, "Adding lowercase duplicate 'credit card' must return false");
    console.log("✔ Credit Card category protection & deduplication test passed!");

    // Test 11: CreditCardManager card creation and account synchronization
    const createdCard = global.CreditCardManager.saveCreditCard({
        name: 'Sapphire Preferred',
        bank: 'Chase',
        last4: '4128',
        creditLimit: 10000,
        apr: 24.0,
        billingCycleDay: 15,
        gracePeriodDays: 25,
        minPaymentPercent: 3.5,
        minPaymentFloor: 25,
        colorTheme: 'obsidian'
    });
    assert(createdCard && createdCard.id, "Credit card must be created with valid ID");
    assert(createdCard.creditLimit === 10000, "Credit limit must be 10000");
    const linkedAccount = global.DataManager.getAccountById(createdCard.accountId);
    assert(linkedAccount && linkedAccount.type === 'Credit', "Linked account must be created with type 'Credit'");
    console.log("✔ CreditCardManager card creation and account synchronization test passed!");

    // Test 12: Billing Cycle and Bill Projection calculation
    // Reference date: Sep 10, 2026 (Before statement day 15)
    const refDateBeforeCut = new Date(2026, 8, 10); // Sep 10, 2026
    const cycleBeforeCut = global.CreditCardManager.getCardBillingCycle(createdCard, refDateBeforeCut);
    assert(cycleBeforeCut.daysUntilCut === 5, "Days until cut should be 5 days when refDate is Sep 10 and cut is Sep 15");
    assert(cycleBeforeCut.daysUntilDue === 30, "Days until due should be 30 days (5 + 25 grace days)");

    // Add purchase transaction within this cycle on the card
    global.DataManager.addTransaction({
        date: '2026-09-05',
        merchant: 'Electronics Store',
        category: 'Shopping',
        amount: -800,
        accountId: createdCard.accountId,
        status: 'Completed'
    });

    const metrics1 = global.CreditCardManager.getCardMetrics(createdCard, refDateBeforeCut);
    assert(metrics1.totalOutstanding === 800, "Outstanding balance should be 800");
    assert(metrics1.cyclePurchases === 800, "Cycle purchases should be 800");
    assert(metrics1.isGracePeriodActive === true, "Grace period should be active since no prior unpaid balance");
    assert(metrics1.estimatedInterest === 0, "Estimated interest should be 0 during grace period");
    assert(metrics1.projectedStatementTotal === 800, "Projected statement total should be 800");
    assert(metrics1.utilizationRate === 8.0, "Utilization should be 8.0% (800 / 10000)");
    assert(metrics1.healthStatus === 'optimal', "Health status should be optimal (<30%)");
    console.log("✔ Billing cycle and grace period bill projection test passed!");

    // Test 13: Card Payment handling via Category 'Credit Card'
    // Create a checking account to pay from
    const checkingAcc = { id: 888, name: 'Checking Account', type: 'Checking', balance: 5000, color: 'var(--primary)' };
    global.appData.accounts.push(checkingAcc);

    // Record payment of $500 towards credit card
    const paymentSuccess = global.CreditCardManager.recordCardPayment({
        fromAccountId: checkingAcc.id,
        cardId: createdCard.id,
        amount: 500,
        date: '2026-09-08',
        note: 'Monthly Payment'
    });
    assert(paymentSuccess === true, "recordCardPayment must return true");

    // Verify balances updated seamlessly
    assert(checkingAcc.balance === 4500, "Checking balance should be reduced by 500");
    const updatedLinkedAccount = global.DataManager.getAccountById(createdCard.accountId);
    assert(updatedLinkedAccount.balance === -300, "Card balance should be -300 (debt reduced from 800 to 300)");

    const metricsAfterPayment = global.CreditCardManager.getCardMetrics(createdCard, refDateBeforeCut);
    assert(metricsAfterPayment.totalOutstanding === 300, "Outstanding balance after payment should be 300");
    assert(metricsAfterPayment.cyclePayments === 500, "Cycle payments should be 500");
    assert(metricsAfterPayment.projectedStatementTotal === 300, "Projected statement total should now be 300");
    assert(metricsAfterPayment.utilizationRate === 3.0, "Utilization should drop to 3.0%");
    console.log("✔ Credit Card payment flow and real-time metrics update test passed!");

    // Test 14: Credit Cards view synchronous initial render
    evalFile('./js/credit-cards/credit-cards.js');
    const ccHtml = global.Views['credit-cards']();
    assert(ccHtml.includes('Projected Next Statement Bill'), "credit-cards view should contain Projected Next Statement Bill");
    assert(ccHtml.includes('virtual-card-container'), "credit-cards view should contain virtual-card-container");
    assert(ccHtml.includes('Sapphire Preferred'), "credit-cards view should contain active card name");
    assert(ccHtml.includes('Activity on Sapphire Preferred'), "credit-cards view should contain card activity table");
    console.log("✔ Credit Cards view synchronous initial render test passed!");

    // Test 15: Cash Advance via transferFunds (from credit card to checking account)
    const todayStr = global.DataManager.getLocalDateString();
    const checkingBeforeCA = checkingAcc.balance;
    const cardAccBeforeCA = global.DataManager.getAccountById(createdCard.accountId).balance;
    const caTransferSuccess = global.DataManager.transferFunds(createdCard.accountId, checkingAcc.id, 1000, todayStr, 'Emergency cash');
    assert(caTransferSuccess === true, "transferFunds for Cash Advance should succeed");

    assert(checkingAcc.balance === checkingBeforeCA + 1000, "Checking account should gain $1000 from cash advance");
    assert(global.DataManager.getAccountById(createdCard.accountId).balance === cardAccBeforeCA - 1000, "Card balance should drop by $1000 (debt increases to 1300)");

    // Verify cash advance transaction attributes
    const caTx = global.appData.transactions.find(t => t.accountId === createdCard.accountId && t.isCashAdvance === true);
    assert(caTx !== undefined, "Transaction should be flagged with isCashAdvance: true");
    assert(caTx.merchant.startsWith('Cash Advance:'), "Merchant title should start with 'Cash Advance:'");
    assert(caTx.targetCardId === createdCard.id, "Cash advance transaction should be tagged with targetCardId");

    // Metrics check for cash advance fees and immediate interest
    const metricsAfterCA = global.CreditCardManager.getCardMetrics(createdCard);
    assert(metricsAfterCA.cashAdvancePurchases === 1000, "cashAdvancePurchases should be 1000");
    assert(metricsAfterCA.cashAdvanceFees === 30, "cashAdvanceFees should be $30 (3% of $1000)");
    assert(metricsAfterCA.cashAdvanceInterest > 0, "cashAdvanceInterest should be greater than 0 due to zero grace period");
    assert(metricsAfterCA.estimatedInterest >= 30, "Estimated interest/finance charges must include at least $30 fee");

    // Verify Cash Advance row renders in credit cards view
    const ccHtmlWithCA = global.Views['credit-cards']();
    assert(ccHtmlWithCA.includes('Includes Cash Advance:'), "View should render Cash Advance row");
    assert(ccHtmlWithCA.includes('Cash Advance APR'), "View should indicate Cash Advance APR with no grace period");
    console.log("✔ Cash advance transfer, fee calculation, immediate interest, and UI row test passed!");

    // Test 16: Refund / Income transaction on Credit Card
    const cardAccBeforeRefund = global.DataManager.getAccountById(createdCard.accountId).balance;
    global.DataManager.addTransaction({
        date: todayStr,
        merchant: `Refund / Credit to ${createdCard.name} (···${createdCard.last4})`,
        category: 'Credit Card',
        amount: 200, // Income/refund
        accountId: createdCard.accountId,
        targetCardId: createdCard.id,
        status: 'Completed'
    });
    assert(global.DataManager.getAccountById(createdCard.accountId).balance === cardAccBeforeRefund + 200, "Card balance should increase by 200 upon refund");
    const metricsAfterRefund = global.CreditCardManager.getCardMetrics(createdCard);
    assert(metricsAfterRefund.totalOutstanding === 1100, "Outstanding balance should reflect the $200 refund reduction");
    console.log("✔ Credit Card refund/credit income transaction test passed!");

    // Test 17: Custom configured Cash Advance fee and APR
    const customCard = global.CreditCardManager.saveCreditCard({
        name: 'Gold Rewards',
        bank: 'Amex',
        last4: '1004',
        creditLimit: 15000,
        apr: 22.0,
        cashAdvanceFee: 5.0, // 5% custom fee
        cashAdvanceApr: 29.99, // 29.99% custom APR
        billingCycleDay: 20
    });
    assert(customCard.cashAdvanceFee === 5.0, "Card should save custom cash advance fee of 5.0%");
    assert(customCard.cashAdvanceApr === 29.99, "Card should save custom cash advance APR of 29.99%");

    // Transfer cash advance from customCard
    global.DataManager.transferFunds(customCard.accountId, checkingAcc.id, 500, todayStr, 'Test custom cash advance');
    const customMetrics = global.CreditCardManager.getCardMetrics(customCard);
    assert(customMetrics.cashAdvanceFees === 25.0, "Cash advance fee should be $25 (5% of $500)");
    assert(customMetrics.cashAdvanceApr === 29.99, "Cash advance APR should be 29.99%");
    console.log("✔ Custom configured Cash Advance fee and APR test passed!");

    // Test 18: HTML escaping helper verification
    const rawXss = '<script>alert("xss")</script>';
    const escapedXss = global.DataManager.escapeHtml(rawXss);
    assert(escapedXss === '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', "escapeHtml should escape <, >, and quotes");
    const rawQuotes = "Chase 'Freedom' & Co.";
    const escapedQuotes = global.DataManager.escapeHtml(rawQuotes);
    assert(escapedQuotes === 'Chase &#39;Freedom&#39; &amp; Co.', "escapeHtml should escape single quotes and ampersands");
    console.log("✔ HTML escaping helper verification test passed!");

    // Test 19: Timezone local date parsing verification
    const parsedLocal = global.DataManager.parseLocalDate('2026-09-16');
    assert(parsedLocal.getFullYear() === 2026, "parseLocalDate year should be 2026");
    assert(parsedLocal.getMonth() === 8, "parseLocalDate month should be 8 (September)");
    assert(parsedLocal.getDate() === 16, "parseLocalDate day should be 16");
    console.log("✔ Timezone local date parsing verification test passed!");

    // Test 20: syncWithAccounts filters out non-credit accounts
    const fakeCheckingAcc = { id: 9991, name: 'Fake Checking', type: 'Checking', balance: 1000 };
    global.appData.accounts.push(fakeCheckingAcc);
    global.appData.creditCards.push({ id: 9992, accountId: fakeCheckingAcc.id, name: 'Orphan Card' });
    global.CreditCardManager.syncWithAccounts();
    assert(!global.appData.creditCards.some(c => c.id === 9992), "Cards linked to non-credit accounts must be filtered out");
    console.log("✔ syncWithAccounts non-credit account filtering test passed!");

    // Test 21: Deleting a card cascades and deletes associated transactions
    const txCountBeforeDelete = global.appData.transactions.length;
    const cardTxCount = global.appData.transactions.filter(t => t.accountId === customCard.accountId || t.targetCardId === customCard.id).length;
    assert(cardTxCount > 0, "There should be transactions recorded for customCard");
    const deleteSuccess = global.CreditCardManager.deleteCreditCard(customCard.id);
    assert(deleteSuccess === true, "deleteCreditCard should return true");
    assert(!global.appData.creditCards.some(c => c.id === customCard.id), "customCard should be removed from creditCards");
    assert(!global.appData.accounts.some(a => a.id === customCard.accountId), "Linked account should be removed from accounts");
    const remainingCardTx = global.appData.transactions.filter(t => t.accountId === customCard.accountId || t.targetCardId === customCard.id);
    assert(remainingCardTx.length === 0, "All transactions linked to deleted card must be removed");
    console.log("✔ Deleting credit card cascading transaction cleanup test passed!");

    console.log("All tests passed successfully!");
})();
