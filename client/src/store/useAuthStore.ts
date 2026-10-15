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
  emailVerified?: boolean;
  createdAt?: string;
  lastSignInAt?: string;
  providerId?: string;
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
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            avatarUrl: fbUser.photoURL || undefined,
            isFirebaseUser: true,
            emailVerified: fbUser.emailVerified,
            createdAt: fbUser.metadata?.creationTime,
            lastSignInAt: fbUser.metadata?.lastSignInTime,
            providerId: fbUser.providerData?.[0]?.providerId || 'firebase',
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
          name: fbUser.displayName || email.split('@')[0] || 'User',
          avatarUrl: fbUser.photoURL || undefined,
          isFirebaseUser: true,
          emailVerified: fbUser.emailVerified,
          createdAt: fbUser.metadata?.creationTime,
          lastSignInAt: fbUser.metadata?.lastSignInTime,
          providerId: 'password',
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } catch (e) {}
        set({ user: authUser, isAuthenticated: true });
        await firestoreService.syncUserProfile(authUser);
      } else {
        const username = email.split('@')[0] || 'User';
        const authUser: AuthUser = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          name: username.charAt(0).toUpperCase() + username.slice(1),
          isFirebaseUser: false,
          emailVerified: false,
          createdAt: new Date().toISOString(),
          providerId: 'password',
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
          name: email.split('@')[0] || 'User',
          avatarUrl: fbUser.photoURL || undefined,
          isFirebaseUser: true,
          emailVerified: fbUser.emailVerified,
          createdAt: fbUser.metadata?.creationTime,
          lastSignInAt: fbUser.metadata?.lastSignInTime,
          providerId: 'password',
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } catch (e) {}
        set({ user: authUser, isAuthenticated: true });
        await firestoreService.syncUserProfile(authUser);
      } else {
        const username = email.split('@')[0] || 'User';
        const authUser: AuthUser = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          name: username.charAt(0).toUpperCase() + username.slice(1),
          isFirebaseUser: false,
          emailVerified: false,
          createdAt: new Date().toISOString(),
          providerId: 'password',
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
          name: fbUser.displayName || 'Google User',
          avatarUrl: fbUser.photoURL || undefined,
          isFirebaseUser: true,
          emailVerified: true,
          createdAt: fbUser.metadata?.creationTime,
          lastSignInAt: fbUser.metadata?.lastSignInTime,
          providerId: 'google.com',
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } catch (e) {}
        set({ user: authUser, isAuthenticated: true });
        await firestoreService.syncUserProfile(authUser);
      } else {
        const authUser: AuthUser = {
          id: 'google_' + Math.random().toString(36).substring(2, 9),
          email: 'user@gmail.com',
          name: 'User',
          isFirebaseUser: false,
          emailVerified: true,
          createdAt: new Date().toISOString(),
          providerId: 'google.com',
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
