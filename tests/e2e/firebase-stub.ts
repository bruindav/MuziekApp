// Fix: fix-13/fix-14 — Vervangt de Firebase-scripts in de e2e-tests door een nep-versie
// (standaard niet ingelogd; met { ingelogd: true } een verzonnen demogebruiker zonder gegevens).
// Zo raken de tests nooit de echte database en werken ze ook zonder internettoegang tot Firebase.
import type { Page } from '@playwright/test';

const NEP_FIREBASE = `
const leeg = () => ({});
export const initializeApp = leeg;
export const getFirestore = leeg;
export const getAuth = () => ({ currentUser: null });
export const collection = leeg, doc = leeg, query = leeg, orderBy = leeg, serverTimestamp = leeg;
export const addDoc = async () => ({}), setDoc = async () => {}, updateDoc = async () => {}, deleteDoc = async () => {};
export const getDocs = async () => ({ docs: [], empty: true, forEach() {} });
export const getDoc = async () => ({ exists: () => false, data: () => undefined });
export const onSnapshot = () => () => {};
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

export async function gebruikNepFirebase(page: Page, opties: { ingelogd?: boolean } = {}) {
  if (opties.ingelogd) {
    await page.addInitScript(g => { (globalThis as any).__nepGebruiker = g; }, NEP_GEBRUIKER);
  }
  await page.route('https://www.gstatic.com/firebasejs/**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: NEP_FIREBASE }));
}
