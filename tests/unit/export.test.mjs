// Fix: fix-13 — Unit-tests voor de CSV-export (js/export.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { bouwPlaylistCsv, csvVeld, bestandsnaam } = require('../../js/export.js');

// Verzonnen voorbeelddata
const albums = [{ id: 'a1', artist: 'De Verzonnen Band', title: 'Eerste Plaat', year: '1999', genre: 'Pop' }];
const trackItems = { a1_t3: { title: 'Lied "drie"', artist: 'De Verzonnen Band', album: 'Eerste Plaat' } };

test('CSV begint met de kolomkoppen die Tune My Music herkent', () => {
  const csv = bouwPlaylistCsv({ name: 'Test', ids: [] }, albums, trackItems);
  assert.equal(csv, '"Track Name","Artist Name","Album Name","Playlist Name"\r\n');
});

test('een track krijgt titel, artiest, album en playlistnaam', () => {
  const csv = bouwPlaylistCsv({ name: 'Franse avond', ids: ['a1_t3'] }, albums, trackItems);
  const regels = csv.trim().split('\r\n');
  assert.equal(regels[1], '"Lied ""drie""","De Verzonnen Band","Eerste Plaat","Franse avond"');
});

test('een album krijgt een lege tracktitel', () => {
  const csv = bouwPlaylistCsv({ name: 'Mix', ids: ['a1'] }, albums, trackItems);
  assert.equal(csv.trim().split('\r\n')[1], '"","De Verzonnen Band","Eerste Plaat","Mix"');
});

test('onbekende items worden overgeslagen', () => {
  const csv = bouwPlaylistCsv({ name: 'Mix', ids: ['bestaat-niet', 'x_t9'] }, albums, trackItems);
  assert.equal(csv.trim().split('\r\n').length, 1);
});

test('regeleinden in een veld worden een spatie', () => {
  assert.equal(csvVeld('regel1\nregel2'), '"regel1 regel2"');
});

test('bestandsnaam zonder verboden tekens', () => {
  assert.equal(bestandsnaam('Rock/Pop: "best of"', 'csv'), 'Rock_Pop_ _best of_.csv');
  assert.equal(bestandsnaam('', 'csv'), 'playlist.csv');
});
