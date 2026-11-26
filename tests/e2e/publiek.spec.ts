// Fix: fix-13 — End-to-end-tests voor de pagina's die zonder inloggen werken.
import { test, expect, type Page } from '@playwright/test';
import { gebruikNepFirebase } from './firebase-stub';

// Elke test start met een nep-Firebase waarin niemand is ingelogd
test.beforeEach(async ({ page }) => {
  await gebruikNepFirebase(page);
});

// Open de app direct op de helppagina (via #help, zoals een gedeelde link).
async function openHelp(page: Page) {
  await page.goto('/#help');
  // De help-overlay is open en de titel toont "Help"
  await expect(page.locator('#infoOverlay')).toBeVisible();
  await expect(page.locator('#infoTitle')).toHaveText(/Help/);
}

// Het fixnummer-label op de helppagina (een knop met label "Versienummer fix-…").
const fixnummerOpHelp = (page: Page) =>
  page.locator('#infoBody').getByRole('button', { name: /^Versienummer fix-\d+$/ });

test('helppagina is zonder inloggen te openen en toont het fixnummer', async ({ page }) => {
  await openHelp(page);
  // Het fixnummer staat zichtbaar onderaan de helppagina
  await expect(fixnummerOpHelp(page)).toHaveText(/^fix-\d+$/);
});

test('lang indrukken op het fixnummer opent het testoverzicht', async ({ page }) => {
  await openHelp(page);
  const label = fixnummerOpHelp(page);
  // Muis ingedrukt houden op het label, ruim een seconde
  await label.hover();
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  // Het testoverzicht verschijnt als dialoog
  const dialoog = page.getByRole('dialog', { name: 'Testoverzicht per fix' });
  await expect(dialoog).toBeVisible();
  // De nieuwste fix bovenaan staat ook in het overzicht
  const fix = await label.textContent();
  await expect(dialoog.getByRole('heading', { name: fix! })).toBeVisible();
});

test('kort klikken op het fixnummer opent het testoverzicht niet', async ({ page }) => {
  await openHelp(page);
  await fixnummerOpHelp(page).click();
  await page.waitForTimeout(1300);
  await expect(page.getByRole('dialog', { name: 'Testoverzicht per fix' })).toHaveCount(0);
});

test('testoverzicht werkt met het toetsenbord en sluit met Escape', async ({ page }) => {
  await openHelp(page);
  // Focus op het label en Enter ingedrukt houden
  await fixnummerOpHelp(page).focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(1300);
  await page.keyboard.up('Enter');
  const dialoog = page.getByRole('dialog', { name: 'Testoverzicht per fix' });
  await expect(dialoog).toBeVisible();
  // De sluitknop krijgt de focus, Escape sluit de dialoog
  await expect(dialoog.getByRole('button', { name: 'Sluiten' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialoog).toHaveCount(0);
});

test('helppagina legt uit hoe een playlist via Tune My Music naar Deezer gaat', async ({ page }) => {
  await openHelp(page);
  await expect(page.getByText('Playlist naar Deezer (of Spotify)')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tune My Music' })).toHaveAttribute('href', /tunemymusic\.com/);
});

test('helppagina en testoverzicht zijn niet breder dan het scherm', async ({ page }) => {
  await openHelp(page);
  const label = fixnummerOpHelp(page);
  await label.hover();
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Testoverzicht per fix' })).toBeVisible();
  // Geen horizontaal scrollen: de pagina is precies zo breed als het venster
  const teBreed = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(teBreed).toBe(false);
});
