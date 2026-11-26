// Fix: fix-16/fix-18 — Unit-tests voor het aanvullen van albumgegevens (js/aanvullen.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const A = require('../../js/aanvullen.js');

// Verzonnen album en verzonnen antwoorden in de vorm van MusicBrainz en iTunes
const album = { id: 'a1', artist: 'De Verzonnen Band', title: 'Eerste Plaat (Disc 1)', genre: '', year: '1999', label: '', tracks: '', length: '',
  origYear: '1998', barcode: '1234567890123', deviceType: 'CD', composer: 'Al Bekend', producer: 'Al Bekend', musician: 'Al Bekend' };
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
  const vol = { genre: '—', year: '0', label: 'X', tracks: 3, length: null, origYear: '1990', barcode: '1', deviceType: 'CD', composer: 'x', producer: 'x', musician: 'x' };
  assert.deepEqual(A.legeVelden(vol), ['genre', 'year', 'length']);
});

test('kiest de MusicBrainz-release waarvan artiest en titel kloppen, ook met "(Disc 1)"', () => {
  assert.equal(A.kiesMbRelease(mbZoek, album).id, 'r-goed');
});

test('geen MusicBrainz-release als de artiest niet klopt', () => {
  assert.equal(A.kiesMbRelease(mbZoek, { artist: 'Iemand Anders', title: 'Eerste Plaat' }), null);
});

test('haalt genre met meeste stemmen, jaar, label, tracks en lengte uit MusicBrainz', () => {
  const r = A.uitMusicBrainz(mbRelease);
  assert.deepEqual([r.genre, r.year, r.label, r.tracks, r.length], ['Soul', '1998', 'Fantasielabel', '2', '6:21']);
});

test('valt terug op het genre van de release-groep als de release geen genre heeft', () => {
  const r = A.uitMusicBrainz({ ...mbRelease, genres: [] }, [{ name: 'jazz', count: 2 }]);
  assert.equal(r.genre, 'Jazz');
});

test('vult alleen lege velden en neemt MusicBrainz vóór iTunes', () => {
  const it = A.uitItunes(A.kiesItunesAlbum(itZoek, album));
  const uit = A.bepaalAanvulling(album, { MusicBrainz: A.uitMusicBrainz(mbRelease), iTunes: it });
  assert.deepEqual(Object.keys(uit).sort(), ['genre', 'label', 'length', 'tracks']);
  assert.deepEqual(uit.genre, { waarde: 'Soul', bron: 'MusicBrainz' });
  assert.equal(uit.year, undefined); // jaar was al ingevuld
});

