// Fix: fix-13 — Unit-tests voor het uitlezen van testnamen en fixnummers (scripts/testnamen.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haalTestnamen, fixUitBericht } from '../../scripts/testnamen.mjs';

// Bouwt voorbeeldcode op, zodat dit bestand zelf geen nep-testnamen bevat voor het testoverzicht
const aanroep = (functie, naam) => functie + '(' + naam + ', () => {});';

test('vindt namen van test() en it(), ook met .skip', () => {
  const bron = [aanroep('test', "'eerste'"), aanroep('it', '"tweede"'), aanroep('test.skip', '`derde`')].join('\n');
  assert.deepEqual(haalTestnamen(bron), ['eerste', 'tweede', 'derde']);
});

test('negeert test.describe-groepen en houdt aanhalingstekens in de naam', () => {
  const bron = aanroep('test.describe', "'groep'") + aanroep('test', "'toont \\'fix\\' nummer'");
  assert.deepEqual(haalTestnamen(bron), ["toont 'fix' nummer"]);
});

test('leest het fixnummer uit een commitbericht', () => {
  assert.equal(fixUitBericht('fix-13: CSV voor Tune My Music'), 'fix-13');
  assert.equal(fixUitBericht('Merge branch fix-13'), null);
});
