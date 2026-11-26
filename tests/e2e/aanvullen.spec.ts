// Fix: fix-16/fix-18 — Ontbrekende albumgegevens aanvullen vanuit de playlist (MusicBrainz en iTunes nagebootst).
import { test, expect, type Page } from '@playwright/test';
import { gebruikNepFirebase, schrijfacties } from './firebase-stub';

// Verzonnen testdata: album a1 mist genre, label, tracks en lengte; a2 is compleet; a3 bestaat nergens.
const albums = [
  { id: 'a1', artist: 'De Verzonnen Band', title: 'Eerste Plaat', genre: '', year: '1999', label: '', tracks: '', length: '' },
  { id: 'a2', artist: 'Aap en de Notenkrakers', title: 'Compleet', genre: 'Jazz', genreFirst: 'Jazz', year: '2001', label: 'Label X', tracks: '10', length: '40:00',
    origYear: '2001', barcode: '1234567890123', deviceType: 'CD', composer: 'Iemand', producer: 'Iemand', musician: 'Iemand' },
  { id: 'a3', artist: 'Onvindbaar Trio', title: 'Nergens', genre: '', year: '', label: '', tracks: '', length: '' },
];
const trackItems = [{ id: 'a1_t2', albumId: 'a1', title: 'Tweede Lied', artist: 'De Verzonnen Band', album: 'Eerste Plaat', isTrack: true }];
const playlists = [{ id: 'p1', name: 'Testlijst', ids: ['a1_t2', 'a2', 'a3'], createdAt: 1 }];
const deviceTypes = [{ id: 'd1', name: 'CD', order: 1 }, { id: 'd2', name: 'LP', order: 2 }];

// Nagebootste antwoorden van MusicBrainz en iTunes
async function nepMuziekdiensten(page: Page) {
  await page.route('https://musicbrainz.org/ws/2/**', route => {
    const url = decodeURIComponent(route.request().url());
    let body: object = { releases: [] };
    if (url.includes('/release?') && url.includes('De Verzonnen Band')) {
      body = { releases: [{ id: 'r1', score: 100, title: 'Eerste Plaat', 'artist-credit': [{ name: 'De Verzonnen Band' }] }] };
    } else if (url.includes('/release/r1')) {
      body = { id: 'r1', date: '1999-03-01', genres: [{ name: 'soul', count: 3 }], 'label-info': [{ label: { name: 'Fantasielabel' } }],
               'release-group': { id: 'rg1', 'first-release-date': '1998-01-01' },
               media: [{ format: '12" Vinyl', 'track-count': 2, tracks: [{ length: 120000 }, { length: 150000 }] }],
               // Fix-18: MusicBrainz verwijst naar de Discogs-release
               relations: [{ type: 'discogs', url: { resource: 'https://www.discogs.com/release/555' } }] };
    }
    return route.fulfill({ json: body });
  });
  await page.route('https://itunes.apple.com/**', route => route.fulfill({ json: { results: [] } }));
  // Fix-18: Discogs-release met credits en barcode
  await page.route('https://api.discogs.com/releases/555', route => route.fulfill({ json: {
    year: 1999, styles: ['Northern Soul'],
    identifiers: [{ type: 'Barcode', value: '8712345678906' }],
    extraartists: [{ name: 'Piet Producent', role: 'Producer' }, { name: 'Gitta Gitaar', role: 'Guitar' }],
    tracklist: [{ type_: 'track', title: 'Een', extraartists: [{ name: 'Carla Componist', role: 'Written-By' }] }],
  } }));
}

async function openPlaylist(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('active_playlist_id', 'p1');
    // in de test niet wachten tussen verzoeken aan MusicBrainz en Discogs
    (globalThis as any).__mbPauzeMs = 0;
    (globalThis as any).__dcPauzeMs = 0;
  });
  await gebruikNepFirebase(page, { ingelogd: true, data: { albums, trackItems, playlists, deviceTypes } });
  await nepMuziekdiensten(page);
  await page.goto('/');
  const welkom = page.getByRole('button', { name: /Veel plezier/ });
  if (await welkom.isVisible({ timeout: 3000 }).catch(() => false)) await welkom.click();
  await page.getByRole('button', { name: /Playlists/ }).first().click();
  await expect(page.getByText('Tweede Lied')).toBeVisible();
}

const dialoog = (page: Page) => page.getByRole('dialog', { name: '🔍 Gegevens aanvullen' });

test('Aanvullen bij de playlist vult alleen lege velden en meldt wat er gebeurd is', async ({ page }) => {
  await openPlaylist(page);
  await page.getByRole('button', { name: '🔍 Aanvullen' }).click();
  // Samenvatting na afloop
  await expect(dialoog(page).getByRole('status')).toHaveText('Klaar: 1 aangevuld, 1 al compleet, 1 niet gevonden.');
  await expect(dialoog(page).getByText('Soul')).toBeVisible();
  // Alleen album a1 is bijgewerkt, het jaar (al ingevuld) is niet aangeraakt
  const updates = (await schrijfacties(page)).filter(s => s.soort === 'update');
  expect(updates).toHaveLength(1);
  expect(updates[0].pad).toContain('albums/a1');
  // Fix-18: ook origineel jaar, barcode, drager en credits; genre uit MusicBrainz, credits uit Discogs
  expect(updates[0].data).toEqual({
    genre: 'Soul', genreFirst: 'Soul', origYear: '1998', label: 'Fantasielabel', tracks: '2', length: '4:30',
    barcode: '8712345678906', deviceType: 'LP', composer: 'Carla Componist', producer: 'Piet Producent', musician: 'Gitta Gitaar',
  });
  await expect(dialoog(page).getByText('Componist: Carla Componist (Discogs)')).toBeVisible();
});

