// Fix: fix-13 — Haalt testnamen uit een testbestand (Playwright en node:test: test('…'), it('…')).
export function haalTestnamen(bron) {
  const namen = [];
  const patroon = /\b(?:test|it)(?:\.(?:only|skip|fixme))?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = patroon.exec(bron)) !== null) {
    namen.push(m[2].replace(/\\(['"`\\])/g, '$1'));
  }
  return namen;
}

// Bepaal "fix-N" uit een commitbericht, of null.
export function fixUitBericht(bericht) {
  const m = /^(fix-\d+)\s*:/.exec(String(bericht || '').trim());
  return m ? m[1] : null;
}
