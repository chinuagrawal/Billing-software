import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const missingFirebaseConfig = [
  ['VITE_FIREBASE_API_KEY', config.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', config.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', config.projectId],
  ['VITE_FIREBASE_APP_ID', config.appId],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);
export const firebaseConfigured = missingFirebaseConfig.length === 0;
const app = firebaseConfigured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
