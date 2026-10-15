import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

/**
 * Firebase Project Configuration
 * Loads environment variables from Vite (.env or GCP Cloud Run environment).
 * Default fallback configured for GCP project: elsewhere-511504
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCBUyzboHIcSDxMWAWNn_7D4x5S00IvPy0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'elsewhere-511504.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'elsewhere-511504',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'elsewhere-511504.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1069771672687',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1069771672687:web:6f3849bc17b0b0261fd19a',
};

// Check if user has supplied valid production API key
export const isFirebaseConfigured = true;

// Initialize Firebase App singleton
export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Authentication service instance
export const auth: Auth = getAuth(app);

// Google OAuth Provider instance
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Cloud Firestore Database instance
export const db: Firestore = getFirestore(app);
