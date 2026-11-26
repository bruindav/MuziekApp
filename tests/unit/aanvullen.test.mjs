// Fix: fix-16 — Unit-tests voor het aanvullen van albumgegevens (js/aanvullen.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const A = require('../../js/aanvullen.js');

// Verzonnen album en verzonnen antwoorden in de vorm van MusicBrainz en iTunes
const album = { id: 'a1', artist: 'De Verzonnen Band', title: 'Eerste Plaat (Disc 1)', genre: '', year: '1999', label: '', tracks: '', length: '' };
const mbZoek = { releases: [
  { id: 'r-fout', score: 100, title: 'Andere Plaat', 'artist-credit': [{ name: 'De Verzonnen Band' }] },
  { id: 'r-goed', score: 95, title: 'Eerste Plaat', 'artist-credit': [{ name: 'De Verzonnen Band' }] },
] };
const mbRelease = {
  id: 'r-goed', date: '1998-05-01',
  genres: [{ name: 'pop', count: 1 }, { name: 'soul', count: 4 }],
  'label-info': [{ label: { name: 'Fantasielabel' } }],
  media: [{ 'track-count': 2, tracks: [{ length: 180000 }, { length: 200500 }] }],
};
const itZoek = { results: [{ artistName: 'De Verzonnen Band', collectionName: 'Eerste Plaat', primaryGenreName: 'R&B/Soul', releaseDate: '1998-05-01T07:00:00Z', trackCount: 12 }] };

test('lege velden herkennen, ook "0" en "—"', () => {
  assert.deepEqual(A.legeVelden({ genre: '—', year: '0', label: 'X', tracks: 3, length: null }), ['genre', 'year', 'length']);
});

test('kiest de MusicBrainz-release waarvan artiest en titel kloppen, ook met "(Disc 1)"', () => {
  assert.equal(A.kiesMbRelease(mbZoek, album).id, 'r-goed');
});

test('geen MusicBrainz-release als de artiest niet klopt', () => {
  assert.equal(A.kiesMbRelease(mbZoek, { artist: 'Iemand Anders', title: 'Eerste Plaat' }), null);
});

test('haalt genre met meeste stemmen, jaar, label, tracks en lengte uit MusicBrainz', () => {
  assert.deepEqual(A.uitMusicBrainz(mbRelease), { genre: 'Soul', year: '1998', label: 'Fantasielabel', tracks: '2', length: '6:21' });
});

test('valt terug op het genre van de release-groep als de release geen genre heeft', () => {
  const r = A.uitMusicBrainz({ ...mbRelease, genres: [] }, [{ name: 'jazz', count: 2 }]);
  assert.equal(r.genre, 'Jazz');
});

test('vult alleen lege velden en neemt MusicBrainz vóór iTunes', () => {
  const it = A.uitItunes(A.kiesItunesAlbum(itZoek, album));
  const uit = A.bepaalAanvulling(album, A.uitMusicBrainz(mbRelease), it);
  assert.deepEqual(Object.keys(uit).sort(), ['genre', 'label', 'length', 'tracks']);
  assert.deepEqual(uit.genre, { waarde: 'Soul', bron: 'MusicBrainz' });
  assert.equal(uit.year, undefined); // jaar was al ingevuld
});

test('gebruikt iTunes als MusicBrainz niets heeft', () => {
  const it = A.uitItunes(A.kiesItunesAlbum(itZoek, album));
  const uit = A.bepaalAanvulling(album, {}, it);
  assert.deepEqual(uit.genre, { waarde: 'R&B/Soul', bron: 'iTunes' });
  assert.deepEqual(uit.tracks, { waarde: '12', bron: 'iTunes' });
});

test('update zet ook genreFirst; ongedaan maken maakt de velden weer leeg', () => {
  const aanv = { genre: { waarde: 'Soul', bron: 'MusicBrainz' }, tracks: { waarde: '2', bron: 'MusicBrainz' } };
  assert.deepEqual(A.naarUpdate(aanv), { genre: 'Soul', tracks: '2', genreFirst: 'Soul' });
  assert.deepEqual(A.naarOngedaan(aanv), { genre: '', tracks: '', genreFirst: '' });
});

test('lengte als m:ss en u:mm:ss', () => {
  assert.equal(A.formatLengte(381000), '6:21');
  assert.equal(A.formatLengte(3725000), '1:02:05');
});

test('album-id’s van een playlist: albums plus het album van elke track, zonder dubbelen', () => {
  const pl = { ids: ['a1', 'a2_t3', 'a1_t1', 'onbekend_t9'] };
  const tracks = { a2_t3: { albumId: 'a2' }, a1_t1: { albumId: 'a1' } };
  assert.deepEqual(A.albumIdsVanPlaylist(pl, tracks), ['a1', 'a2']);
});

test('geen lengte als niet alle nummers van een medium bekend zijn', () => {
  const r = A.uitMusicBrainz({ media: [{ 'track-count': 12, tracks: [{ length: 200000 }] }] });
  assert.equal(r.tracks, '12');
  assert.equal(r.length, '');
});
