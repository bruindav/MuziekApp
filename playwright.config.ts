// Fix: fix-2 — Playwright configuratie voor MuziekApp e2e tests
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // Voer tests parallel uit
  fullyParallel: true,
  // Stop bij eerste fout in CI
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    // Testlink of live URL — overschrijf met TEST_URL env-variabele
    baseURL: process.env.TEST_URL || 'https://bruindav.github.io/MuziekApp/',
    trace: 'on-first-retry',
    // Screenshots bij fout
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Safari/iPhone — belangrijk voor iOS-gebruikers
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
