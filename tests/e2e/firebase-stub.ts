// Fix: fix-13/fix-14/fix-15 — Vervangt de Firebase-scripts in de e2e-tests door een nep-versie
// (standaard niet ingelogd; met { ingelogd: true } een verzonnen demogebruiker zonder gegevens).
// Zo raken de tests nooit de echte database en werken ze ook zonder internettoegang tot Firebase.
import type { Page } from '@playwright/test';

const NEP_FIREBASE = `
const leeg = () => ({});
export const initializeApp = leeg;
export const getFirestore = leeg;
export const getAuth = () => ({ currentUser: null });
// Een collectie onthoudt haar pad; onSnapshot geeft de verzonnen testdata van die collectie terug
export const collection = (_db, ...pad) => ({ pad });
export const query = ref => ref;
export const doc = leeg, orderBy = leeg, serverTimestamp = leeg;
export const addDoc = async () => ({}), setDoc = async () => {}, updateDoc = async () => {}, deleteDoc = async () => {};
export const getDocs = async () => ({ docs: [], empty: true, forEach() {} });
export const getDoc = async () => ({ exists: () => false, data: () => undefined });
export const onSnapshot = (ref, terug) => {
  const naam = ref && ref.pad ? ref.pad[ref.pad.length - 1] : '';
  const rijen = ((globalThis.__nepData || {})[naam]) || [];
  const docs = rijen.map(r => ({ id: r.id, data: () => ({ ...r }) }));
  setTimeout(() => terug({ docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) }), 0);
  return () => {};
};
export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => {} });
export const createUserWithEmailAndPassword = async () => { throw new Error('nep'); };
export const signInWithEmailAndPassword = async () => { throw new Error('nep'); };
export const signInWithPopup = async () => { throw new Error('nep'); };
export const signOut = async () => {};
export class GoogleAuthProvider {}
// Meld direct de (nep)gebruiker, of "geen gebruiker"
export const onAuthStateChanged = (_auth, terug) => { setTimeout(() => terug(globalThis.__nepGebruiker || null), 0); return () => {}; };
`;

// Verzonnen demogebruiker, geen echte persoonsgegevens
const NEP_GEBRUIKER = { uid: 'demo-uid-0001', email: 'demo@voorbeeld.nl', displayName: 'Demo Gebruiker' };

// data: verzonnen documenten per collectie, bijv. { albums: [{ id: 'a1', artist: 'De Testband', … }] }
export async function gebruikNepFirebase(page: Page, opties: { ingelogd?: boolean; data?: Record<string, object[]> } = {}) {
  if (opties.ingelogd) {
    await page.addInitScript(g => { (globalThis as any).__nepGebruiker = g; }, NEP_GEBRUIKER);
  }
  if (opties.data) {
    await page.addInitScript(d => { (globalThis as any).__nepData = d; }, opties.data);
  }
  await page.route('https://www.gstatic.com/firebasejs/**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: NEP_FIREBASE }));
}
