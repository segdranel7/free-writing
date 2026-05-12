import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  enableMultiTabIndexedDbPersistence,
  getFirestore
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const placeholderPatterns = [/^your-/i, /your-project/i, /your-sender/i, /your-app/i];

function isRealConfigValue(value: unknown) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !placeholderPatterns.some((pattern) => pattern.test(trimmed));
}

export const hasFirebaseConfig = Object.values(firebaseConfig).every(isRealConfigValue);

export const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;
export const db = app ? getFirestore(app) : null;

export function requireAuth() {
  if (!auth || !googleProvider) {
    throw new Error('Firebase is not configured. Add real Firebase values to .env and restart the dev server.');
  }
  return { auth, googleProvider };
}

export function requireDb() {
  if (!db) {
    throw new Error('Firebase is not configured. Add real Firebase values to .env and restart the dev server.');
  }
  return db;
}

export const offlinePersistenceReady = db
  ? enableMultiTabIndexedDbPersistence(db).catch((error) => {
      console.warn('Firestore offline persistence was not enabled:', error);
    })
  : Promise.resolve();
