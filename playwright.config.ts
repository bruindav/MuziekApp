// Fix: fix-13 — Playwright-configuratie. Serveert de app lokaal en test op desktop en op mobiel formaat.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Optioneel: eigen Chrome gebruiken (PW_CHROME=/pad/naar/chrome) als Playwright-browsers niet te downloaden zijn
    launchOptions: process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  },
  // Simpele statische server: de app is één HTML-bestand, er is geen build-stap.
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Ongeveer het formaat van een Samsung Galaxy A54
    { name: 'mobiel', use: { ...devices['Galaxy S9+'], viewport: { width: 412, height: 915 } } },
  ],
});
