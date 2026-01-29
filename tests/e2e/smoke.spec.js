import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  // Expect a title "to contain" a substring.
  // Note: The actual title might vary, so we'll check for something generic or "Heyx" if we know it.
  // The plan said "Heyx". Let's verify index.html title quickly or just stick to the plan.
  // Sticking to plan, but I'll make it permissive if I can.
  // The plan said: await expect(page).toHaveTitle(/Heyx/);
  await expect(page).toHaveTitle(/Heyx/);
});
