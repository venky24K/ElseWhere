import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import type { ProjectMetadata, VirtualFile } from '../types';
import type { AuthUser } from '../store/useAuthStore';

/**
 * Cloud Firestore Service
 * Handles user profiles, cloud project backup, and real-time document synchronization.
 */

export const firestoreService = {
  /**
   * Syncs authenticated user profile to `users/{userId}` collection
   */
  async syncUserProfile(user: AuthUser): Promise<void> {
    if (!isFirebaseConfigured || !user.id) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(
        userRef,
        {
          id: user.id,
          email: user.email,
          name: user.name,
          photoURL: user.avatarUrl || null,
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[Firestore] Failed to sync user profile:', err);
    }
  },

  /**
   * Saves or updates project metadata in `users/{userId}/projects/{projectId}`
   */
  async saveProjectMetadata(userId: string, project: ProjectMetadata): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const projectRef = doc(db, 'users', userId, 'projects', project.id);
      await setDoc(
        projectRef,
        {
          ...project,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[Firestore] Failed to save project metadata:', err);
    }
  },

  /**
   * Saves project virtual files (LaTeX, bib, python, assets) in `users/{userId}/projects/{projectId}/data/files`
   */
  async saveProjectFiles(
    userId: string,
    projectId: string,
    files: Record<string, VirtualFile>
  ): Promise<void> {
    if (!isFirebaseConfigured || !userId || !projectId) return;
    try {
      const filesRef = doc(db, 'users', userId, 'projects', projectId, 'data', 'files');
      await setDoc(
        filesRef,
        {
          files,
          lastSyncedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[Firestore] Failed to save project files:', err);
    }
  },

  /**
   * Loads all projects for a user from Firestore
   */
  async getUserProjects(userId: string): Promise<ProjectMetadata[]> {
    if (!isFirebaseConfigured || !userId) return [];
    try {
      const projectsCol = collection(db, 'users', userId, 'projects');
      const snapshot = await getDocs(projectsCol);
      return snapshot.docs.map((d) => d.data() as ProjectMetadata);
    } catch (err) {
      console.warn('[Firestore] Failed to fetch projects:', err);
      return [];
    }
  },

  /**
   * Loads project files from Firestore
   */
  async getProjectFiles(
    userId: string,
    projectId: string
  ): Promise<Record<string, VirtualFile> | null> {
    if (!isFirebaseConfigured || !userId || !projectId) return null;
    try {
      const filesRef = doc(db, 'users', userId, 'projects', projectId, 'data', 'files');
      const snap = await getDoc(filesRef);
      if (snap.exists()) {
        const data = snap.data();
        return (data.files as Record<string, VirtualFile>) || null;
      }
      return null;
    } catch (err) {
      console.warn('[Firestore] Failed to fetch project files:', err);
      return null;
    }
  },

  /**
   * Deletes a project from Firestore
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    if (!isFirebaseConfigured || !userId || !projectId) return;
    try {
      const projectRef = doc(db, 'users', userId, 'projects', projectId);
      await deleteDoc(projectRef);
    } catch (err) {
      console.warn('[Firestore] Failed to delete project:', err);
    }
  },

  /**
   * Subscribes to real-time project updates for a user
   */
  subscribeToProjects(
    userId: string,
    callback: (projects: ProjectMetadata[]) => void
  ): Unsubscribe | null {
    if (!isFirebaseConfigured || !userId) return null;
    try {
      const projectsCol = collection(db, 'users', userId, 'projects');
      return onSnapshot(projectsCol, (snapshot) => {
        const projects = snapshot.docs.map((d) => d.data() as ProjectMetadata);
        callback(projects);
      });
    } catch (err) {
      console.warn('[Firestore] Realtime subscription error:', err);
      return null;
    }
  },
};
