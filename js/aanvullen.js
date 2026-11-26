// Fix: fix-16/fix-18 — Ontbrekende albumgegevens aanvullen vanuit MusicBrainz, Discogs en iTunes.
// fix-18: alle velden uit het bewerkingsscherm die een muziekdienst kan weten (ook barcode, origineel jaar,
// drager, componist, producer, muzikant). Alleen pure functies (geen fetch, geen DOM), zodat ze los te testen zijn.
// De app (index.html) haalt de gegevens op en schrijft de wijzigingen weg.
(function (root) {
  'use strict';

  // Velden die aangevuld kunnen worden. Artiest/titel (verplicht), herkenningsnummer en opberglocatie
  // zijn van de gebruiker zelf en worden nooit aangevuld.
  const VELDEN = ['genre', 'year', 'origYear', 'label', 'tracks', 'length', 'barcode', 'deviceType', 'composer', 'producer', 'musician'];
  const MAX = { genre: 60, year: 4, origYear: 4, label: 100, tracks: 4, length: 10, barcode: 20, deviceType: 40, composer: 300, producer: 300, musician: 300 };
  // Volgorde van bronnen per veld: credits zijn bij Discogs het rijkst, de rest eerst MusicBrainz.
  const STANDAARD_VOLGORDE = ['MusicBrainz', 'Discogs', 'iTunes'];
  const VOLGORDE = { composer: ['Discogs', 'MusicBrainz'], producer: ['Discogs', 'MusicBrainz'], musician: ['Discogs', 'MusicBrainz'] };

  function isLeeg(v) {
    if (v == null) return true;
    const s = String(v).trim();
    return s === '' || s === '0' || s === '—' || s === '-';
  }

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

  // "3:45" of "1:02:05" → milliseconden; ongeldig → null
  function duurNaarMs(duur) {
    const delen = String(duur || '').trim().split(':').map(Number);
    if (delen.length < 2 || delen.some(isNaN)) return null;
    return delen.reduce(function (t, d) { return t * 60 + d; }, 0) * 1000;
  }

  function hoofdletter(s) {
    return String(s || '').replace(/(^|[\s\-\/&])([a-z])/g, function (_, voor, l) { return voor + l.toUpperCase(); });
  }

  function uniekeLijst(namen) {
    const gezien = [];
    namen.forEach(function (n) {
      const s = String(n || '').trim();
      if (s && gezien.indexOf(s) === -1) gezien.push(s);
    });
    return gezien.join(', ');
  }

  // Kies het dragertype van de gebruiker dat bij het formaat van de bron past ("CD", "Vinyl" + "LP", ...).
  // Alleen een bestaand type uit Beheer, anders leeg.
  function kiesDrager(formaten, typen) {
    const namen = (typen || []).map(function (t) { return typeof t === 'string' ? t : (t && t.name) || ''; }).filter(Boolean);
    const tekst = (formaten || []).join(' ').toLowerCase();
    if (!tekst || !namen.length) return '';
    let kandidaten = [];
    if (/vinyl|\blp\b|12"|7"|10"/.test(tekst)) kandidaten = /7"|single/.test(tekst) ? ['single', 'vinyl', 'lp', 'plaat'] : ['lp', 'vinyl', 'elpee', 'plaat', 'lp vinyl'];
    else if (/\bcd\b|compact disc|sacd|hdcd/.test(tekst)) kandidaten = ['cd', 'compact disc'];
    else if (/cassette|\bmc\b/.test(tekst)) kandidaten = ['cassette', 'mc', 'cassettebandje', 'tape'];
    else if (/dvd/.test(tekst)) kandidaten = ['dvd'];
    else if (/blu-?ray/.test(tekst)) kandidaten = ['blu-ray', 'bluray'];
    else if (/digital|file/.test(tekst)) kandidaten = ['digitaal', 'digital', 'download'];
    for (let i = 0; i < kandidaten.length; i++) {
      const hit = namen.find(function (n) { return n.toLowerCase().trim() === kandidaten[i]; });
      if (hit) return hit;
    }
    return '';
  }

  // ── MusicBrainz ─────────────────────────────────────────────
  function artiestVanMb(release) {
    return (release['artist-credit'] || []).map(function (c) { return (c.name || '') + (c.joinphrase || ''); }).join('');
  }

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

  // Discogs-release-id uit de links van een MusicBrainz-release (inc=url-rels)
  function discogsIdUitMb(release) {
    const rel = ((release && release.relations) || []).find(function (r) {
      return r.type === 'discogs' && r.url && /discogs\.com\/release\/\d+/.test(r.url.resource || '');
    });
    return rel ? rel.url.resource.match(/release\/(\d+)/)[1] : null;
  }

  // Gegevens uit een MusicBrainz-release (inc=genres+labels+recordings+release-groups+url-rels+artist-rels)
  function uitMusicBrainz(release, groepGenres, dragerTypen) {
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
    const groep = release['release-group'] || {};
    // Credits op releaseniveau (artist-rels)
    const credits = { composer: [], producer: [], musician: [] };
    (release.relations || []).forEach(function (r) {
      const naam = r.artist && r.artist.name;
      if (!naam) return;
      if (/^(composer|writer|lyricist)$/.test(r.type)) credits.composer.push(naam);
      else if (/producer/.test(r.type)) credits.producer.push(naam);
      else if (/^(instrument|vocal|performer|performing orchestra|conductor)$/.test(r.type)) credits.musician.push(naam);
    });
    return {
      genre: besteGenre(release.genres) || besteGenre(groepGenres),
      year: /^\d{4}/.test(release.date || '') ? release.date.slice(0, 4) : '',
      origYear: /^\d{4}/.test(groep['first-release-date'] || '') ? groep['first-release-date'].slice(0, 4) : '',
      label: label,
      tracks: tracks ? String(tracks) : '',
      length: compleet ? formatLengte(lengteMs) : '',
      barcode: /^\d{8,14}$/.test(release.barcode || '') ? release.barcode : '',
      deviceType: kiesDrager(media.map(function (m) { return m.format || ''; }), dragerTypen),
      composer: uniekeLijst(credits.composer),
      producer: uniekeLijst(credits.producer),
      musician: uniekeLijst(credits.musician),
    };
  }

  // ── Discogs ─────────────────────────────────────────────────
  // Discogs zet " (2)" achter namen die vaker voorkomen en "*" bij een variant: weghalen.
  function discogsNaam(n) {
    return String(n || '').replace(/\s*\(\d+\)$/, '').replace(/\*$/, '').trim();
  }

  const ROL_COMPONIST = /composed by|written-by|written by|music by|songwriter|lyrics by|words by/i;
  const ROL_PRODUCER = /producer|produced by/i;
  const ROL_MUZIKANT = /vocals|voice|guitar|bass|drums|percussion|piano|keyboards|organ|synthesizer|saxophone|trumpet|trombone|horn|flute|clarinet|violin|viola|cello|strings|harmonica|accordion|banjo|mandolin|performer|orchestra|conductor|choir|instruments/i;

  function uitDiscogs(release, dragerTypen) {
    if (!release) return {};
    const nummers = (release.tracklist || []).filter(function (t) { return !t.type_ || t.type_ === 'track'; });
    const duren = nummers.map(function (t) { return duurNaarMs(t.duration); });
    const credits = { composer: [], producer: [], musician: [] };
    let alleExtra = (release.extraartists || []).slice();
    nummers.forEach(function (t) { alleExtra = alleExtra.concat(t.extraartists || []); });
    alleExtra.forEach(function (x) {
      const naam = discogsNaam(x.name), rol = x.role || '';
      if (!naam) return;
      if (ROL_COMPONIST.test(rol)) credits.composer.push(naam);
      if (ROL_PRODUCER.test(rol)) credits.producer.push(naam);
      if (ROL_MUZIKANT.test(rol)) credits.musician.push(naam);
    });
    const barcode = ((release.identifiers || []).find(function (i) { return /barcode/i.test(i.type || ''); }) || {}).value || '';
    const barcodeCijfers = barcode.replace(/\D/g, '');
    const formaten = (release.formats || []).map(function (f) { return [f.name].concat(f.descriptions || []).join(' '); });
    const label = discogsNaam(((release.labels || [])[0] || {}).name);
    return {
      genre: (release.styles || [])[0] || (release.genres || [])[0] || '',
      year: release.year ? String(release.year) : '',
      label: /^not on label/i.test(label) ? '' : label,
      tracks: nummers.length ? String(nummers.length) : '',
      length: nummers.length && duren.every(function (d) { return d; }) ? formatLengte(duren.reduce(function (a, b) { return a + b; }, 0)) : '',
      barcode: /^\d{8,14}$/.test(barcodeCijfers) ? barcodeCijfers : '',
      deviceType: kiesDrager(formaten, dragerTypen),
      composer: uniekeLijst(credits.composer),
      producer: uniekeLijst(credits.producer),
      musician: uniekeLijst(credits.musician),
    };
  }

  // ── iTunes ──────────────────────────────────────────────────
  function kiesItunesAlbum(zoekresultaat, album) {
    const lijst = (zoekresultaat && zoekresultaat.results) || [];
    return lijst.find(function (r) {
      return lijktOp(r.artistName, album.artist) && lijktOp(r.collectionName, zoekTitel(album.title));
    }) || null;
  }

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

  // ── Samenvoegen ─────────────────────────────────────────────
  // bronnen: { MusicBrainz: {...}, Discogs: {...}, iTunes: {...} } (een ontbrekende bron mag)
  // Uitkomst: { genre: { waarde: 'Soul', bron: 'MusicBrainz' }, ... } — alleen velden die leeg waren.
  function bepaalAanvulling(album, bronnen) {
    const uit = {};
    legeVelden(album).forEach(function (veld) {
      const volgorde = VOLGORDE[veld] || STANDAARD_VOLGORDE;
      for (let i = 0; i < volgorde.length; i++) {
        const w = ((bronnen || {})[volgorde[i]] || {})[veld];
        if (!isLeeg(w)) {
          uit[veld] = { waarde: String(w).trim().slice(0, MAX[veld]), bron: volgorde[i] };
          break;
        }
      }
    });
    return uit;
  }

  // Welke velden zijn nog leeg nadat de al gevonden gegevens zijn meegeteld?
  function nogLeeg(album, bronnen) {
    const gevonden = bepaalAanvulling(album, bronnen);
    return legeVelden(album).filter(function (v) { return !gevonden[v]; });
  }

  function naarUpdate(aanvulling) {
    const upd = {};
    Object.keys(aanvulling).forEach(function (veld) { upd[veld] = aanvulling[veld].waarde; });
    if (upd.genre) upd.genreFirst = upd.genre.split(/[|;]/)[0].trim();
    return upd;
  }

  function naarOngedaan(aanvulling) {
    const upd = {};
    Object.keys(aanvulling).forEach(function (veld) { upd[veld] = ''; });
    if (aanvulling.genre) upd.genreFirst = '';
    return upd;
  }

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
    lijktOp: lijktOp, formatLengte: formatLengte, duurNaarMs: duurNaarMs, kiesDrager: kiesDrager,
    kiesMbRelease: kiesMbRelease, discogsIdUitMb: discogsIdUitMb, uitMusicBrainz: uitMusicBrainz,
    discogsNaam: discogsNaam, uitDiscogs: uitDiscogs, kiesItunesAlbum: kiesItunesAlbum, uitItunes: uitItunes,
    bepaalAanvulling: bepaalAanvulling, nogLeeg: nogLeeg, naarUpdate: naarUpdate, naarOngedaan: naarOngedaan,
    albumIdsVanPlaylist: albumIdsVanPlaylist,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MuziekAanvullen = api;
})(typeof window !== 'undefined' ? window : globalThis);
