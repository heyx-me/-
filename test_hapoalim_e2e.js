import pkgScrapers from 'israeli-bank-scrapers';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const HapoalimScraper = require('israeli-bank-scrapers/lib/scrapers/hapoalim').default;
const { fetchGetWithinPage } = require('israeli-bank-scrapers/lib/helpers/fetch');
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_DATA_DIR = path.join(__dirname, 'rafi', 'user_data');
const CHROMIUM_PATH = '/data/data/com.termux/files/usr/bin/chromium-browser';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const promptUser = (query) => new Promise((resolve) => rl.question(query, resolve));

const LoginResults = {
    Success: 'SUCCESS',
    InvalidPassword: 'INVALID_PASSWORD',
    ChangePassword: 'CHANGE_PASSWORD',
    Timeout: 'TIMEOUT',
    UnknownError: 'UNKNOWN_ERROR',
};

class HapoalimScraperWithMFA extends HapoalimScraper {
    async fetchData() {
        console.log(`[HapoalimMFA] fetchData called. Ensuring accounts API is ready...`);
        const accountDataUrl = `${this.baseUrl}/ServerServices/general/accounts`;
        
        let retries = 15;
        let accountsInfo;
        
        while (retries > 0) {
            try {
                accountsInfo = await fetchGetWithinPage(this.page, accountDataUrl);
                if (Array.isArray(accountsInfo)) {
                    console.log(`[HapoalimMFA] SUCCESS! Accounts API returned an array.`);
                    break;
                }
                
                // Dismiss any potential blocking popups
                await this.page.evaluate(() => {
                    const labels = ['דלג', 'סגור', 'הבנתי', 'אישור', 'X'];
                    const buttons = Array.from(document.querySelectorAll('button, a, .btn, [role="button"]'));
                    const target = buttons.find(b => labels.some(l => b.innerText.trim() === l));
                    if (target && target.offsetParent !== null) target.click();
                });
                
            } catch (e) {}
            
            await new Promise(r => setTimeout(r, 4000));
            retries--;
        }
        
        return super.fetchData();
    }

    getLoginOptions(credentials) {
        const loginOptions = super.getLoginOptions(credentials);
        
        // Ensure the login URL is correct
        loginOptions.loginUrl = `${this.baseUrl}/cgi-bin/poalwwwc?reqName=getLogonPage`;
        
        // Use a modern User Agent to avoid detection
        loginOptions.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

        loginOptions.postAction = async () => {
            console.log(`[HapoalimMFA] Executing postAction...`);
            
            await new Promise(r => setTimeout(r, 5000));
            
            await this.page.evaluate(() => {
                const bannerButtons = Array.from(document.querySelectorAll('button, a, span')).filter(el => {
                    const text = el.innerText.trim();
                    return text === 'X' || text === 'סגור' || text === 'הבנתי';
                });
                bannerButtons.forEach(btn => {
                    if (btn.offsetParent !== null) btn.click();
                });
            });

            const pageInfo = await this.page.evaluate(() => ({
                text: document.body.innerText,
                url: window.location.href,
                hasStarInput: !!document.querySelector('input.ng-star-inserted')
            }));

            const isMFAPage = pageInfo.text.includes('קוד') || pageInfo.text.includes('SMS') || pageInfo.hasStarInput;
            console.log(`[HapoalimMFA] State Check - MFA Detected: ${isMFAPage}`);

            if (isMFAPage && credentials.otpCodeRetriever) {
                const otpCode = await credentials.otpCodeRetriever();
                if (otpCode) {
                    console.log(`[HapoalimMFA] Entering OTP...`);
                    const inputs = await this.page.$$('input.ng-star-inserted, input[type="tel"], .digit-input input');
                    
                    if (inputs.length >= otpCode.length) {
                        for (let i = 0; i < otpCode.length; i++) {
                            await inputs[i].click({ clickCount: 3 });
                            await inputs[i].press('Backspace');
                            await inputs[i].type(otpCode[i], { delay: 150 });
                        }
                        
                        console.log(`[HapoalimMFA] Clicking continue...`);
                        const clicked = await this.page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button, .btn, input[type="submit"]')).filter(b => {
                                const text = b.innerText.trim();
                                return b.offsetParent !== null && (text.includes('המשך') || text.includes('כניסה') || text.includes('אישור'));
                            });
                            if (buttons.length > 0) {
                                buttons[buttons.length - 1].click();
                                return true;
                            }
                            return false;
                        });

                        console.log(`[HapoalimMFA] Clicked continue button: ${clicked}`);
                        await new Promise(r => setTimeout(r, 5000));

                        try {
                            await this.page.waitForFunction(() => {
                                const url = window.location.href;
                                const text = document.body.innerText;
                                return (url.includes('homepage') || url.includes('HomePage')) && (text.includes('יציאה') || text.includes('להתנתק'));
                            }, { timeout: 60000 });
                            console.log(`[HapoalimMFA] Homepage detected!`);
                        } catch (e) {
                            console.log(`[HapoalimMFA] Redirect timeout. URL: ${this.page.url()}`);
                        }
                    }
                }
            }
        };

        loginOptions.possibleResults[LoginResults.Success] = [
            /.*\/homepage.*/i,
            /.*\/HomePage.*/i,
            /.*\/ng-portals-bt\/rb\/he\/homepage/i,
            /.*\/ng-portals\/rb\/he\/homepage/i,
            ({ page }) => page.evaluate(() => (document.body.innerText.includes('יציאה') || document.body.innerText.includes('להתנתק')) && !document.body.innerText.includes('קוד אימות'))
        ];
        
        return loginOptions;
    }
}

async function run() {
    const userCode = process.argv[2];
    const password = process.argv[3];

    if (!userCode || !password) {
        console.error("❌ ERROR: Missing credentials.");
        console.log("Usage: node test_hapoalim_e2e.js <userCode> <password>");
        process.exit(1);
    }

    console.log("🚀 Starting STANDALONE Hapoalim Scraper Test...");
    
    const options = {
        companyId: 'hapoalim',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        combineInstallments: false,
        showBrowser: false,
        verbose: true,
        executablePath: CHROMIUM_PATH,
        userDataDir: path.join(USER_DATA_DIR, 'test_session_v5'),
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled'
        ]
    };

    const scraper = new HapoalimScraperWithMFA(options);
    const credentials = {
        userCode,
        password,
        otpCodeRetriever: async () => {
            console.log("\n**************************************************");
            console.log("!!! OTP CODE REQUIRED NOW !!!");
            console.log("**************************************************\n");
            return await promptUser(">>> ENTER OTP CODE: ");
        }
    };

    try {
        const result = await scraper.scrape(credentials);
        if (result.success) {
            console.log("\n✅ SUCCESS: BANK CONNECTED!");
            console.log(`Found ${result.accounts.length} accounts.`);
        } else {
            console.error("\n❌ ERROR:", result.errorType, result.errorMessage);
        }
    } catch (e) {
        console.error("\n❌ CRITICAL FAILURE:", e);
    } finally {
        rl.close();
        process.exit(0);
    }
}

run();
