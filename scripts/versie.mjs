#!/usr/bin/env node
// Fix: fix-13 — Zet het fixnummer in de app en maakt testoverzicht.json uit de git-geschiedenis.
//
// Gebruik:
//   node scripts/versie.mjs fix-13     vóór de commit (na `git add`): zet fixnummer + maakt overzicht,
//                                      inclusief de testbestanden die nu klaarstaan voor de commit.
//   node scripts/versie.mjs --controleer   in GitHub Actions: faalt als het fixnummer in de app niet
//                                      gelijk is aan de laatste fix-commit of als het overzicht verouderd is.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { haalTestnamen, fixUitBericht } from './testnamen.mjs';

const REPO_URL = 'https://github.com/bruindav/MuziekApp';
const TESTMAP = 'tests/';
const APP = 'index.html';
const OVERZICHT = 'testoverzicht.json';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const fixGetal = f => Number(f.replace('fix-', ''));

// Voeg één gewijzigd bestand toe aan de fix. "nieuw" wint van "aangepast" binnen dezelfde fix.
function registreer(perFix, fix, pad, status, inhoud) {
  if (!perFix.has(fix)) perFix.set(fix, new Map());
  const bestanden = perFix.get(fix);
  const vorige = bestanden.get(pad);
  bestanden.set(pad, {
    pad,
    status: vorige && vorige.status === 'nieuw' ? 'nieuw' : status,
    url: `${REPO_URL}/blob/${fix}/${pad}`,
    tests: haalTestnamen(inhoud),
  });
}

function leesStatus(regel) {
  const delen = regel.split('\t');
  const code = delen[0][0];
  if (code === 'D') return null; // verwijderd: niet tonen
  const pad = code === 'R' || code === 'C' ? delen[2] : delen[1];
  return { pad, status: code === 'A' ? 'nieuw' : 'aangepast' };
}

function maakOverzicht(huidigeFix) {
  const perFix = new Map();
  const alleFixes = new Set();

  // Alle fixnummers uit de geschiedenis, ook fixes zonder tests.
  git('log', '--format=%s').split('\n').map(fixUitBericht).filter(Boolean).forEach(f => alleFixes.add(f));

  // Commits die testbestanden raken, oudste eerst.
  const log = git('log', '--reverse', '--format=@@%H%x09%s', '--name-status', '--', TESTMAP);
  let fix = null, sha = null;
  for (const regel of log.split('\n')) {
    if (!regel.trim()) continue;
    if (regel.startsWith('@@')) {
      const [h, ...bericht] = regel.slice(2).split('\t');
      sha = h; fix = fixUitBericht(bericht.join('\t'));
      continue;
    }
    if (!fix) continue;
    const s = leesStatus(regel);
    if (!s || !s.pad.startsWith(TESTMAP)) continue;
    registreer(perFix, fix, s.pad, s.status, git('show', `${sha}:${s.pad}`));
  }

  // Testbestanden die klaarstaan voor de commit van de huidige fix.
  if (huidigeFix) {
    alleFixes.add(huidigeFix);
    const klaar = git('diff', '--cached', '--name-status', '--', TESTMAP);
    for (const regel of klaar.split('\n')) {
      if (!regel.trim()) continue;
      const s = leesStatus(regel);
      if (s) registreer(perFix, huidigeFix, s.pad, s.status, git('show', `:${s.pad}`));
    }
  }

  const fixes = [...alleFixes]
    .sort((a, b) => fixGetal(b) - fixGetal(a))
    .map(f => ({
      fix: f,
      bestanden: [...(perFix.get(f) || new Map()).values()].sort((a, b) => a.pad.localeCompare(b.pad)),
    }));
  return JSON.stringify({ fixes }, null, 2) + '\n';
}

// Vervang het fixnummer op alle plekken in de app.
function zetFixnummer(html, fix) {
  return html
    .replace(/(<!-- MuziekApp )fix-\d+/, `$1${fix}`)
    .replace(/(data-fixnummer[^>]*aria-label="Versienummer )fix-\d+"/g, `$1${fix}"`)
    .replace(/(aria-label="Versienummer )fix-\d+("[^>]*data-fixnummer)/g, `$1${fix}$2`)
    .replace(/(<span[^>]*data-fixnummer[^>]*>)fix-\d+(<\/span>)/g, `$1${fix}$2`);
}

function fixnummersInApp(html) {
  return [...html.matchAll(/<span[^>]*data-fixnummer[^>]*>(fix-\d+)<\/span>/g)].map(m => m[1]);
}

const arg = process.argv[2];
if (arg === '--controleer') {
  const laatste = git('log', '--format=%s').split('\n').map(fixUitBericht).find(Boolean);
  const inApp = fixnummersInApp(readFileSync(APP, 'utf8'));
  const fouten = [];
  if (!inApp.length) fouten.push('Geen fixnummer-labels (data-fixnummer) gevonden in index.html.');
  inApp.filter(f => f !== laatste).forEach(f =>
    fouten.push(`Fixnummer in app is ${f}, maar de laatste commit is ${laatste}. Draai: node scripts/versie.mjs ${laatste}`));
  if (readFileSync(OVERZICHT, 'utf8') !== maakOverzicht(null))
    fouten.push(`${OVERZICHT} is verouderd. Draai vóór de commit: node scripts/versie.mjs ${laatste}`);
  if (fouten.length) { fouten.forEach(f => console.error('✗ ' + f)); process.exit(1); }
  console.log(`✓ Fixnummer ${laatste} en testoverzicht kloppen.`);
} else if (/^fix-\d+$/.test(arg || '')) {
  writeFileSync(APP, zetFixnummer(readFileSync(APP, 'utf8'), arg));
  writeFileSync(OVERZICHT, maakOverzicht(arg));
  console.log(`✓ Fixnummer ${arg} gezet en ${OVERZICHT} bijgewerkt.`);
} else {
  console.error('Gebruik: node scripts/versie.mjs fix-N  |  node scripts/versie.mjs --controleer');
  process.exit(2);
}
