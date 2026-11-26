// Fix: fix-19 — MusicBrainz gaf regelmatig HTTP 503 (te veel verzoeken tegelijk). Alle verzoeken gaan nu
// via één wachtrij, zonder extra header, en een 503 wordt opnieuw geprobeerd.
import { test, expect, type Page } from '@playwright/test';
import { gebruikNepFirebase } from './firebase-stub';

// Verzonnen album waar alleen het genre aan ontbreekt
const albums = [{ id: 'a1', artist: 'De Verzonnen Band', title: 'Eerste Plaat (Disc 2)', genre: '', year: '1999', origYear: '1999',
  label: 'L', tracks: '2', length: '4:30', barcode: '1234567890123', deviceType: 'CD', composer: 'x', producer: 'x', musician: 'x' }];

const zoekAntwoord = { releases: [{ id: 'r1', score: 100, title: 'Eerste Plaat', 'artist-credit': [{ name: 'De Verzonnen Band' }] }] };
const releaseAntwoord = { id: 'r1', genres: [{ name: 'soul', count: 1 }], media: [] };

async function start(page: Page, pauzeMs: number) {
  await page.addInitScript(p => { (globalThis as any).__mbPauzeMs = p; (globalThis as any).__dcPauzeMs = 0; }, pauzeMs);
  await gebruikNepFirebase(page, { ingelogd: true, data: { albums } });
  await page.route('https://itunes.apple.com/**', r => r.fulfill({ json: { results: [] } }));
  await page.route(/deezer/, r => r.fulfill({ json: { data: [] } }));
  await page.goto('/');
  const welkom = page.getByRole('button', { name: /Veel plezier/ });
  if (await welkom.isVisible({ timeout: 3000 }).catch(() => false)) await welkom.click();
}

const dialoog = (page: Page) => page.getByRole('dialog', { name: '🔍 Gegevens aanvullen' });

test('een 503 van MusicBrainz wordt opnieuw geprobeerd en daarna lukt het aanvullen', async ({ page }) => {
  let eerste = true;
  await page.route('https://musicbrainz.org/ws/2/**', route => {
    // Het allereerste verzoek is "te druk"
    if (eerste) { eerste = false; return route.fulfill({ status: 503, body: 'Rate limited' }); }
    return route.fulfill({ json: route.request().url().includes('/release?') ? zoekAntwoord : releaseAntwoord });
  });
  await start(page, 0);
  await page.evaluate(() => (window as any).aanvullenAlbums(['a1']));
  await expect(dialoog(page).getByRole('status')).toHaveText('Klaar: 1 aangevuld.');
});

test('blijft MusicBrainz druk, dan kun je de mislukte albums opnieuw proberen', async ({ page }) => {
  let druk = true;
  await page.route('https://musicbrainz.org/ws/2/**', route => {
    if (druk) return route.fulfill({ status: 503, body: 'Rate limited' });
    return route.fulfill({ json: route.request().url().includes('/release?') ? zoekAntwoord : releaseAntwoord });
  });
  await start(page, 0);
  await page.evaluate(() => (window as any).aanvullenAlbums(['a1']));
  await expect(dialoog(page).getByRole('status')).toHaveText('Klaar: 1 mislukt.');
  // MusicBrainz is weer beschikbaar: opnieuw proberen
  druk = false;
  await dialoog(page).getByRole('button', { name: '↻ Mislukte opnieuw proberen' }).click();
  await expect(dialoog(page).getByRole('status')).toHaveText('Klaar: 1 aangevuld.');
});

test('albumvenster openen en direct aanvullen: MusicBrainz-verzoeken nooit tegelijk', async ({ page }) => {
  const tijden: number[] = [];
  await page.route('https://musicbrainz.org/ws/2/**', route => {
    tijden.push(Date.now());
    // Geen eigen User-Agent van de app (die gaf een extra verzoek vooraf)
    expect(route.request().headers()['user-agent'] || '').not.toContain('MuziekApp');
    return route.fulfill({ json: route.request().url().includes('/release?') ? zoekAntwoord : releaseAntwoord });
  });
  await start(page, 300);
  // Het albumvenster zoekt zelf de tracks op bij MusicBrainz; meteen daarna aanvullen
  await page.evaluate(() => (window as any).openDetailModal('a1'));
  await page.getByRole('button', { name: 'Gegevens van dit album aanvullen' }).click();
  await expect(dialoog(page).getByRole('status')).toHaveText('Klaar: 1 aangevuld.', { timeout: 15000 });
  // Tussen elk paar verzoeken zit minstens (bijna) de ingestelde pauze
  expect(tijden.length).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < tijden.length; i++) expect(tijden[i] - tijden[i - 1]).toBeGreaterThanOrEqual(250);
});
