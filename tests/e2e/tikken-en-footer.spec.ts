// Fix: fix-14 — Tikken onderaan het scherm, footer met fixnummer op mobiel, lang drukken met een vinger.
import { test, expect, type Page } from '@playwright/test';
import { gebruikNepFirebase } from './firebase-stub';

const versieknoppen = (page: Page) => page.getByRole('button', { name: /^Versienummer fix-\d+$/ });

// Help openen en helemaal naar beneden scrollen, zodat de knoppen onderaan het scherm staan
async function openHelpOnderaan(page: Page) {
  await page.goto('/#help');
  await expect(page.locator('#infoOverlay')).toBeVisible();
  await page.locator('#infoOverlay').evaluate(el => el.scrollTo(0, el.scrollHeight));
}

// Ingelogd (nep) starten en het welkomstscherm wegklikken als het verschijnt
async function startIngelogd(page: Page) {
  await gebruikNepFirebase(page, { ingelogd: true });
  await page.goto('/');
  const welkom = page.getByRole('button', { name: /Veel plezier/ });
  if (await welkom.isVisible({ timeout: 3000 }).catch(() => false)) await welkom.click();
}

test.describe('niet ingelogd', () => {
  test.beforeEach(async ({ page }) => { await gebruikNepFirebase(page); });

  test('privacyknop onderaan de helppagina opent de privacypagina', async ({ page }) => {
    await openHelpOnderaan(page);
    // Gewoon klikken: Playwright faalt als er iets onzichtbaars over de knop ligt
    await page.locator('#infoBody').getByRole('button', { name: /Privacy/ }).click();
    await expect(page.locator('#infoTitle')).toHaveText(/Privacy/);
  });

  test('disclaimerknop onderaan de helppagina opent de disclaimer', async ({ page }) => {
    await openHelpOnderaan(page);
    await page.locator('#infoBody').getByRole('button', { name: /Disclaimer/ }).click();
    await expect(page.locator('#infoTitle')).toHaveText(/Disclaimer/);
  });

  test('een verborgen melding blokkeert geen tikken onderaan het scherm', async ({ page }) => {
    await page.goto('/');
    // Kijk welk element er ligt op de plek waar de (onzichtbare) melding staat
    const geblokkeerd = await page.evaluate(() => {
      const r = document.getElementById('toast')!.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!el && !!el.closest('#toast');
    });
    expect(geblokkeerd).toBe(false);
  });
});

test.describe('ingelogd met een demogebruiker', () => {
  test('het fixnummer staat zichtbaar in de footer', async ({ page }) => {
    await startIngelogd(page);
    // Op mobiel onderaan in de tabbalk, op desktop in de zijbalk
    await expect(versieknoppen(page).filter({ visible: true }).first()).toHaveText(/^fix-\d+$/);
  });

  test('lang drukken met een vinger op het fixnummer opent het testoverzicht', async ({ page, browserName }, info) => {
    test.skip(info.project.name !== 'mobiel' || browserName !== 'chromium', 'Alleen op mobiel (touch) in Chromium');
    await startIngelogd(page);
    const label = versieknoppen(page).filter({ visible: true }).first();
    const vak = (await label.boundingBox())!;
    const punt = [{ x: vak.x + vak.width / 2, y: vak.y + vak.height / 2 }];
    // Echte touch-events: vinger neer, ruim een seconde wachten, vinger op
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punt });
    await page.waitForTimeout(1300);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByRole('dialog', { name: 'Testoverzicht per fix' })).toBeVisible();
  });
});
