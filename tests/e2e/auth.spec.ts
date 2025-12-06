import { test, expect } from '@playwright/test';

test('login page loads and shows google sign-in button', async ({ page }) => {
    await page.goto('/login');

    // Expect title to contain ByggPilot
    await expect(page).toHaveTitle(/ByggPilot/);

    // Expect a button with text "Logga in med Google" (or similar from my previous code)
    // Checking src/app/login/page.tsx content or visual
    const loginButton = page.getByRole('button', { name: /Logga in med Google/i });
    await expect(loginButton).toBeVisible();
});

test('redirects to login if accessing protected route unauthenticated', async ({ page }) => {
    await page.goto('/'); // Dashboard is protected
    await expect(page).toHaveURL(/.*login/);
});
