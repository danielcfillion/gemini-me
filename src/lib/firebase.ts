import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, JournalEntry, CoachTone } from '../types/journal';

// Helper to remove any undefined values recursively from payloads before saving to Firestore
export function sanitizePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth & Firestore with dedicated DatabaseId
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Sign in with Google Popup
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Sign-in failed:', error);
    throw error;
  }
}

// Sign out
export async function logOut(): Promise<void> {
  await signOut(auth);
}

// Get or initialize user profile
export async function getOrCreateUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    const data = snapshot.data();
    return {
      uid: user.uid,
      displayName: data.displayName || user.displayName || 'Friend',
      email: data.email || user.email || '',
      photoURL: data.photoURL || user.photoURL || undefined,
      role: data.role === 'admin' ? 'admin' : 'user',
      coachTone: data.coachTone === 'blunt' ? 'blunt' : 'warm',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  }

  const newProfile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || 'Friend',
    email: user.email || '',
    photoURL: user.photoURL || undefined,
    role: 'user',
    coachTone: 'warm',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(userRef, sanitizePayload(newProfile));
  return newProfile;
}

// Update coach tone in Firestore
export async function updateCoachTone(uid: string, tone: CoachTone): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    coachTone: tone,
    updatedAt: new Date().toISOString(),
  });
}

// Listen to a specific date entry (e.g. today)
export function subscribeToEntry(
  uid: string,
  dateKey: string,
  onUpdate: (entry: JournalEntry | null) => void,
  onError?: (err: Error) => void
): () => void {
  const entryRef = doc(db, 'users', uid, 'entries', dateKey);
  return onSnapshot(
    entryRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          id: dateKey,
          date: data.date || dateKey,
          messages: Array.isArray(data.messages) ? data.messages : [],
          summary: data.summary || '',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error(`Error subscribing to entry ${dateKey}:`, error);
      if (onError) onError(error);
    }
  );
}

// Persist or append messages to an entry document
export async function saveJournalEntry(
  uid: string,
  dateKey: string,
  entryData: Partial<JournalEntry>
): Promise<void> {
  const entryRef = doc(db, 'users', uid, 'entries', dateKey);
  const now = new Date().toISOString();

  const payload = sanitizePayload({
    ...entryData,
    date: dateKey,
    updatedAt: now,
  });

  await setDoc(entryRef, payload, { merge: true });
}

// Listen to user's journal entries sorted by date descending for History view
export function subscribeToUserEntries(
  uid: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  const entriesCol = collection(db, 'users', uid, 'entries');
  const entriesQuery = query(entriesCol, orderBy('date', 'desc'));

  return onSnapshot(
    entriesQuery,
    (snapshot) => {
      const items: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          date: data.date || docSnap.id,
          messages: Array.isArray(data.messages) ? data.messages : [],
          summary: data.summary || '',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Error fetching entries history:', error);
      if (onError) onError(error);
    }
  );
}
