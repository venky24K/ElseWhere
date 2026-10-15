import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string) => void;
  loginWithGoogle: () => void;
  logout: () => void;
}

const AUTH_STORAGE_KEY = 'elsewhere_auth_user';

export const useAuthStore = create<AuthState>((set) => {
  // Restore persisted session from localStorage
  let initialUser: AuthUser | null = null;
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      initialUser = JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to parse stored auth user', err);
  }

  return {
    user: initialUser,
    isAuthenticated: Boolean(initialUser),

    login: (email: string) => {
      const username = email.split('@')[0] || 'Researcher';
      const user: AuthUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        email,
        name: username.charAt(0).toUpperCase() + username.slice(1),
      };
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } catch (err) {
        console.error('Failed to persist auth user', err);
      }
      set({ user, isAuthenticated: true });
    },

    loginWithGoogle: () => {
      const user: AuthUser = {
        id: 'google_' + Math.random().toString(36).substring(2, 9),
        email: 'scholar@gmail.com',
        name: 'Alex Rivera',
      };
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } catch (err) {
        console.error('Failed to persist auth user', err);
      }
      set({ user, isAuthenticated: true });
    },

    logout: () => {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch (err) {
        console.error('Failed to clear auth user', err);
      }
      set({ user: null, isAuthenticated: false });
    },
  };
});
