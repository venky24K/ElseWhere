import { create } from 'zustand';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import { firestoreService } from '../services/firestoreService';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isFirebaseUser?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'elsewhere_auth_user';

export const useAuthStore = create<AuthState>((set) => {
  // Restore persisted session from localStorage as fast initial state
  let initialUser: AuthUser | null = null;
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      initialUser = JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to parse stored auth user', err);
  }

  // Set up Firebase Auth real-time state listener
  if (typeof window !== 'undefined') {
    try {
      onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          const authUser: AuthUser = {
            id: fbUser.uid,
            email: fbUser.email || '',
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Researcher',
            avatarUrl: fbUser.photoURL || undefined,
            isFirebaseUser: true,
          };
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
          } catch (e) {}
          set({ user: authUser, isAuthenticated: true, isInitializing: false });

          // Sync profile to Firestore
          await firestoreService.syncUserProfile(authUser);
        } else {
          // If no active Firebase user and not a local demo session, clear
          set((state) => {
            if (state.user?.isFirebaseUser) {
              try {
                localStorage.removeItem(AUTH_STORAGE_KEY);
              } catch (e) {}
              return { user: null, isAuthenticated: false, isInitializing: false };
            }
            return { isInitializing: false };
          });
        }
      });
    } catch (err) {
      console.warn('Firebase onAuthStateChanged setup warning:', err);
    }
  }

  return {
    user: initialUser,
    isAuthenticated: Boolean(initialUser),
    isInitializing: isFirebaseConfigured,

    loginWithEmail: async (email: string, password: string) => {
      if (isFirebaseConfigured) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const fbUser = cred.user;
        const authUser: AuthUser = {
          id: fbUser.uid,
          email: fbUser.email || email,
          name: fbUser.displayName || email.split('@')[0] || 'Researcher',
          avatarUrl: fbUser.photoURL || undefined,
          isFirebaseUser: true,
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } catch (e) {}
        set({ user: authUser, isAuthenticated: true });
        await firestoreService.syncUserProfile(authUser);
      } else {
        // Fallback local demo mode when running without production API keys
        const username = email.split('@')[0] || 'Researcher';
        const authUser: AuthUser = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          name: username.charAt(0).toUpperCase() + username.slice(1),
          isFirebaseUser: false,
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } catch (e) {}
        set({ user: authUser, isAuthenticated: true });
      }
    },

    signUpWithEmail: async (email: string, password: string) => {
      if (isFirebaseConfigured) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const fbUser = cred.user;
        const authUser: AuthUser = {
          id: fbUser.uid,
          email: fbUser.email || email,
          name: email.split('@')[0] || 'Researcher',
          avatarUrl: fbUser.photoURL || undefined,
          isFirebaseUser: true,
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } catch (e) {}
        set({ user: authUser, isAuthenticated: true });
        await firestoreService.syncUserProfile(authUser);
      } else {
        const username = email.split('@')[0] || 'Researcher';
        const authUser: AuthUser = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          name: username.charAt(0).toUpperCase() + username.slice(1),
          isFirebaseUser: false,
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } catch (e) {}
        set({ user: authUser, isAuthenticated: true });
      }
    },

    loginWithGoogle: async () => {
      if (isFirebaseConfigured) {
        const cred = await signInWithPopup(auth, googleProvider);
        const fbUser = cred.user;
        const authUser: AuthUser = {
          id: fbUser.uid,
          email: fbUser.email || '',
          name: fbUser.displayName || 'Researcher',
          avatarUrl: fbUser.photoURL || undefined,
          isFirebaseUser: true,
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } catch (e) {}
        set({ user: authUser, isAuthenticated: true });
        await firestoreService.syncUserProfile(authUser);
      } else {
        // Fallback local demo user
        const authUser: AuthUser = {
          id: 'google_' + Math.random().toString(36).substring(2, 9),
          email: 'scholar@gmail.com',
          name: 'Alex Rivera',
          isFirebaseUser: false,
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } catch (e) {}
        set({ user: authUser, isAuthenticated: true });
      }
    },

    logout: async () => {
      if (isFirebaseConfigured) {
        try {
          await signOut(auth);
        } catch (err) {
          console.warn('Firebase signOut error:', err);
        }
      }
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch (err) {
        console.error('Failed to clear auth user', err);
      }
      set({ user: null, isAuthenticated: false });
    },
  };
});
