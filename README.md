# NexFinance 📊

NexFinance is a premium, privacy-focused, standalone personal finance application built with vanilla HTML, CSS, and JavaScript. Designed to be completely serverless, it can be hosted for free on GitHub Pages and runs entirely within your browser.

## Features ✨

- **Comprehensive Tracking:** Manage your Checking, Savings, Credit, and Investment accounts all in one place.
- **Friendly Loans Manager:** Easily track money you've lent to friends or borrowed from others, complete with repayment histories.
- **Dynamic Budgets:** Set monthly budgets by category and visually track your spending against your targets.
- **Advanced Importing:** Moving from another app? NexFinance supports direct data imports via CSV or raw SQLite3 database files (e.g., from Everplan).
- **Global Currency Support:** Dynamically supports over 160+ world currencies with native symbol formatting using the browser's Internationalization API.
- **Rich Visualizations:** Track your net worth, income vs. expenses, and spending habits through intuitive reports.
- **Premium UI/UX:** Built with modern design principles featuring dark mode, glassmorphism, smooth micro-animations, and responsive layouts.

## Data Privacy & Cloud Sync ☁️

NexFinance is designed with absolute privacy in mind. **By default, your financial data never leaves your computer.** It is stored securely in your browser's `localStorage`.

However, if you want to use NexFinance across multiple devices (e.g., your laptop and your mobile phone), you can enable **Cloud Sync** using your own private GitHub account.

### How to set up Cloud Sync:

1. **Generate a GitHub Token:**
   - Log into GitHub on the web.
   - Navigate to **Settings** > **Developer Settings** > **Personal Access Tokens** > **Tokens (classic)**.
   - Click "Generate new token (classic)".
   - Give it a name (e.g., "NexFinance Sync") and check the **`gist`** permission scope.
   - Click "Generate token" and copy the resulting string (it starts with `ghp_...`).

2. **Connect your first device:**
   - Open NexFinance and go to the **Settings** page.
   - Paste your GitHub token into the *GitHub Personal Access Token* field.
   - **Leave the Gist ID field blank.**
   - Click **Connect & Create Gist**. The app will push your local data to a new secret Gist and automatically fill in the Gist ID for you.

3. **Connect additional devices (Mobile/Tablet):**
   - Open NexFinance on your other device.
   - Go to Settings.
   - Paste the *exact same GitHub Token*.
   - Copy and paste the *Gist ID* that was generated on your first device into the Gist ID field.
   - Click **Force Sync & Save**. 
   - Your data will instantly sync. From now on, any changes made on either device will automatically sync in the background!

## Setup & Running Locally 🚀

Because NexFinance is a static site with no backend dependencies, you don't need `npm install` or complex build tools.

1. Clone or download the repository to your machine.
2. Open your terminal in the project directory.
3. Start a simple local server to avoid browser security restrictions when loading local files:

   **Using Python:**
   ```bash
   python3 -m http.server 8000
   ```
   *Then visit `http://localhost:8000` in your browser.*

   **Using Node.js:**
   ```bash
   npx serve .
   ```

   **Using VS Code:**
   Simply right-click `index.html` and select **"Open with Live Server"** (requires the Live Server extension).

## Deployment 🌐

To deploy NexFinance for free:
1. Push this repository to GitHub.
2. Go to the repository **Settings** > **Pages**.
3. Select your main branch as the source and click **Save**.
4. In a few minutes, your personal finance app will be live on the web!

---
*Built for absolute control over your financial data.*