test('gebruikt iTunes als MusicBrainz niets heeft', () => {
  const it = A.uitItunes(A.kiesItunesAlbum(itZoek, album));
  const uit = A.bepaalAanvulling(album, { MusicBrainz: {}, iTunes: it });
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

// ── Fix-18: alle velden uit het bewerkingsscherm, Discogs als extra bron ──
const typen = [{ name: 'CD' }, { name: 'LP' }, { name: 'Cassette' }];
const dcRelease = {
  year: 1998, styles: ['Soul'], genres: ['Funk / Soul'],
  labels: [{ name: 'Fantasielabel (2)' }],
  identifiers: [{ type: 'Barcode', value: '8 712345 678906' }],
  formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album'] }],
  extraartists: [
    { name: 'Piet Producent*', role: 'Producer' },
    { name: 'Gitta Gitaar', role: 'Guitar, Backing Vocals' },
  ],
  tracklist: [
    { type_: 'heading', title: 'Kant A' },
    { type_: 'track', title: 'Een', duration: '3:00', extraartists: [{ name: 'Carla Componist', role: 'Written-By' }] },
    { type_: 'track', title: 'Twee', duration: '4:30', extraartists: [{ name: 'Carla Componist', role: 'Written-By' }] },
  ],
};

test('Discogs: credits, barcode, label en drager worden goed gelezen', () => {
  const r = A.uitDiscogs(dcRelease, typen);
  assert.equal(r.composer, 'Carla Componist'); // dubbele naam maar één keer
  assert.equal(r.producer, 'Piet Producent'); // sterretje weg
  assert.equal(r.musician, 'Gitta Gitaar');
  assert.equal(r.label, 'Fantasielabel'); // " (2)" weg
  assert.equal(r.barcode, '8712345678906');
  assert.equal(r.deviceType, 'LP');
  assert.equal(r.tracks, '2'); // kop "Kant A" telt niet mee
  assert.equal(r.length, '7:30');
});

test('drager alleen als dat type in Beheer bestaat', () => {
  assert.equal(A.kiesDrager(['CD'], typen), 'CD');
  assert.equal(A.kiesDrager(['12" Vinyl'], [{ name: 'Vinyl' }]), 'Vinyl');
  assert.equal(A.kiesDrager(['Cassette'], [{ name: 'CD' }]), '');
});

test('Discogs-id uit de links van een MusicBrainz-release', () => {
  const rel = { relations: [{ type: 'discogs', url: { resource: 'https://www.discogs.com/release/123456' } }] };
  assert.equal(A.discogsIdUitMb(rel), '123456');
  assert.equal(A.discogsIdUitMb({ relations: [] }), null);
});

test('MusicBrainz: origineel jaar, barcode en drager', () => {
  const r = A.uitMusicBrainz({ ...mbRelease, barcode: '0123456789012', 'release-group': { 'first-release-date': '1975-01-01' },
    media: [{ format: 'CD', 'track-count': 1, tracks: [{ length: 1000 }] }] }, [], typen);
  assert.deepEqual([r.origYear, r.barcode, r.deviceType], ['1975', '0123456789012', 'CD']);
});

test('credits eerst uit Discogs, overige velden eerst uit MusicBrainz', () => {
  const leeg = { artist: 'X', title: 'Y' };
  const uit = A.bepaalAanvulling(leeg, {
    MusicBrainz: { genre: 'Pop', producer: 'MB Producent' },
    Discogs: { genre: 'Soul', producer: 'Piet Producent' },
  });
  assert.deepEqual(uit.genre, { waarde: 'Pop', bron: 'MusicBrainz' });
  assert.deepEqual(uit.producer, { waarde: 'Piet Producent', bron: 'Discogs' });
});

test('nogLeeg telt al gevonden gegevens mee', () => {
  const a = { genre: '', year: '2000', origYear: '2000', label: 'L', tracks: '1', length: '1:00', barcode: '1', deviceType: 'CD', composer: '', producer: 'p', musician: 'm' };
  assert.deepEqual(A.nogLeeg(a, { MusicBrainz: { genre: 'Pop' } }), ['composer']);
});

// ── Fix-21: de albumartiest zelf niet bij Muzikant ──
test('de artiest van het album staat niet bij Muzikant', () => {
  const uit = A.bepaalAanvulling({ artist: 'Aretha Franklin', title: 'A Deeper Love' },
    { Discogs: { musician: 'Aretha Franklin, Martha Wash' } });
  assert.deepEqual(uit.musician, { waarde: 'Martha Wash', bron: 'Discogs' });
});

test('bij een duo vallen beide artiesten weg bij Muzikant', () => {
  assert.equal(A.zonderArtiest('Aretha Franklin, George Michael, Gitta Gitaar', 'Aretha Franklin & George Michael'), 'Gitta Gitaar');
});

test('alleen de artiest als muzikant: dan wordt Muzikant niet ingevuld, of uit de volgende bron', () => {
  const alleenArtiest = A.bepaalAanvulling({ artist: 'Aretha Franklin', title: 'X' }, { Discogs: { musician: 'Aretha Franklin' } });
  assert.equal(alleenArtiest.musician, undefined);
  const volgende = A.bepaalAanvulling({ artist: 'Aretha Franklin', title: 'X' },
    { Discogs: { musician: 'Aretha Franklin' }, MusicBrainz: { musician: 'Martha Wash' } });
  assert.deepEqual(volgende.musician, { waarde: 'Martha Wash', bron: 'MusicBrainz' });
});
