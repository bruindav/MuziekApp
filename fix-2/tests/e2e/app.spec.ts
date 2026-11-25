// Fix: fix-2 — Basistests voor MuziekApp (app laadt, navigatie, helppagina)
import { test, expect } from '@playwright/test';

test.describe('App laadt correct', () => {
  test('openingspagina toont de MuziekApp titel', async ({ page }) => {
    // Navigeer naar de app
    await page.goto('/');
    // Controleer dat de paginatitel klopt
    await expect(page).toHaveTitle(/MuziekApp/i);
  });

  test('inlogknop is zichtbaar voor niet-ingelogde gebruiker', async ({ page }) => {
    await page.goto('/');
    // Er moet een inlogknop of -formulier zichtbaar zijn
    const loginBtn = page.getByRole('button', { name: /inloggen|google/i });
    await expect(loginBtn.first()).toBeVisible();
  });
});

test.describe('Helppagina', () => {
  test('helppagina opent via #help anker', async ({ page }) => {
    // Helppagina moet bereikbaar zijn zonder in te loggen
    await page.goto('/#help');
    // Controleer dat de helppagina zichtbaar is
    await expect(page.getByRole('heading', { name: /help/i }).first()).toBeVisible();
  });

  test('fixnummer is zichtbaar op de helppagina', async ({ page }) => {
    await page.goto('/#help');
    // Het fixnummer moet zichtbaar zijn (bijv. "fix-1" of "fix-2")
    await expect(page.getByText(/fix-\d+/i).first()).toBeVisible();
  });

  test('lang drukken op fixnummer opent testoverzicht', async ({ page }) => {
    await page.goto('/#help');
    // Zoek het element met het fixnummer
    const fixEl = page.getByText(/fix-\d+/i).first();
    // Simuleer lang indrukken (1 seconde)
    await fixEl.dispatchEvent('pointerdown');
    await page.waitForTimeout(1100);
    await fixEl.dispatchEvent('pointerup');
    // Testoverzicht-modal of -sectie moet verschijnen
    await expect(page.getByText(/testoverzicht|tests/i).first()).toBeVisible();
  });
});
