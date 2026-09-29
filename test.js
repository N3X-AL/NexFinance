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

    // Test 22: recordCardPayment preserves "Payment to [Card] (···last4)" prefix with note
    const testCard = global.CreditCardManager.saveCreditCard({
        name: 'Sapphire Preferred',
        bank: 'Chase',
        last4: '5566',
        creditLimit: 5000,
        apr: 24.99,
        billingCycleDay: 15,
        gracePeriodDays: 25
    });
    const checkingAcc2 = { id: 8881, name: 'Main Checking', type: 'Checking', balance: 5000 };
    global.appData.accounts.push(checkingAcc2);
    global.CreditCardManager.recordCardPayment({
        fromAccountId: checkingAcc2.id,
        cardId: testCard.id,
        amount: 250,
        date: '2026-09-10',
        note: 'Statement Balance'
    });
    const paymentTxRecord = global.appData.transactions.find(t => t.targetCardId === testCard.id && t.amount === -250);
    assert(paymentTxRecord, "Payment transaction must be recorded");
    assert(paymentTxRecord.merchant.startsWith('Payment to Sapphire Preferred (···5566)'), "Merchant description must preserve the Payment to [Card] (···last4) prefix");
    assert(paymentTxRecord.merchant === 'Payment to Sapphire Preferred (···5566) (Statement Balance)', "Merchant description must append the note in parentheses");
    console.log("✔ recordCardPayment note formatting test passed!");

    // Test 23: Dashboard metrics exclude credit cards and credit card transactions
    const initialMoneyInHand = global.DataManager.getMoneyInHand();
    const initialNetWorth = global.DataManager.getNetWorth();
    const initialExpenses = global.DataManager.getMonthlyExpenses();
    const initialIncome = global.DataManager.getMonthlyIncome();

    // Verify checking account is included in money in hand
    assert(initialMoneyInHand >= 4750, "Money in hand must include checking account");
    // Verify credit card account balance (debt) does NOT reduce money in hand
    const cardAcc = global.DataManager.getAccountById(testCard.accountId);
    assert(cardAcc && cardAcc.balance === 250, "Credit card account exists");
    // Simulate debt on card
    cardAcc.balance = -1500;
    const moneyInHandAfterCardDebt = global.DataManager.getMoneyInHand();
    assert(moneyInHandAfterCardDebt === initialMoneyInHand, "Money in hand must NOT be reduced by credit card debt");

    // Add a retail purchase on the credit card
    const cardPurchaseTx = {
        id: 7771,
        date: '2026-09-12',
        merchant: 'Best Buy',
        category: 'Electronics',
        amount: -800,
        accountId: testCard.accountId,
        status: 'Completed'
    };
    global.DataManager.addTransaction(cardPurchaseTx);
    const expensesAfterCardPurchase = global.DataManager.getMonthlyExpenses();
    assert(expensesAfterCardPurchase === initialExpenses, "Dashboard monthly expenses must NOT include credit card purchases");

    // Add a credit card refund
    const cardRefundTx = {
        id: 7772,
        date: '2026-09-14',
        merchant: 'Refund / Credit to Sapphire Preferred (···5566)',
        category: 'Credit Card',
        amount: 200,
        accountId: testCard.accountId,
        status: 'Completed'
    };
    global.DataManager.addTransaction(cardRefundTx);
    const incomeAfterCardRefund = global.DataManager.getMonthlyIncome();
    assert(incomeAfterCardRefund === initialIncome, "Dashboard monthly income must NOT include credit card refunds");

    // Verify dashboard recent transactions exclude credit card transactions
    const dashboardTxs = global.DataManager.getDashboardTransactions();
    assert(!dashboardTxs.some(t => t.id === 7771 || t.id === 7772), "Dashboard transactions must exclude credit card transactions");
    console.log("✔ Dashboard credit card metrics exclusion test passed!");

    // Test 24: Transfer deletion history decoupling (no phantom money and preserved history)
    const testCheckingAcc = { id: 5001, name: 'Payroll Checking', type: 'Checking', balance: 3000 };
    const testSavingsAcc = { id: 5002, name: 'High Yield Savings', type: 'Savings', balance: 1000 };
    global.appData.accounts.push(testCheckingAcc, testSavingsAcc);
    const transferTx = {
        id: 5003,
        date: '2026-09-15',
        merchant: 'Transfer to High Yield Savings',
        category: 'Transfer',
        amount: -500,
        accountId: testCheckingAcc.id,
        toAccountId: testSavingsAcc.id,
        status: 'Completed'
    };
    global.DataManager.addTransaction(transferTx);
    assert(testCheckingAcc.balance === 2500, "Checking balance debited by 500");
    assert(testSavingsAcc.balance === 1500, "Savings balance credited by 500");

    // Delete savings account
    global.DataManager.deleteAccount(testSavingsAcc.id);
    assert(!global.appData.accounts.some(a => a.id === testSavingsAcc.id), "Savings account removed");
    // Verify checking account was NOT falsely refunded (no phantom money)
    assert(testCheckingAcc.balance === 2500, "Checking balance must remain 2500 (no phantom reversal)");
    // Verify transaction remains in history for checking account, with toAccountId decoupled
    const preservedTx = global.appData.transactions.find(t => t.id === 5003);
    assert(preservedTx, "Transfer transaction must be preserved in ledger history for checking");
    assert(preservedTx.toAccountId === null, "toAccountId must be decoupled to null");
    assert(preservedTx.accountId === testCheckingAcc.id, "Transaction must still belong to checking account");
    console.log("✔ Transfer deletion history decoupling test passed!");

    // Test 25: Payment & Transfer edit accounting reconciles both source and destination accounts
    const cardAlpha = global.CreditCardManager.saveCreditCard({
        name: 'Card Alpha',
        bank: 'Bank A',
        last4: '1111',
        creditLimit: 3000,
        apr: 20
    });
    const cardBeta = global.CreditCardManager.saveCreditCard({
        name: 'Card Beta',
        bank: 'Bank B',
        last4: '2222',
        creditLimit: 3000,
        apr: 20
    });
    const cardAlphaAcc = global.DataManager.getAccountById(cardAlpha.accountId);
    const cardBetaAcc = global.DataManager.getAccountById(cardBeta.accountId);
    cardAlphaAcc.balance = -1000; // owes 1000
    cardBetaAcc.balance = -1000;  // owes 1000

    // Record $400 payment from testCheckingAcc to cardAlpha
    const initialCheckingBal = testCheckingAcc.balance;
    const paymentToAlpha = {
        id: 6001,
        date: '2026-09-16',
        merchant: 'Payment to Card Alpha (···1111)',
        category: 'Credit Card',
        amount: -400,
        accountId: testCheckingAcc.id,
        toAccountId: cardAlpha.accountId,
        targetCardId: cardAlpha.id,
        status: 'Completed'
    };
    global.DataManager.addTransaction(paymentToAlpha);
    assert(testCheckingAcc.balance === initialCheckingBal - 400, "Checking balance reduced by 400");
    assert(cardAlphaAcc.balance === -600, "Card Alpha balance increased from -1000 to -600");
    assert(cardBetaAcc.balance === -1000, "Card Beta balance unchanged");

    // Now edit the payment: change amount to 500 and target to cardBeta
    global.DataManager.editTransaction(paymentToAlpha.id, {
        amount: -500,
        accountId: testCheckingAcc.id,
        toAccountId: cardBeta.accountId,
        targetCardId: cardBeta.id,
        merchant: 'Payment to Card Beta (···2222)'
    });
    // Verify Checking reflects the new $500 payment (additional $100 deducted)
    assert(testCheckingAcc.balance === initialCheckingBal - 500, "Checking balance should reflect 500 total payment");
    // Verify Card Alpha reverted back to -1000 (debt restored)
    assert(cardAlphaAcc.balance === -1000, "Card Alpha balance must revert back to -1000");
    // Verify Card Beta credited with 500 (balance changed from -1000 to -500)
    assert(cardBetaAcc.balance === -500, "Card Beta balance must receive the 500 credit to -500");
    console.log("✔ Payment & Transfer edit accounting reconciliation test passed!");

    // Test 26: Carried balance remaining calculation and grace period protection
    const carriedTestCard = global.CreditCardManager.saveCreditCard({
        name: 'Carried Test Card',
        bank: 'Bank C',
        last4: '3333',
        creditLimit: 2000,
        apr: 24.0,
        billingCycleDay: 10,
        gracePeriodDays: 25
    });
    const carriedCardAcc = global.DataManager.getAccountById(carriedTestCard.accountId);
    // Scenario 1: User had $200 debt from prior statement. In current cycle, user paid off $200 with 0 new purchases.
    // Account balance is now $0.
    carriedCardAcc.balance = 0;
    // Current cycle payment recorded:
    global.appData.transactions.push({
        id: 7001,
        date: '2026-09-15',
        merchant: 'Payment to Carried Test Card (···3333)',
        category: 'Credit Card',
        amount: -200,
        accountId: testCheckingAcc.id,
        toAccountId: carriedTestCard.accountId,
        targetCardId: carriedTestCard.id,
        status: 'Completed'
    });
    const metricsFullyPaid = global.CreditCardManager.getCardMetrics(carriedTestCard, new Date('2026-09-20'));
    assert(metricsFullyPaid.totalOutstanding === 0, "Total outstanding should be 0");
    assert(metricsFullyPaid.priorUnpaid === 0, "Prior unpaid carried balance must be 0 when card is paid off");
    assert(metricsFullyPaid.isGracePeriodActive === true, "Grace period must remain active when statement was fully paid");
    assert(metricsFullyPaid.estimatedInterest === 0, "No interest should be charged when fully paid");

    // Scenario 2: User had prior debt and only partially paid: owes $150 now, made $50 purchases this cycle -> carried balance is 100
    carriedCardAcc.balance = -150;
    global.appData.transactions.push({
        id: 7002,
        date: '2026-09-18',
        merchant: 'Store Purchase',
        category: 'Shopping',
        amount: -50,
        accountId: carriedTestCard.accountId,
        status: 'Completed'
    });
    const metricsPartialPaid = global.CreditCardManager.getCardMetrics(carriedTestCard, new Date('2026-09-20'));
    assert(metricsPartialPaid.totalOutstanding === 150, "Total outstanding should be 150");
    assert(metricsPartialPaid.cyclePurchases === 50, "Cycle purchases should be 50");
    assert(metricsPartialPaid.priorUnpaid === 100, "Prior unpaid carried balance must be 150 - 50 = 100");
    assert(metricsPartialPaid.isGracePeriodActive === false, "Grace period should be lost when prior balance is carried");
    assert(metricsPartialPaid.estimatedInterest > 0, "Interest should accrue on carried balance");
    console.log("✔ Carried balance remaining calculation test passed!");

    // Test 27: Flow analytics excludes internal card transfers and credits
    const regularTransactions = global.DataManager.getRegularTransactions();
    // Verify retail shopping purchase (-50) on card IS in regular transactions
    assert(regularTransactions.some(t => t.id === 7002), "Retail card purchase must be included in regular transactions");
    // Verify internal card payment (-200) and card refund are NOT in regular transactions
    assert(!regularTransactions.some(t => t.id === 7001), "Internal card payment must NOT be in regular transactions");
    assert(!regularTransactions.some(t => t.id === 7772), "Card refund must NOT be in regular transactions");
    console.log("✔ Flow analytics card payment and refund exclusion test passed!");

    // Test 28: Short month billing cycle calculation (e.g. cycleDay 31 with Feb 28 cut)
    const monthEndCard = {
        id: 9999,
        billingCycleDay: 31,
        gracePeriodDays: 25
    };
    // March 15, 2026: prior cycle ended on Feb 28, 2026.
    // Cycle start should be March 1, 2026, 00:00:00 (NOT Feb 28).
    const marchCycle = global.CreditCardManager.getCardBillingCycle(monthEndCard, new Date(2026, 2, 15));
    assert(marchCycle.startDate.getFullYear() === 2026 && marchCycle.startDate.getMonth() === 2 && marchCycle.startDate.getDate() === 1,
        `March cycle start should be March 1, got ${marchCycle.startDate.toISOString()}`);
    assert(marchCycle.endDate.getFullYear() === 2026 && marchCycle.endDate.getMonth() === 2 && marchCycle.endDate.getDate() === 31,
        `March cycle end should be March 31, got ${marchCycle.endDate.toISOString()}`);

    // May 5, 2026: prior cycle ended on April 30, 2026.
    // Cycle start should be May 1, 2026, 00:00:00.
    const mayCycle = global.CreditCardManager.getCardBillingCycle(monthEndCard, new Date(2026, 4, 5));
    assert(mayCycle.startDate.getFullYear() === 2026 && mayCycle.startDate.getMonth() === 4 && mayCycle.startDate.getDate() === 1,
        `May cycle start should be May 1, got ${mayCycle.startDate.toISOString()}`);
    assert(mayCycle.endDate.getFullYear() === 2026 && mayCycle.endDate.getMonth() === 4 && mayCycle.endDate.getDate() === 31,
        `May cycle end should be May 31, got ${mayCycle.endDate.toISOString()}`);
    console.log("✔ Short month billing cycle calculation test passed!");

    // Test 29: Credit card deletion decouples targetCardId on surviving payments
    const deleteTestCard = global.CreditCardManager.saveCreditCard({
        name: 'Delete Target Card',
        bank: 'Bank Del',
        last4: '9999',
        creditLimit: 1000
    });
    const survivingCheckingAcc = {
        id: 9988,
        name: 'Surviving Checking',
        type: 'Checking',
        balance: 1000
    };
    global.appData.accounts.push(survivingCheckingAcc);
    const paymentToDeletedCard = {
        id: 8888,
        date: '2026-09-20',
        merchant: 'Payment to Delete Target Card (···9999)',
        category: 'Credit Card',
        amount: -250,
        accountId: survivingCheckingAcc.id,
        toAccountId: deleteTestCard.accountId,
        targetCardId: deleteTestCard.id,
        status: 'Completed'
    };
    global.DataManager.addTransaction(paymentToDeletedCard);
    assert(survivingCheckingAcc.balance === 750, "Checking balance reduced by 250");

    // Delete the credit card
    global.CreditCardManager.deleteCreditCard(deleteTestCard.id);

    // Verify surviving checking account still has the payment transaction with targetCardId decoupled
    const decoupledTx = global.appData.transactions.find(t => t.id === 8888);
    assert(decoupledTx !== undefined, "Payment transaction must survive card deletion");
    // Test 30: Deleting or editing a decoupled transaction does not refund balance (no phantom money)
    assert(decoupledTx.isDecoupled === true, "decoupledTx must have isDecoupled flag");
    // Attempt to edit decoupled transaction amount
    global.DataManager.editTransaction(decoupledTx.id, { amount: -500, merchant: 'Updated Merchant' });
    const editedDecoupledTx = global.appData.transactions.find(t => t.id === 8888);
    assert(survivingCheckingAcc.balance === 750, "Editing decoupled transaction must NOT mutate account balance");
    assert(editedDecoupledTx.amount === -250, "Decoupled transaction amount must be guarded from mutation");
    assert(editedDecoupledTx.merchant === 'Updated Merchant', "Non-financial fields like merchant can be updated");

    // Deleting the decoupled transaction
    global.DataManager.deleteTransaction(editedDecoupledTx.id);
    assert(!global.appData.transactions.some(t => t.id === 8888), "Decoupled transaction should be removed");
    assert(survivingCheckingAcc.balance === 750, "Deleting decoupled transaction must NOT refund balance (prevent phantom money)");
    console.log("✔ Decoupled transaction balance protection test passed!");

    // Test 31: Cash advance targetCardId preservation when receiving account is deleted
    const cashAdvanceCard = global.CreditCardManager.saveCreditCard({
        name: 'Advance Source Card',
        bank: 'Bank Adv',
        last4: '1122',
        creditLimit: 3000
    });
    const advanceCheckingAcc = {
        id: 7711,
        name: 'Advance Checking Dest',
        type: 'Checking',
        balance: 500
    };
    global.appData.accounts.push(advanceCheckingAcc);
    // Perform cash advance from card account to checking account
    global.DataManager.transferFunds(cashAdvanceCard.accountId, advanceCheckingAcc.id, 200, '2026-09-21', 'ATM Advance', true);
    const advanceTx = global.appData.transactions.find(t => t.isCashAdvance && t.accountId === cashAdvanceCard.accountId);
    assert(advanceTx !== undefined, "Cash advance transaction must exist");
    assert(advanceTx.targetCardId === cashAdvanceCard.id, "targetCardId must reference the source card");

    // Now delete the receiving bank account (advanceCheckingAcc)
    global.DataManager.deleteAccount(advanceCheckingAcc.id);
    // The cash advance transaction on the surviving card must keep targetCardId intact
    assert(advanceTx.targetCardId === cashAdvanceCard.id, "targetCardId on source card must NOT be wiped when receiving account is deleted");
    assert(advanceTx.toAccountId === null, "toAccountId is decoupled");
    assert(advanceTx.isDecoupled === true, "advanceTx is marked decoupled");
    console.log("✔ Cash advance targetCardId preservation on account deletion test passed!");

    // Test 32: Incoming transfer direction and rendering when source account is deleted
    const sourceToDeleteAcc = {
        id: 5544,
        name: 'Temporary Source Account',
        type: 'Savings',
        balance: 1000
    };
    const destSurvivingAcc = {
        id: 5545,
        name: 'Permanent Receiver Account',
        type: 'Checking',
        balance: 1000
    };
    global.appData.accounts.push(sourceToDeleteAcc, destSurvivingAcc);
    global.DataManager.transferFunds(sourceToDeleteAcc.id, destSurvivingAcc.id, 300, '2026-09-22', 'Gift funds');
    assert(destSurvivingAcc.balance === 1300, "Receiver balance is 1300");

    // Delete the source account
    global.DataManager.deleteAccount(sourceToDeleteAcc.id);

    // Verify the surviving incoming transfer record
    const incomingDecoupledTx = global.appData.transactions.find(t => t.accountId === destSurvivingAcc.id && t.category === 'Transfer');
    assert(incomingDecoupledTx !== undefined, "Incoming transfer record must exist on surviving account");
    assert(incomingDecoupledTx.isDecoupled === true, "Must be flagged as decoupled");
    assert(incomingDecoupledTx.decoupledDirection === 'incoming', "decoupledDirection must be 'incoming'");
    assert(incomingDecoupledTx.amount === 300, "Amount must be positive on destination account");

    // Test UI rendering via accountCard
    const receiverCardHtml = global.Components.accountCard(destSurvivingAcc);
    assert(receiverCardHtml.includes('From Temporary Source Account (Deleted)'),
        "Account card transfer history must show 'From Temporary Source Account (Deleted)' for incoming transfer");
    assert(receiverCardHtml.includes(`+${global.DataManager.formatCurrency(300)}`), "Transfer history must show positive amount");
    assert(receiverCardHtml.includes('arrow_downward'), "Incoming transfer must show green downward arrow");
    console.log("✔ Incoming transfer direction preservation and rendering test passed!");

    // Test 33: Unconditional Credit Card category exclusion from getRegularTransactions
    const cardPaymentTx = {
        id: 4433,
        date: '2026-09-23',
        merchant: 'Payment to Deleted Card (···0000) (Deleted)',
        category: 'Credit Card',
        amount: -150,
        accountId: destSurvivingAcc.id,
        toAccountId: null,
        targetCardId: null,
        isDecoupled: true,
        status: 'Completed'
    };
    global.appData.transactions.push(cardPaymentTx);
    const regs = global.DataManager.getRegularTransactions();
    assert(!regs.some(t => t.id === 4433), "Preserved card payment with decoupled references must NOT appear in getRegularTransactions");
    console.log("✔ Preserved credit card payment exclusion from regular transactions test passed!");

    // Test 34: Giving a loan from a credit card records transaction as card retail purchase & updates card metrics
    const loanTestCard = global.CreditCardManager.saveCreditCard({
        name: 'Venture X',
        bank: 'Capital One',
        last4: '7788',
        creditLimit: 5000,
        apr: 24.99,
        billingCycleDay: 15,
        gracePeriodDays: 25
    });
    const cardAccBefore = global.DataManager.getAccountById(loanTestCard.accountId);
    assert(cardAccBefore.balance === 0, "Initial card balance should be 0");

    const refDate = new Date('2026-09-10');
    const initialCardMetrics = global.CreditCardManager.getCardMetrics(loanTestCard, refDate);
    assert(initialCardMetrics.totalOutstanding === 0, "Initial total outstanding is 0");
    assert(initialCardMetrics.cyclePurchases === 0, "Initial cycle purchases is 0");
    assert(initialCardMetrics.utilizationRate === 0, "Initial utilization is 0%");

    // Lend money to Dave using the credit card
    global.DataManager.addLoan({
        person: 'Dave',
        amount: 450,
        type: 'given',
        date: '2026-09-10',
        description: 'Flight tickets'
    }, loanTestCard.accountId);

    // Verify loan is recorded
    const createdLoan = global.appData.loans.find(l => l.person === 'Dave' && l.amount === 450);
    assert(createdLoan !== undefined, "Loan to Dave must be recorded");
    assert(createdLoan.type === 'given', "Loan type must be 'given'");
    assert(createdLoan.status === 'active', "Loan must be active");

    // Verify disbursement transaction recorded on card
    const cardLoanTx = global.appData.transactions.find(t => t.loanId === createdLoan.id);
    assert(cardLoanTx !== undefined, "Loan disbursement transaction must be recorded");
    assert(cardLoanTx.accountId === loanTestCard.accountId, "Transaction must belong to credit card account");
    assert(cardLoanTx.amount === -450, "Transaction amount must be -450");
    assert(cardLoanTx.category === 'Loan', "Transaction category must be 'Loan'");
    assert(cardLoanTx.merchant === 'Loan Given: Dave (Flight tickets)', "Merchant description must include person and description");

    // Verify credit card account balance updated to negative debt
    assert(cardAccBefore.balance === -450, "Credit card account balance must be -450");

    // Verify CreditCardManager calculations
    const updatedCardMetrics = global.CreditCardManager.getCardMetrics(loanTestCard, refDate);
    assert(updatedCardMetrics.totalOutstanding === 450, "Total outstanding balance must be 450");
    assert(updatedCardMetrics.cyclePurchases === 450, "Cycle purchases must include the loan purchase");
    assert(updatedCardMetrics.cashAdvancePurchases === 0, "Must NOT be treated as cash advance");
    assert(updatedCardMetrics.cashAdvanceInterest === 0, "No cash advance interest");
    assert(updatedCardMetrics.isGracePeriodActive === true, "Grace period must remain active for purchase");
    assert(updatedCardMetrics.estimatedInterest === 0, "Zero interest during grace period");
    assert(updatedCardMetrics.projectedStatementTotal === 450, "Projected statement total must be 450");
    assert(Math.abs(updatedCardMetrics.utilizationRate - 9.0) < 0.01, "Utilization rate must be 9.0% (450 / 5000)");
    assert(updatedCardMetrics.cardTransactions.some(t => t.id === cardLoanTx.id), "Card transactions must include the loan transaction");
    console.log("✔ Credit card loan disbursement and metrics calculation test passed!");

    // Test 35: Person loan card displays credit card badge and credit_card icon
    const davePersonData = {
        name: 'Dave',
        activeLoans: [createdLoan],
        settledLoans: [],
        netBalance: 450
    };
    const daveCardHtml = global.Components.personLoanCard(davePersonData);
    assert(daveCardHtml.includes('credit_card'), "Must render credit_card icon on loan card");
    assert(daveCardHtml.includes('Venture X (Credit Card)'), "Must display card name with (Credit Card) suffix");
    console.log("✔ Loan card credit card visual badge test passed!");

    // Test 36: Guard prevents receiving loans or loan repayments into credit card
    const receivedCardLoanResult = global.DataManager.addLoan({
        person: 'Eve',
        amount: 300,
        type: 'received',
        date: '2026-09-10'
    }, loanTestCard.accountId);
    assert(receivedCardLoanResult === false, "addLoan must refuse type 'received' on credit card account");
    assert(!global.appData.loans.some(l => l.person === 'Eve'), "No received loan should be created for Eve");

    const repaymentResult = global.DataManager.recordLoanRepayment(createdLoan.id, 100, loanTestCard.accountId, false);
    assert(repaymentResult === false, "recordLoanRepayment must refuse given loan repayment into credit card");
    assert(cardAccBefore.balance === -450, "Card balance must remain -450 without invalid repayment credit");
    console.log("✔ Credit card loan reception guards test passed!");

    // Test 37: Auto-offset when giving loan from card
    // First, borrow 100 from Frank into checking
    const frankCheckingAcc = { id: 7711, name: 'Frank Checking', type: 'Checking', balance: 1000 };
    global.appData.accounts.push(frankCheckingAcc);
    global.DataManager.addLoan({
        person: 'Frank',
        amount: 100,
        type: 'received',
        date: '2026-09-01',
        description: 'Concert ticket advance'
    }, frankCheckingAcc.id);
    const frankReceivedLoan = global.appData.loans.find(l => l.person === 'Frank' && l.type === 'received');
    assert(frankReceivedLoan && frankReceivedLoan.status === 'active', "Frank received loan active");

    const cardBalBeforeFrank = cardAccBefore.balance; // -450
    // Now give Frank a 250 loan from Venture X (buying him dinner for 250)
    global.DataManager.addLoan({
        person: 'Frank',
        amount: 250,
        type: 'given',
        date: '2026-09-10',
        description: 'Fancy dinner'
    }, loanTestCard.accountId);

    // Frank's received loan must be settled via offset
    assert(frankReceivedLoan.status === 'settled', "Prior received loan from Frank must be settled by offset");
    assert(frankReceivedLoan.settledAmount === 100, "Prior received loan settledAmount is 100");

    // A new active loan to Frank for remaining 150 must exist
    const frankGivenLoan = global.appData.loans.find(l => l.person === 'Frank' && l.type === 'given');
    assert(frankGivenLoan && frankGivenLoan.amount === 150, "New given loan to Frank must be 150");

    // Total card balance must have decreased by exactly 250 (-450 - 250 = -700)
    assert(cardAccBefore.balance === cardBalBeforeFrank - 250, "Card balance must decrease by full 250 loan amount");
    console.log("✔ Credit card loan auto-offsetting test passed!");

    // Test 38: Deleting a credit card loan cleanly restores card balance and metrics
    global.DataManager.deleteLoan(createdLoan.id);
    assert(!global.appData.loans.some(l => l.id === createdLoan.id), "Dave loan removed");
    assert(!global.appData.transactions.some(t => t.loanId === createdLoan.id), "Dave loan transaction removed");
    assert(cardAccBefore.balance === -250, "Card balance restored (reverted Dave 450 loan, leaving only Frank 250)");
    const metricsAfterDelete = global.CreditCardManager.getCardMetrics(loanTestCard, refDate);
    assert(metricsAfterDelete.totalOutstanding === 250, "Metrics total outstanding updated to 250");
    assert(metricsAfterDelete.cyclePurchases === 250, "Metrics cycle purchases updated to 250");
    console.log("✔ Credit card loan deletion cleanup test passed!");

    // Test 39: NaN / nonexistent account validation for non-direct loans and repayments
    const nanAddLoan = global.DataManager.addLoan({
        person: 'NoAccountPerson',
        amount: 100,
        type: 'given',
        date: '2026-09-10',
        settlementType: 'cash'
    }, NaN);
    assert(nanAddLoan === false, "addLoan must reject NaN account for non-direct loan");
    assert(!global.appData.loans.some(l => l.person === 'NoAccountPerson'), "No loan should be created with NaN account");

    const nanRepay = global.DataManager.recordLoanRepayment(frankGivenLoan.id, 50, NaN, false);
    assert(nanRepay === false, "recordLoanRepayment must reject NaN account for non-direct repayment");
    console.log("✔ Loan account NaN validation test passed!");

    // Test 40: Available credit computation with positive card balance (overpayment)
    const overpaidCard = global.CreditCardManager.saveCreditCard({
        name: 'Overpaid Card',
        bank: 'Bank Over',
        last4: '1234',
        creditLimit: 5000
    });
    const overpaidAcc = global.DataManager.getAccountById(overpaidCard.accountId);
    overpaidAcc.balance = 200; // Overpayment credit of $200
    const availableComputed = Math.max(0, overpaidCard.creditLimit + (parseFloat(overpaidAcc.balance) || 0));
    assert(availableComputed === 5200, `Available credit should be 5200 with 200 credit on 5000 limit, got ${availableComputed}`);
    console.log("✔ Overpaid card available credit computation test passed!");

    // Test 41: Repaying a received loan using a credit card (sending repayment funds from card)
    const georgeCheckingAcc = { id: 7722, name: 'George Checking', type: 'Checking', balance: 500 };
    global.appData.accounts.push(georgeCheckingAcc);
    global.DataManager.addLoan({
        person: 'George',
        amount: 200,
        type: 'received',
        date: '2026-09-05',
        description: 'Tool purchase'
    }, georgeCheckingAcc.id);
    const georgeLoan = global.appData.loans.find(l => l.person === 'George' && l.type === 'received');
    assert(georgeLoan && georgeLoan.status === 'active', "George received loan must be active");

    const cardBalBeforeGeorgeRepay = cardAccBefore.balance;
    // Repaying George from the credit card (e.g. buying George a gift card or paying his invoice from CC)
    const repayFromCardResult = global.DataManager.recordLoanRepayment(georgeLoan.id, 200, loanTestCard.accountId, false, 'Repaid via Venture X', '2026-09-10');
    assert(repayFromCardResult !== false, "recordLoanRepayment must allow credit card when repaying a received loan");
    assert(georgeLoan.status === 'settled', "George loan must be settled");
    assert(cardAccBefore.balance === cardBalBeforeGeorgeRepay - 200, "Credit card debt must increase by 200 when repaying from card");
    const georgeRepayTx = global.appData.transactions.find(t => t.loanId === georgeLoan.id && t.merchant.includes('Loan Repayment To: George'));
    assert(georgeRepayTx !== undefined, "Repayment transaction must exist on credit card");
    assert(georgeRepayTx.accountId === loanTestCard.accountId, "Transaction must belong to credit card account");
    assert(georgeRepayTx.amount === -200, "Transaction amount must be -200 on card");
    console.log("✔ Received loan repayment via credit card test passed!");

    // Test 42: updateLoan rejects moving a received loan onto a credit card account
    const updateResult = global.DataManager.updateLoan(georgeLoan.id, { amount: 200 }, loanTestCard.accountId);
    assert(updateResult === false, "updateLoan must reject moving a received loan onto a credit card account");
    console.log("✔ updateLoan received loan credit card guard test passed!");

    // Test 43: editLoanRepayment rejects moving a given loan repayment onto a credit card account
    // Create a given loan and repay it into checking
    global.DataManager.addLoan({
        person: 'Harry',
        amount: 300,
        type: 'given',
        date: '2026-09-08'
    }, georgeCheckingAcc.id);
    const harryLoan = global.appData.loans.find(l => l.person === 'Harry' && l.type === 'given');
    global.DataManager.recordLoanRepayment(harryLoan.id, 100, georgeCheckingAcc.id, false, 'Harry part pay', '2026-09-09');
    const harryRepayTx = global.appData.transactions.find(t => t.loanId === harryLoan.id && t.merchant.includes('Loan Repayment From: Harry'));
    assert(harryRepayTx !== undefined, "Harry repayment transaction must exist");

    const editRepayResult = global.DataManager.editLoanRepayment(harryRepayTx.id, harryLoan.id, {
        amount: 100,
        accountId: loanTestCard.accountId,
        date: '2026-09-09',
        description: 'Invalid move to CC'
    });
    assert(editRepayResult === false, "editLoanRepayment must reject moving a given loan repayment to a credit card");
    assert(harryRepayTx.accountId === georgeCheckingAcc.id, "Harry repayment transaction must remain on checking account");
    console.log("✔ editLoanRepayment given loan credit card guard test passed!");

    // Test 44: String account ID credit card guard in addLoan and isCreditCardAccount
    assert(global.DataManager.isCreditCardAccount(String(loanTestCard.accountId)) === true, "isCreditCardAccount must return true for string card account ID");
    assert(global.DataManager.isCreditCardAccount(loanTestCard.accountId) === true, "isCreditCardAccount must return true for numeric card account ID");
    assert(global.DataManager.isCreditCardAccount(String(georgeCheckingAcc.id)) === false, "isCreditCardAccount must return false for checking account string ID");

    const stringCardReceivedLoan = global.DataManager.addLoan({
        person: 'StringCardBorrower',
        amount: 50,
        type: 'received',
        date: '2026-09-11',
        settlementType: 'cash'
    }, String(loanTestCard.accountId));
    assert(stringCardReceivedLoan === false, "addLoan must reject receiving loan onto credit card even when ID is passed as string");
    assert(!global.appData.loans.some(l => l.person === 'StringCardBorrower'), "String card borrower loan must not be created");
    console.log("✔ String account ID credit card guard test passed!");

    // Test 45: Direct loan settlement succeeds without transaction even if card ID is provided
    const directLoanResult = global.DataManager.addLoan({
        person: 'DirectBorrower',
        amount: 150,
        type: 'received',
        date: '2026-09-12',
        settlementType: 'direct'
    }, String(loanTestCard.accountId));
    assert(directLoanResult !== false, "addLoan must allow direct settlement even if a card account ID was supplied");
    const directLoan = global.appData.loans.find(l => l.person === 'DirectBorrower');
    assert(directLoan !== undefined && directLoan.settlementType === 'direct', "Direct loan must be created");
    const directTx = global.appData.transactions.find(t => t.loanId === directLoan.id);
    assert(directTx === undefined, "Direct loan must not create any account transaction");
    console.log("✔ Direct loan settlement with card ID test passed!");

    // Test 46: Verify select fields in app.js do not have required attribute preventing direct settlement
    const appJsSource = fs.readFileSync('./js/app.js', 'utf8');
    assert(!appJsSource.includes('id="l-account" class="form-control" required'), "l-account select must not be required");
    assert(!appJsSource.includes('id="e-account" class="form-control" required'), "e-account select must not be required");
    assert(!appJsSource.includes('id="r-account" class="form-control" required'), "r-account select must not be required");
    assert(!appJsSource.includes('id="elr-account" class="form-control" required'), "elr-account select must not be required");
    console.log("✔ Loan account select non-required verification test passed!");

    console.log("All tests passed successfully!");
})();


