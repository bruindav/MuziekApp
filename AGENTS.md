<!-- Fix: fix-17 — valkuil inline onclick en modulevariabelen -->
# MuziekApp — voor ontwikkelaars en AI-agents

Persoonlijke muziekbibliotheek (albums, tracks, playlists). Live: https://bruindav.github.io/MuziekApp/

## Opbouw

- `index.html` — de hele app (HTML, CSS en JavaScript in één bestand). Geen build-stap.
- `js/export.js` — pure export-functies (CSV), los gehouden zodat ze te testen zijn.
- `js/aanvullen.js` — pure functies om lege albumvelden aan te vullen uit MusicBrainz en iTunes (matching, keuze van
  de bron, Firestore-update en ongedaan maken). Het ophalen zelf (fetch, max. 1 MusicBrainz-verzoek per seconde) zit in `index.html`.
- Firebase Auth + Firestore (geladen van de Firebase-CDN). Toegang wordt afgedwongen in de Firestore-regels.
- Kleuren via themavariabelen in `:root` (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, …). Geen losse kleuren.

## Werkwijze per wijziging

1. `git pull` op `main`, maak branch `fix-N` (oplopend).
2. Zet `Fix: fix-N` met korte omschrijving als commentaar in elk gewijzigd bestand.
3. `git add …` en daarna **`node scripts/versie.mjs fix-N`**. Dit zet het fixnummer in de app
   (footer + helppagina) en maakt `testoverzicht.json` uit de git-geschiedenis plus de klaargezette testbestanden.
   Daarna `git add index.html testoverzicht.json`.
4. Commitbericht begint met `fix-N:`.
5. Push naar `fix-N`. GitHub Actions draait de controles. Testlink: `https://raw.githack.com/bruindav/MuziekApp/fix-N/index.html`
   (inloggen werkt daar niet, de helppagina en het fixnummer wel).
6. Merge naar `main` pas na akkoord van de opdrachtgever. Daarna deployt Actions naar GitHub Pages.

## Testen

- `npm run test:unit` — unit-tests met de ingebouwde Node-testrunner (`tests/unit/*.test.mjs`).
- `npm run test:e2e` — Playwright (`tests/e2e/*.spec.ts`), op desktop en op mobiel formaat (412 px breed).
  Firebase wordt in de e2e-tests vervangen door een nep-versie (`tests/e2e/firebase-stub.ts`), dus de tests raken
  nooit echte gegevens. Met `gebruikNepFirebase(page, { ingelogd: true, data: {...} })` geef je verzonnen testdata mee;
  `schrijfacties(page)` laat zien wat de app zou wegschrijven. Externe diensten (MusicBrainz, iTunes) boots je na met `page.route`. Geen Playwright-browser te downloaden? `PW_CHROME=/pad/naar/chrome npm run test:e2e`.
- `npm run controleer` — faalt als het fixnummer in de app niet bij de laatste `fix-N:`-commit past of als
  `testoverzicht.json` verouderd is.
- Schrijf Playwright-tests leesbaar: Nederlandse testnamen, selecteren op rol en label (`getByRole`, `getByLabel`),
  korte commentaarregels.

## Testoverzicht in de app

De footer met het fixnummer staat in de tabbalk (`.app-footer`): op mobiel als regel onder de tabs, op desktop rechts.
Lang indrukken (ca. 1 sec, of Enter/Spatie ingedrukt houden) op het fixnummer in de footer of op de helppagina
opent een overzicht per fix: welke testbestanden nieuw of aangepast zijn, met de testnamen en een link naar GitHub.

## Let op: inline `onclick` en modulevariabelen

De app-code staat in een `<script type="module">`. Variabelen daarin (`let activeAlpha`, `let editingAlbumId`, …) zijn
**niet** bereikbaar vanuit inline `onclick="…"`/`oninput="…"`: lezen geeft een fout, schrijven maakt stilletjes een
nieuwe globale variabele. Roep vanuit HTML altijd een `window.…`-functie aan die de modulevariabele gebruikt.

## Let op bij vaste (fixed) elementen

- Onzichtbare lagen (bijv. de melding `.toast` met `opacity:0`) moeten `pointer-events:none` hebben, anders blokkeren
  ze tikken op wat eronder ligt. Er is een e2e-test die dit controleert.
- Gebruik `var(--tabbar-h)` voor ruimte boven de tabbalk onderaan op mobiel, geen vaste pixels.

## Bekende beperkingen

- Discogs wordt niet gebruikt voor aanvullen: zoeken in Discogs vraagt een persoonlijke sleutel, en die mag niet in de app.

- Playlist rechtstreeks naar Deezer of Spotify kan niet: Deezer accepteert geen nieuwe apps en de Spotify Web API
  vereist Premium voor de eigenaar van de app. Alternatief: `↓ CSV` en importeren via Tune My Music.
