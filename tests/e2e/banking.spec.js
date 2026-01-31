import { test, expect } from '@playwright/test';

test.describe('Banking App E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear local storage to ensure we are logged out
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('/rafi/index.html');
  });

  test('should show hero section and login button when not logged in', async ({ page }) => {
    await expect(page.getByText('Your finances, simplified')).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect via BankID/i })).toBeVisible();
  });

  test('should open login modal when clicking connect button', async ({ page }) => {
    await page.getByRole('button', { name: /Connect via BankID/i }).click();
    await expect(page.getByText('Connect to Bank')).toBeVisible();
    await expect(page.getByLabel(/Select Bank/i)).toBeVisible();
  });

  test('should show dashboard when token is present', async ({ page }) => {
    // Inject mock token and data
    await page.addInitScript(() => {
      window.localStorage.setItem('banking_token', JSON.stringify('mock-token'));
      window.localStorage.setItem('banking_data', JSON.stringify({
        accounts: [
          {
            accountNumber: '123',
            balanceCurrency: 'ILS',
            txns: [
              { date: new Date().toISOString(), description: 'Test Transaction', chargedAmount: -100, category: 'Shopping' }
            ]
          }
        ]
      }));
    });
    
    await page.reload();
    
    await expect(page.getByText('Recent Activity')).toBeVisible();
    await expect(page.getByText('Test Transaction')).toBeVisible();
    await expect(page.getByText('-100 ILS')).toBeVisible();
  });
});
