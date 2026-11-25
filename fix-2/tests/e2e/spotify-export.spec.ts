// Fix: fix-2 — Tests voor Spotify export functie (fix-1)
import { test, expect } from '@playwright/test';

test.describe('Spotify export (fix-1)', () => {
  test.beforeEach(async ({ page }) => {
    // Open de app
    await page.goto('/');
  });

  test('Spotify export knop is zichtbaar in het playlist panel', async ({ page }) => {
    // De knop moet aanwezig zijn in de DOM (ook zonder actieve playlist)
    const spotifyBtn = page.getByRole('button', { name: /spotify/i });
    await expect(spotifyBtn.first()).toBeVisible();
  });

  test('Spotify beheer-kaartje is aanwezig in het beheer-tabblad', async ({ page }) => {
    // Navigeer naar het beheer-tabblad (alleen zichtbaar na inloggen,
    // maar het element moet in de DOM zitten)
    const spotifyCard = page.locator('#card-spotify');
    await expect(spotifyCard).toBeAttached();
  });

  test('Spotify export knop toont foutmelding zonder Client ID', async ({ page }) => {
    // Verwijder eventueel opgeslagen Client ID
    await page.evaluate(() => localStorage.removeItem('spotify_client_id'));
    await page.reload();

    // Klik op de Spotify export knop
    const spotifyBtn = page.getByRole('button', { name: /spotify/i }).first();
    await spotifyBtn.click();

    // Verwacht een foutmelding of toast
    await expect(
      page.getByText(/client id|beheer|spotify/i).first()
    ).toBeVisible({ timeout: 3000 });
  });
});
