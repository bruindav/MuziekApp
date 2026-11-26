// Fix: fix-13 — Playlist-export als CSV in een formaat dat Tune My Music (en Soundiiz) herkent.
// Pure functies zonder DOM of Firebase, zodat ze los te testen zijn (tests/unit/export.test.mjs).
(function (root) {
  'use strict';

  // Kolomkoppen in het Engels: overzettools herkennen daarmee automatisch titel, artiest en album.
  const KOPPEN = ['Track Name', 'Artist Name', 'Album Name', 'Playlist Name'];

  // Eén CSV-veld: altijd tussen aanhalingstekens, interne " verdubbeld, regeleinden vervangen door spatie.
  function csvVeld(waarde) {
    const tekst = waarde == null ? '' : String(waarde);
    return '"' + tekst.replace(/\r?\n/g, ' ').replace(/"/g, '""') + '"';
  }

  // Zet een playlist om naar rijen. Tracks hebben een id met "_t", albums niet.
  // Albums krijgen een lege Track Name: overzettools zoeken op nummers, niet op hele albums.
  function playlistRijen(playlist, albums, trackItems) {
    const rijen = [];
    const naam = playlist && playlist.name ? playlist.name : '';
    const ids = (playlist && playlist.ids) || [];
    const lijst = albums || [];
    const tracks = trackItems || {};
    ids.forEach(function (id) {
      if (String(id).indexOf('_t') !== -1) {
        const t = tracks[id];
        if (t) rijen.push([t.title || '', t.artist || '', t.album || '', naam]);
      } else {
        const a = lijst.find(function (x) { return x.id === id; });
        if (a) rijen.push(['', a.artist || '', a.title || '', naam]);
      }
    });
    return rijen;
  }

  function bouwPlaylistCsv(playlist, albums, trackItems) {
    const rijen = [KOPPEN].concat(playlistRijen(playlist, albums, trackItems));
    return rijen.map(function (r) { return r.map(csvVeld).join(','); }).join('\r\n') + '\r\n';
  }

  // Veilige bestandsnaam: tekens die Windows/Android niet accepteren worden vervangen.
  function bestandsnaam(naam, extensie) {
    const schoon = String(naam || 'playlist').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'playlist';
    return schoon + '.' + extensie;
  }

  const api = { KOPPEN: KOPPEN, csvVeld: csvVeld, playlistRijen: playlistRijen, bouwPlaylistCsv: bouwPlaylistCsv, bestandsnaam: bestandsnaam };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MuziekExport = api;
})(typeof window !== 'undefined' ? window : globalThis);
