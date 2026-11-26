// Fix: fix-15 — Genre- en jaarfilter met één tik terug naar "alle".
import { test, expect, type Page } from '@playwright/test';
import { gebruikNepFirebase } from './firebase-stub';

// Verzonnen albums met verschillende genres en jaren
const albums = [
  { id: 'a1', artist: 'Aap en de Notenkrakers', title: 'Eerste Plaat', genre: 'Pop', genreFirst: 'Pop', year: '1999' },
  { id: 'a2', artist: 'Aap en de Notenkrakers', title: 'Tweede Plaat', genre: 'Jazz', genreFirst: 'Jazz', year: '2005' },
  { id: 'a3', artist: 'Accordeonclub Zuid', title: 'Wals', genre: 'Wereld', genreFirst: 'Wereld', year: '2005' },
];

async function startMetAlbums(page: Page) {
  await gebruikNepFirebase(page, { ingelogd: true, data: { albums } });
  await page.goto('/');
  const welkom = page.getByRole('button', { name: /Veel plezier/ });
  if (await welkom.isVisible({ timeout: 3000 }).catch(() => false)) await welkom.click();
  await expect(page.getByText('Tweede Plaat')).toBeVisible();
}

const genreKeuze = (page: Page) => page.locator('#genreFilter');
const wisKnop = (page: Page) => page.getByRole('button', { name: 'Genre- en jaarfilter wissen' });

test('zonder filter is de wisknop niet zichtbaar', async ({ page }) => {
  await startMetAlbums(page);
  await expect(wisKnop(page)).toBeHidden();
});

test('na kiezen van een genre zet de wisknop het filter in één tik terug op alle genres', async ({ page }) => {
  await startMetAlbums(page);
  // Kies het laatste genre in de lijst
  await genreKeuze(page).selectOption('Wereld');
  await expect(page.getByText('Wals')).toBeVisible();
  await expect(page.getByText('Eerste Plaat')).toBeHidden();
  // Eén tik op de wisknop: alle albums weer zichtbaar
  await wisKnop(page).click();
  await expect(genreKeuze(page)).toHaveValue('');
  await expect(page.getByText('Eerste Plaat')).toBeVisible();
  await expect(wisKnop(page)).toBeHidden();
});

test('de wisknop wist ook het jaarfilter', async ({ page }) => {
  await startMetAlbums(page);
  await page.locator('#yearFilter').selectOption('2005');
  await expect(page.getByText('Eerste Plaat')).toBeHidden();
  await wisKnop(page).click();
  await expect(page.locator('#yearFilter')).toHaveValue('');
  await expect(page.getByText('Eerste Plaat')).toBeVisible();
});

test('filterbalk met wisknop past op het scherm', async ({ page }) => {
  await startMetAlbums(page);
  await genreKeuze(page).selectOption('Jazz');
  await expect(wisKnop(page)).toBeVisible();
  const teBreed = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(teBreed).toBe(false);
});
