// Fix: fix-16 — Ontbrekende albumgegevens (genre, jaar, label, tracks, lengte) aanvullen
// vanuit MusicBrainz en iTunes. Alleen pure functies (geen fetch, geen DOM), zodat ze los te testen zijn.
// De app (index.html) haalt de gegevens op en schrijft de wijzigingen weg.
(function (root) {
  'use strict';

  const VELDEN = ['genre', 'year', 'label', 'tracks', 'length'];
  const MAX = { genre: 60, year: 4, label: 100, tracks: 4, length: 10 };

  function isLeeg(v) {
    if (v == null) return true;
    const s = String(v).trim();
    return s === '' || s === '0' || s === '—' || s === '-';
  }

  // Welke van de aan te vullen velden zijn leeg bij dit album?
  function legeVelden(album) {
    return VELDEN.filter(function (v) { return isLeeg(album && album[v]); });
  }

  // Vergelijkbare tekst: kleine letters, zonder accenten, zonder "(Disc 1)"/"[Remastered]" en leestekens.
  function normaliseer(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/^the /, '')
      .trim();
  }

  // Zoekterm voor een titel: zonder toevoegingen tussen haakjes
  function zoekTitel(titel) {
    return String(titel || '').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function lijktOp(a, b) {
    const x = normaliseer(a), y = normaliseer(b);
    if (!x || !y) return false;
    if (x === y || x.indexOf(y) !== -1 || y.indexOf(x) !== -1) return true;
    const wx = x.split(' '), wy = y.split(' ');
    const gedeeld = wx.filter(function (w) { return wy.indexOf(w) !== -1; }).length;
    return gedeeld / Math.max(wx.length, wy.length) >= 0.6;
  }

  function formatLengte(ms) {
    const totaal = Math.round(Number(ms) / 1000);
    if (!totaal || totaal < 0) return '';
    const u = Math.floor(totaal / 3600), m = Math.floor((totaal % 3600) / 60), s = totaal % 60;
    const ss = String(s).padStart(2, '0');
    return u ? u + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
  }

  function hoofdletter(s) {
    return String(s || '').replace(/(^|[\s\-\/&])([a-z])/g, function (_, voor, l) { return voor + l.toUpperCase(); });
  }

  function artiestVanMb(release) {
    return (release['artist-credit'] || []).map(function (c) { return (c.name || '') + (c.joinphrase || ''); }).join('');
  }

  // Beste release uit een MusicBrainz-zoekresultaat: hoge score én artiest en titel lijken op het album.
  function kiesMbRelease(zoekresultaat, album) {
    const lijst = (zoekresultaat && zoekresultaat.releases) || [];
    return lijst.find(function (r) {
      return (r.score == null || r.score >= 85) &&
        lijktOp(artiestVanMb(r), album.artist) && lijktOp(r.title, zoekTitel(album.title));
    }) || null;
  }

  function besteGenre(genres) {
    const lijst = (genres || []).slice().sort(function (a, b) { return (b.count || 0) - (a.count || 0); });
    return lijst.length ? hoofdletter(lijst[0].name) : '';
  }

  // Gegevens uit een MusicBrainz-release (opgehaald met inc=genres+labels+recordings+release-groups).
  function uitMusicBrainz(release, groepGenres) {
    if (!release) return {};
    const media = release.media || [];
    const tracks = media.reduce(function (n, m) { return n + (m['track-count'] || (m.tracks || []).length || 0); }, 0);
    let lengteMs = 0, compleet = media.length > 0;
    media.forEach(function (m) {
      (m.tracks || []).forEach(function (t) { if (t.length) lengteMs += t.length; else compleet = false; });
      // Lengte alleen als alle nummers van dit medium bekend zijn
      if (!(m.tracks || []).length || (m['track-count'] && m.tracks.length !== m['track-count'])) compleet = false;
    });
    const labelInfo = (release['label-info'] || []).find(function (l) { return l.label && l.label.name; });
    const label = labelInfo && !/^\[no label\]$/i.test(labelInfo.label.name) ? labelInfo.label.name : '';
    return {
      genre: besteGenre(release.genres) || besteGenre(groepGenres),
      year: /^\d{4}/.test(release.date || '') ? release.date.slice(0, 4) : '',
      label: label,
      tracks: tracks ? String(tracks) : '',
      length: compleet ? formatLengte(lengteMs) : '',
    };
  }

  // Beste album uit een iTunes-zoekresultaat (entity=album)
  function kiesItunesAlbum(zoekresultaat, album) {
    const lijst = (zoekresultaat && zoekresultaat.results) || [];
    return lijst.find(function (r) {
      return lijktOp(r.artistName, album.artist) && lijktOp(r.collectionName, zoekTitel(album.title));
    }) || null;
  }

  // Gegevens uit een iTunes-album, optioneel met de nummers (lookup entity=song) voor de lengte.
  function uitItunes(itAlbum, nummers) {
    if (!itAlbum) return {};
    const songs = (nummers || []).filter(function (n) { return n.wrapperType === 'track'; });
    const ms = songs.reduce(function (n, s) { return n + (s.trackTimeMillis || 0); }, 0);
    return {
      genre: itAlbum.primaryGenreName || '',
      year: /^\d{4}/.test(itAlbum.releaseDate || '') ? itAlbum.releaseDate.slice(0, 4) : '',
      tracks: itAlbum.trackCount ? String(itAlbum.trackCount) : '',
      length: songs.length ? formatLengte(ms) : '',
    };
  }

  // Bepaal per leeg veld de waarde uit de beste bron: eerst MusicBrainz, dan iTunes.
  // Uitkomst: { genre: { waarde: 'Soul', bron: 'MusicBrainz' }, ... } — alleen velden die leeg waren.
  function bepaalAanvulling(album, mb, itunes) {
    const uit = {};
    legeVelden(album).forEach(function (veld) {
      const bronnen = [['MusicBrainz', mb || {}], ['iTunes', itunes || {}]];
      for (let i = 0; i < bronnen.length; i++) {
        const w = bronnen[i][1][veld];
        if (!isLeeg(w)) {
          uit[veld] = { waarde: String(w).trim().slice(0, MAX[veld]), bron: bronnen[i][0] };
          break;
        }
      }
    });
    return uit;
  }

  // Firestore-update voor de aanvulling; genreFirst loopt mee met genre (zoals in de rest van de app).
  function naarUpdate(aanvulling) {
    const upd = {};
    Object.keys(aanvulling).forEach(function (veld) { upd[veld] = aanvulling[veld].waarde; });
    if (upd.genre) upd.genreFirst = upd.genre.split(/[|;]/)[0].trim();
    return upd;
  }

  // Update om een aanvulling ongedaan te maken: de velden waren leeg, dus weer leeg maken.
  function naarOngedaan(aanvulling) {
    const upd = {};
    Object.keys(aanvulling).forEach(function (veld) { upd[veld] = ''; });
    if (aanvulling.genre) upd.genreFirst = '';
    return upd;
  }

  // Unieke album-id's van een playlist: albums zelf, en voor tracks het album waar ze op staan.
  function albumIdsVanPlaylist(playlist, trackItems) {
    const ids = [];
    ((playlist && playlist.ids) || []).forEach(function (id) {
      const albumId = String(id).indexOf('_t') !== -1 ? ((trackItems || {})[id] || {}).albumId : id;
      if (albumId && ids.indexOf(albumId) === -1) ids.push(albumId);
    });
    return ids;
  }

  const api = {
    VELDEN: VELDEN, isLeeg: isLeeg, legeVelden: legeVelden, normaliseer: normaliseer, zoekTitel: zoekTitel,
    lijktOp: lijktOp, formatLengte: formatLengte, kiesMbRelease: kiesMbRelease, uitMusicBrainz: uitMusicBrainz,
    kiesItunesAlbum: kiesItunesAlbum, uitItunes: uitItunes, bepaalAanvulling: bepaalAanvulling,
    naarUpdate: naarUpdate, naarOngedaan: naarOngedaan, albumIdsVanPlaylist: albumIdsVanPlaylist,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MuziekAanvullen = api;
})(typeof window !== 'undefined' ? window : globalThis);