test('🔍 bij een track vult het album van die track aan', async ({ page }) => {
  await openPlaylist(page);
  const knop = page.getByRole('button', { name: 'Gegevens aanvullen voor Tweede Lied' });
  // De knop houdt het vergrootglas (wordt niet vervangen door het icoon van de streamingdienst)
  await expect(knop).toHaveText('🔍');
  await knop.click();
  await expect(dialoog(page).getByRole('status')).toHaveText('Klaar: 1 aangevuld.');
});

test('ongedaan maken zet de aangevulde velden weer leeg', async ({ page }) => {
  await openPlaylist(page);
  await page.getByRole('button', { name: '🔍 Aanvullen' }).click();
  await dialoog(page).getByRole('button', { name: '↩ Ongedaan maken' }).click();
  await expect(dialoog(page).getByRole('button', { name: '✓ Ongedaan gemaakt' })).toBeDisabled();
  const laatste = (await schrijfacties(page)).at(-1)!;
  expect(laatste.data).toEqual({ genre: '', genreFirst: '', origYear: '', label: '', tracks: '', length: '', barcode: '', deviceType: '', composer: '', producer: '', musician: '' });
});

test('het aanvulvenster sluit met Escape en past op het scherm', async ({ page }) => {
  await openPlaylist(page);
  await page.getByRole('button', { name: '🔍 Aanvullen' }).click();
  await expect(dialoog(page).getByRole('status')).toContainText('Klaar');
  const teBreed = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(teBreed).toBe(false);
  await page.keyboard.press('Escape');
  await expect(dialoog(page)).toHaveCount(0);
});

// Fix-17: aanvullen vanuit de bibliotheek
test.describe('aanvullen in de bibliotheek', () => {
  async function openBibliotheek(page: Page) {
    await page.addInitScript(() => { (globalThis as any).__mbPauzeMs = 0; (globalThis as any).__dcPauzeMs = 0; });
    await gebruikNepFirebase(page, { ingelogd: true, data: { albums, trackItems, playlists, deviceTypes } });
    await nepMuziekdiensten(page);
    await page.goto('/');
    const welkom = page.getByRole('button', { name: /Veel plezier/ });
    if (await welkom.isVisible({ timeout: 3000 }).catch(() => false)) await welkom.click();
    // Wacht tot de albums geladen zijn (standaard staat letter A open), zoek dan het album op naam
    await expect(page.getByText('Aap en de Notenkrakers').first()).toBeVisible();
    await page.getByPlaceholder(/Zoek artiest/).fill('Eerste');
    await expect(page.getByText('Eerste Plaat')).toBeVisible();
  }

  test('🔍 Aanvullen in het albumvenster vult dat album aan', async ({ page }, info) => {
    await openBibliotheek(page);
    if (info.project.name === 'mobiel') {
      // Op mobiel: tik op het album, dan opent het detailvenster
      await page.getByText('Eerste Plaat').click();
    } else {
      await page.getByRole('button', { name: 'Details van Eerste Plaat' }).click();
    }
    await page.getByRole('button', { name: 'Gegevens van dit album aanvullen' }).click();
    await expect(dialoog(page).getByRole('status')).toHaveText('Klaar: 1 aangevuld.');
  });

  test('🔍 achter de albumregel vult het album aan (computer)', async ({ page }, info) => {
    test.skip(info.project.name === 'mobiel', 'Knoppen achter de regel zijn er alleen op de computer');
    await openBibliotheek(page);
    await page.getByRole('button', { name: 'Gegevens aanvullen voor Eerste Plaat' }).click();
    await expect(dialoog(page).getByRole('status')).toHaveText('Klaar: 1 aangevuld.');
  });

  test('het menu van een album (lang drukken) bevat Gegevens aanvullen', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobiel', 'Dit menu is er alleen op mobiel');
    await openBibliotheek(page);
    // Open het albummenu zoals lang drukken dat doet (het gebaar zelf is bestaand gedrag)
    await page.evaluate(() => (window as any).openCtxMenu('a1', new Event('touchstart')));
    await page.getByRole('button', { name: /Gegevens aanvullen/ }).click();
    await expect(dialoog(page).getByRole('status')).toHaveText('Klaar: 1 aangevuld.');
  });

  test('Verwijderen in het albumvenster vraagt om bevestiging', async ({ page }) => {
    await openBibliotheek(page);
    await page.evaluate(() => (window as any).openDetailModal('a1'));
    await page.getByRole('button', { name: '🗑 Verwijderen' }).click();
    // De bevestigingsvraag verschijnt (eerder deed deze knop niets)
    await expect(page.getByRole('heading', { name: 'Verwijderen?' })).toBeVisible();
  });
});
