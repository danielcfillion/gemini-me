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
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  UserProfile,
  JournalEntry,
  CoachTone,
  Board,
  Note,
  Proposal,
  ProposedNote,
  NoteType,
  NoteStatus,
  MoodData,
  CoachMessage,
  CoachSession,
  CoachProposalChange,
} from '../types/journal';

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

// Helper to retrieve current Firebase user ID token for authenticated backend requests
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    let user = auth.currentUser;
    if (!user && typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
      user = auth.currentUser;
    }
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.warn('[Firebase Auth] Failed to retrieve ID token for headers:', err);
  }
  return headers;
}

// Specification Requirement 1: Exactly Work, Family, Friends, Health, Money, Leisure, Goals
export const DEFAULT_BOARDS: Array<{ id: string; name: string; slug: string; description: string }> = [
  { id: 'work', name: 'Work', slug: 'work', description: 'Projects, milestones, career realizations, and professional tasks' },
  { id: 'family', name: 'Family', slug: 'family', description: 'Home life, relatives, traditions, and parenting' },
  { id: 'friends', name: 'Friends', slug: 'friends', description: 'Friendships, social gatherings, shared plans, and connections' },
  { id: 'health', name: 'Health', slug: 'health', description: 'Physical fitness, nutrition, rest, and mental well-being' },
  { id: 'money', name: 'Money', slug: 'money', description: 'Finances, budgeting, investments, purchases, and fiscal goals' },
  { id: 'leisure', name: 'Leisure', slug: 'leisure', description: 'Hobbies, travel, creative exploration, arts, and play' },
  { id: 'goals', name: 'Goals', slug: 'goals', description: 'Long-term aspirations, habits, systems, and self-growth' },
];

// Seed default boards and migrate any existing obsolete boards (e.g. replacing legacy Personal/Ideas)
export async function ensureDefaultBoards(uid: string): Promise<Board[]> {
  try {
    const boardsCol = collection(db, 'users', uid, 'boards');
    const snap = await getDocs(boardsCol);
    const existingBoards = new Map<string, Board>();

    snap.forEach((d) => {
      const data = d.data();
      existingBoards.set(d.id.toLowerCase(), {
        id: d.id,
        name: data.name || d.id,
        slug: data.slug || d.id,
        description: data.description || '',
        createdAt: data.createdAt || new Date().toISOString(),
      });
    });

    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let hasChanges = false;

    // Migrate or clean up obsolete boards (like legacy 'personal' or 'ideas')
    const legacyToTarget: Record<string, string> = {
      personal: 'leisure',
      ideas: 'goals',
    };

    for (const [legacyId] of Object.entries(legacyToTarget)) {
      if (existingBoards.has(legacyId)) {
        batch.delete(doc(db, 'users', uid, 'boards', legacyId));
        existingBoards.delete(legacyId);
        hasChanges = true;
      }
    }

    // Ensure all 7 required default boards exist
    for (const b of DEFAULT_BOARDS) {
      if (!existingBoards.has(b.id)) {
        const bRef = doc(db, 'users', uid, 'boards', b.id);
        const item: Board = {
          id: b.id,
          name: b.name,
          slug: b.slug,
          description: b.description,
          createdAt: now,
        };
        batch.set(bRef, sanitizePayload(item));
        existingBoards.set(b.id, item);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await batch.commit();
    }

    return Array.from(existingBoards.values());
  } catch (err) {
    console.error('Failed to ensure or migrate default boards:', err);
    return [];
  }
}

// Sign in with Google Popup
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (
      error?.code !== 'auth/popup-closed-by-user' &&
      error?.code !== 'auth/cancelled-popup-request'
    ) {
      console.error('Sign-in failed:', error);
    }
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

  // Ensure default boards exist and migrate legacy boards
  await ensureDefaultBoards(user.uid);

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

// Parse mood safely into { score: 1-5, label: string }
export function parseMood(rawMood: any): MoodData | undefined {
  if (!rawMood) return undefined;
  if (typeof rawMood === 'object' && typeof rawMood.score === 'number' && typeof rawMood.label === 'string') {
    return {
      score: Math.min(5, Math.max(1, Math.round(rawMood.score))),
      label: rawMood.label,
    };
  }
  // Legacy string fallback migration
  if (typeof rawMood === 'string') {
    const s = rawMood.toLowerCase();
    let score = 3;
    if (s.includes('energiz') || s.includes('joy') || s.includes('great')) score = 5;
    else if (s.includes('content') || s.includes('grateful') || s.includes('good')) score = 4;
    else if (s.includes('tired') || s.includes('weary')) score = 2;
    else if (s.includes('anxious') || s.includes('low') || s.includes('restless')) score = 1;
    return { score, label: rawMood.charAt(0).toUpperCase() + rawMood.slice(1) };
  }
  return undefined;
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
          mood: parseMood(data.mood),
          lastExtractedMessageIndex:
            typeof data.lastExtractedMessageIndex === 'number'
              ? data.lastExtractedMessageIndex
              : undefined,
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
          mood: parseMood(data.mood),
          lastExtractedMessageIndex:
            typeof data.lastExtractedMessageIndex === 'number'
              ? data.lastExtractedMessageIndex
              : undefined,
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

// ==================== BOARDS & NOTES ====================

// Listen to user's boards
export function subscribeToBoards(
  uid: string,
  onUpdate: (boards: Board[]) => void,
  onError?: (err: Error) => void
): () => void {
  const boardsCol = collection(db, 'users', uid, 'boards');
  const q = query(boardsCol, orderBy('name', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Board[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          name: data.name || d.id,
          slug: data.slug || d.id,
          description: data.description || '',
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Error subscribing to boards:', error);
      if (onError) onError(error);
    }
  );
}

// Create custom board
export async function createBoard(
  uid: string,
  name: string,
  description: string
): Promise<Board> {
  const cleanName = name.trim();
  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `board-${Date.now()}`;
  const boardRef = doc(db, 'users', uid, 'boards', slug);
  const newBoard: Board = {
    id: slug,
    name: cleanName,
    slug,
    description: description.trim(),
    createdAt: new Date().toISOString(),
  };
  await setDoc(boardRef, sanitizePayload(newBoard));
  return newBoard;
}

// Helper to normalize notes from Firestore (strictly uses single text field)
function normalizeNoteDoc(id: string, data: any): Note {
  const text = typeof data.text === 'string' ? data.text : '';

  // boards[]
  let boards: string[] = [];
  if (Array.isArray(data.boards) && data.boards.length > 0) {
    boards = data.boards.map(String);
  } else if (data.boardName) {
    boards = [String(data.boardName)];
  } else {
    boards = ['Work'];
  }

  // type (task|idea|plan|habit|win|worry|fact)
  const validTypes = new Set(['task', 'idea', 'plan', 'habit', 'win', 'worry', 'fact']);
  let type: NoteType = 'idea';
  if (data.type && validTypes.has(data.type)) {
    type = data.type;
  } else if (data.noteType) {
    if (data.noteType === 'action') type = 'task';
    else if (data.noteType === 'memory') type = 'fact';
    else if (data.noteType === 'insight') type = 'idea';
    else type = 'idea';
  }

  // status (open|done|dropped)
  let status: NoteStatus = 'open';
  if (data.status === 'done' || data.status === 'dropped') {
    status = data.status;
  }

  return {
    id,
    text,
    type,
    boards,
    status,
    dueDate: data.dueDate || null,
    sourceEntryId: data.sourceEntryId || data.entryDate || '',
    sourceQuote: data.sourceQuote || '',
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
  };
}

// Listen to all notes for user
export function subscribeToNotes(
  uid: string,
  onUpdate: (notes: Note[]) => void,
  onError?: (err: Error) => void
): () => void {
  const notesCol = collection(db, 'users', uid, 'notes');
  const q = query(notesCol, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Note[] = [];
      snapshot.forEach((d) => {
        items.push(normalizeNoteDoc(d.id, d.data()));
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Error subscribing to notes:', error);
      if (onError) onError(error);
    }
  );
}

// Board detail queries use where('boards', 'array-contains', boardName)
export function subscribeToBoardNotes(
  uid: string,
  boardName: string,
  onUpdate: (notes: Note[]) => void,
  onError?: (err: Error) => void
): () => void {
  const notesCol = collection(db, 'users', uid, 'notes');
  const q = query(
    notesCol,
    where('boards', 'array-contains', boardName)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Note[] = [];
      snapshot.forEach((d) => {
        items.push(normalizeNoteDoc(d.id, d.data()));
      });
      // Sort in memory by status (open first) then by createdAt desc
      items.sort((a, b) => {
        const order: Record<NoteStatus, number> = { open: 0, done: 1, dropped: 2 };
        if (order[a.status] !== order[b.status]) {
          return order[a.status] - order[b.status];
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
      onUpdate(items);
    },
    (error) => {
      console.error(`Error querying notes for board ${boardName}:`, error);
      if (onError) onError(error);
    }
  );
}

// Update note status (open | done | dropped)
export async function updateNoteStatus(
  uid: string,
  noteId: string,
  status: NoteStatus
): Promise<void> {
  const noteRef = doc(db, 'users', uid, 'notes', noteId);
  await updateDoc(noteRef, {
    status,
    updatedAt: new Date().toISOString(),
  });
}

// Delete a note
export async function deleteNote(uid: string, noteId: string): Promise<void> {
  const noteRef = doc(db, 'users', uid, 'notes', noteId);
  await deleteDoc(noteRef);
}

// Create a manual note directly
export async function createManualNote(
  uid: string,
  noteData: {
    text: string;
    type: NoteType;
    boards: string[];
    status?: NoteStatus;
    dueDate?: string | null;
    sourceEntryId?: string;
    sourceQuote?: string;
  }
): Promise<Note> {
  const noteRef = doc(collection(db, 'users', uid, 'notes'));
  const now = new Date().toISOString();
  const newNote: Note = {
    id: noteRef.id,
    text: noteData.text.trim(),
    type: noteData.type,
    boards: noteData.boards.length > 0 ? noteData.boards : ['Work'],
    status: noteData.status || 'open',
    dueDate: noteData.dueDate || null,
    sourceEntryId: noteData.sourceEntryId || '',
    sourceQuote: noteData.sourceQuote || '',
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(noteRef, sanitizePayload(newNote));
  return newNote;
}

// ==================== PROPOSALS (HUMAN-IN-THE-LOOP WRITE POLICY) ====================

// Listen to active pending proposals for the user
export function subscribeToPendingProposals(
  uid: string,
  onUpdate: (proposals: Proposal[]) => void,
  onError?: (err: Error) => void
): () => void {
  const proposalsCol = collection(db, 'users', uid, 'proposals');
  // Avoid multi-field composite index dependency by querying status only and sorting in memory
  const q = query(
    proposalsCol,
    where('status', '==', 'pending')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const nowIso = new Date().toISOString();
      const items: Proposal[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        // Drop expired proposals (> 7 days per Directive 9)
        if (data.expiresAt && data.expiresAt < nowIso) {
          return;
        }
        items.push({
          id: d.id,
          status: data.status || 'pending',
          entryDate: data.entryDate || '',
          mood: parseMood(data.mood) || { score: 3, label: 'Reflective' },
          suggestedNewBoard: data.suggestedNewBoard || null,
          proposedNotes: Array.isArray(data.proposedNotes)
            ? data.proposedNotes.map((pn: any) => {
                let boards: string[] = [];
                if (Array.isArray(pn.boards)) boards = pn.boards.map(String);
                else if (pn.boardName) boards = [String(pn.boardName)];
                else boards = ['Work'];

                const text = typeof pn.text === 'string' ? pn.text : '';
                return {
                  id: pn.id || `prop-${Math.random().toString(36).slice(2)}`,
                  text,
                  type: pn.type || 'idea',
                  boards,
                  status: pn.status || 'open',
                  dueDate: pn.dueDate || null,
                  sourceQuote: pn.sourceQuote || '',
                };
              })
            : [],
          createdAt: data.createdAt || nowIso,
          expiresAt: data.expiresAt || nowIso,
        });
      });
      // Sort descending by createdAt in client memory
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      // Ensure at most ONE pending proposal per entry date (Requirement 3)
      const deduplicated: Proposal[] = [];
      const seenDates = new Set<string>();
      for (const item of items) {
        if (!seenDates.has(item.entryDate)) {
          seenDates.add(item.entryDate);
          deduplicated.push(item);
        }
      }
      onUpdate(deduplicated);
    },
    (error) => {
      console.error('Error subscribing to proposals:', error);
      if (onError) onError(error);
    }
  );
}

// Upsert proposal for a given entry date: one pending proposal per entry, merges new notes into existing (Requirement 3 & 4)
export async function upsertProposalForEntry(
  uid: string,
  entryDate: string,
  data: {
    mood: MoodData;
    suggestedNewBoard?: string | null;
    newNotes: ProposedNote[];
  }
): Promise<string | null> {
  // Requirement 4: return empty and create nothing if no new notes
  if (!data.newNotes || data.newNotes.length === 0) {
    console.log(`[Gemini Me Firebase] No notes extracted for ${entryDate}. Creating nothing.`);
    return null;
  }

  console.log(`[Gemini Me Firebase] Upserting proposal for uid: ${uid}, entryDate: ${entryDate}, notes to add: ${data.newNotes.length}`);
  const proposalsCol = collection(db, 'users', uid, 'proposals');
  const q = query(
    proposalsCol,
    where('entryDate', '==', entryDate),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(q);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (!snapshot.empty) {
    // Found existing pending proposal for this entry: merge into primary doc
    const docs = snapshot.docs;
    const primaryDoc = docs[0];
    const primaryData = primaryDoc.data();

    const existingNotes: ProposedNote[] = Array.isArray(primaryData.proposedNotes)
      ? [...primaryData.proposedNotes]
      : [];

    // Clean up any extraneous pending proposal docs for the same date (Requirement 3)
    for (let i = 1; i < docs.length; i++) {
      const extraDoc = docs[i];
      const extraData = extraDoc.data();
      if (Array.isArray(extraData.proposedNotes)) {
        for (const en of extraData.proposedNotes) {
          const already = existingNotes.some(
            (n) =>
              (n.sourceQuote && en.sourceQuote && n.sourceQuote.trim().toLowerCase() === en.sourceQuote.trim().toLowerCase()) ||
              n.text.trim().toLowerCase() === en.text.trim().toLowerCase()
          );
          if (!already) existingNotes.push(en);
        }
      }
      await deleteDoc(doc(db, 'users', uid, 'proposals', extraDoc.id));
      console.log(`[Gemini Me Firebase] Deleted redundant proposal doc ${extraDoc.id} for ${entryDate}`);
    }

    // Merge newNotes into existingNotes avoiding duplicates
    for (const nn of data.newNotes) {
      const already = existingNotes.some(
        (n) =>
          (n.sourceQuote && nn.sourceQuote && n.sourceQuote.trim().toLowerCase() === nn.sourceQuote.trim().toLowerCase()) ||
          n.text.trim().toLowerCase() === nn.text.trim().toLowerCase()
      );
      if (!already) {
        existingNotes.push(nn);
      }
    }

    await updateDoc(
      doc(db, 'users', uid, 'proposals', primaryDoc.id),
      sanitizePayload({
        proposedNotes: existingNotes,
        mood: data.mood || primaryData.mood,
        suggestedNewBoard: data.suggestedNewBoard || primaryData.suggestedNewBoard || null,
        updatedAt: now.toISOString(),
        expiresAt,
      })
    );

    console.log(`[Gemini Me Firebase] Merged notes into existing proposal ${primaryDoc.id}. Total notes: ${existingNotes.length}`);
    return primaryDoc.id;
  } else {
    // Create single new pending proposal
    const newProposalRef = doc(proposalsCol);
    const proposalDoc: Proposal = {
      id: newProposalRef.id,
      status: 'pending',
      entryDate,
      mood: data.mood,
      suggestedNewBoard: data.suggestedNewBoard || null,
      proposedNotes: data.newNotes,
      createdAt: now.toISOString(),
      expiresAt,
    };

    await setDoc(newProposalRef, sanitizePayload(proposalDoc));
    console.log(`[Gemini Me Firebase] Created new proposal doc ${newProposalRef.id} for ${entryDate}`);
    return newProposalRef.id;
  }
}

// Create a pending proposal (WHERE PROPOSAL IS CREATED)
export async function createProposal(
  uid: string,
  data: {
    entryDate: string;
    mood: MoodData;
    suggestedNewBoard?: string | null;
    proposedNotes: ProposedNote[];
  }
): Promise<string> {
  console.log(`[Gemini Me Firebase] Creating proposal for uid: ${uid}, entryDate: ${data.entryDate}, notes: ${data.proposedNotes.length}`);
  const proposalsCol = collection(db, 'users', uid, 'proposals');
  const newProposalRef = doc(proposalsCol);
  const now = new Date();
  // 7-day expiration per Human-in-the-Loop Write Policy (Directive 9)
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const proposalDoc: Proposal = {
    id: newProposalRef.id,
    status: 'pending',
    entryDate: data.entryDate,
    mood: data.mood,
    suggestedNewBoard: data.suggestedNewBoard || null,
    proposedNotes: data.proposedNotes,
    createdAt: now.toISOString(),
    expiresAt,
  };

  await setDoc(newProposalRef, sanitizePayload(proposalDoc));
  console.log(`[Gemini Me Firebase] Successfully created proposal doc: ${newProposalRef.id}`);
  return newProposalRef.id;
}

// Update a pending proposal in-place (e.g. user edits note text, toggles boards, edits mood)
export async function updateProposal(
  uid: string,
  proposalId: string,
  updates: Partial<Proposal>
): Promise<void> {
  const proposalRef = doc(db, 'users', uid, 'proposals', proposalId);
  await updateDoc(proposalRef, sanitizePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
  }));
}

// Discard a proposal without applying any changes
export async function discardProposal(uid: string, proposalId: string): Promise<void> {
  const proposalRef = doc(db, 'users', uid, 'proposals', proposalId);
  await updateDoc(proposalRef, {
    status: 'discarded',
    discardedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// Apply proposal (WHERE NOTES ARE WRITTEN, OPTIONAL BOARD IS CREATED, AND MOOD IS SAVED ON THE ENTRY)
// Executed only upon explicit user confirmation
export async function applyProposal(
  uid: string,
  proposalId: string,
  activeProposal: Proposal,
  createNewBoardName?: string | null
): Promise<void> {
  const proposalRef = doc(db, 'users', uid, 'proposals', proposalId);
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 1. Optionally create the suggested new board if the user checked the checkbox
  if (createNewBoardName && createNewBoardName.trim()) {
    const cleanName = createNewBoardName.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `board-${Date.now()}`;
    const boardRef = doc(db, 'users', uid, 'boards', slug);
    const newBoard: Board = {
      id: slug,
      name: cleanName,
      slug,
      description: `Discovered from your journal reflections`,
      createdAt: now,
    };
    batch.set(boardRef, sanitizePayload(newBoard));
  }

  // 2. Write approved notes to users/{uid}/notes/{noteId} or update existing
  if (Array.isArray(activeProposal.proposedNotes)) {
    for (const pNote of activeProposal.proposedNotes) {
      if (!pNote.text?.trim()) continue;

      if (pNote.noteId) {
        // Update existing note
        const noteRef = doc(db, 'users', uid, 'notes', pNote.noteId);
        batch.update(noteRef, sanitizePayload({
          ...(pNote.text ? { text: pNote.text.trim() } : {}),
          ...(pNote.type ? { type: pNote.type } : {}),
          ...(pNote.boards ? { boards: pNote.boards } : {}),
          ...(pNote.status ? { status: pNote.status } : {}),
          ...(pNote.dueDate !== undefined ? { dueDate: pNote.dueDate } : {}),
          updatedAt: now,
        }));
      } else {
        // Create new note
        const noteRef = doc(collection(db, 'users', uid, 'notes'));
        const newNote: Note = {
          id: noteRef.id,
          text: pNote.text.trim(),
          type: pNote.type || 'idea',
          boards: Array.isArray(pNote.boards) && pNote.boards.length > 0 ? pNote.boards : ['Work'],
          status: pNote.status || 'open',
          dueDate: pNote.dueDate || null,
          sourceEntryId: activeProposal.entryDate || '',
          sourceQuote: pNote.sourceQuote || '',
          createdAt: now,
          updatedAt: now,
        };
        batch.set(noteRef, sanitizePayload(newNote));
      }
    }
  }

  // 3. Save mood { score: 1-5, label: string } on the originating journal entry
  if (activeProposal.entryDate && activeProposal.mood) {
    const entryRef = doc(db, 'users', uid, 'entries', activeProposal.entryDate);
    batch.set(
      entryRef,
      sanitizePayload({
        mood: activeProposal.mood,
        updatedAt: now,
      }),
      { merge: true }
    );
  }

  // 4. Mark proposal as applied
  batch.update(proposalRef, {
    status: 'applied',
    appliedAt: now,
    updatedAt: now,
  });

  await batch.commit();
}

// ==================== COACH CHAT & TOOLS PERSISTENCE ====================

// Search entries function (Directive 10 & Coach tool 1)
export async function searchEntries(
  uid: string,
  queryText: string,
  limitCount: number = 5
): Promise<Array<{ date: string; summary: string; relevantSnippets: string[] }>> {
  try {
    const entriesCol = collection(db, 'users', uid, 'entries');
    const q = query(entriesCol, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    const results: Array<{ date: string; summary: string; relevantSnippets: string[] }> = [];

    const terms = queryText.toLowerCase().split(/\s+/).filter((t) => t.length > 1);

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const date = data.date || docSnap.id;
      const summary = typeof data.summary === 'string' ? data.summary : '';
      const messages: Array<{ role?: string; text?: string }> = Array.isArray(data.messages) ? data.messages : [];

      const userTexts = messages
        .filter((m) => m.role === 'user' && m.text)
        .map((m) => String(m.text));

      const combinedSearchBody = `${date} ${summary} ${userTexts.join(' ')}`.toLowerCase();

      // Check if any search term matches
      const matches = terms.some((term) => combinedSearchBody.includes(term));
      if (matches || terms.length === 0) {
        // Collect relevant snippets
        const snippets: string[] = [];
        if (summary) snippets.push(summary);
        for (const ut of userTexts) {
          if (terms.some((t) => ut.toLowerCase().includes(t))) {
            snippets.push(ut.slice(0, 160));
          }
          if (snippets.length >= 3) break;
        }

        results.push({
          date,
          summary,
          relevantSnippets: snippets.slice(0, 3),
        });
      }
    });

    return results.slice(0, limitCount);
  } catch (err) {
    console.error('Error in searchEntries:', err);
    return [];
  }
}

// List notes with optional board, status, and dueBefore filters (Coach tool 2)
export async function listNotes(
  uid: string,
  filters?: { board?: string; status?: string; dueBefore?: string }
): Promise<Note[]> {
  try {
    const notesCol = collection(db, 'users', uid, 'notes');
    const snapshot = await getDocs(notesCol);
    let items: Note[] = [];

    snapshot.forEach((d) => {
      items.push(normalizeNoteDoc(d.id, d.data()));
    });

    if (filters?.board) {
      const target = filters.board.toLowerCase();
      items = items.filter((n) => n.boards.some((b) => b.toLowerCase() === target));
    }

    if (filters?.status) {
      items = items.filter((n) => n.status === filters.status);
    }

    if (filters?.dueBefore) {
      items = items.filter((n) => n.dueDate && n.dueDate <= filters.dueBefore!);
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  } catch (err) {
    console.error('Error in listNotes:', err);
    return [];
  }
}

// Get board state: open notes plus last three entry summaries touching that board (Coach tool 3)
export async function getBoardState(
  uid: string,
  boardName: string
): Promise<{
  board: string;
  openNotes: Note[];
  recentEntrySummaries: Array<{ date: string; summary: string }>;
}> {
  try {
    const cleanBoard = boardName.trim();
    // 1. Get open notes
    const allBoardNotes = await listNotes(uid, { board: cleanBoard, status: 'open' });

    // 2. Find entry summaries touching this board
    const entriesCol = collection(db, 'users', uid, 'entries');
    const q = query(entriesCol, orderBy('date', 'desc'));
    const entrySnaps = await getDocs(q);

    const summaries: Array<{ date: string; summary: string }> = [];
    const sourceDates = new Set(allBoardNotes.map((n) => n.sourceEntryId).filter(Boolean));

    entrySnaps.forEach((d) => {
      if (summaries.length >= 3) return;
      const data = d.data();
      const date = data.date || d.id;
      const summary = typeof data.summary === 'string' ? data.summary : '';

      // Check if entry directly produced a note on this board, or summary/text mentions this board
      const touchesBoard =
        sourceDates.has(date) ||
        (summary && summary.toLowerCase().includes(cleanBoard.toLowerCase()));

      if (touchesBoard && summary) {
        summaries.push({ date, summary });
      }
    });

    return {
      board: cleanBoard,
      openNotes: allBoardNotes,
      recentEntrySummaries: summaries,
    };
  } catch (err) {
    console.error('Error in getBoardState:', err);
    return {
      board: boardName,
      openNotes: [],
      recentEntrySummaries: [],
    };
  }
}

// Propose note changes: creates proposal document ONLY, never applies changes (Coach tool 4)
export async function createCoachProposal(
  uid: string,
  changes: CoachProposalChange[]
): Promise<string> {
  const proposalsCol = collection(db, 'users', uid, 'proposals');
  const newProposalRef = doc(proposalsCol);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Map changes into proposed notes
  const proposedNotes: ProposedNote[] = changes.map((c, i) => ({
    id: `coach-prop-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    noteId: c.noteId,
    text: (c.text || '').trim(),
    type: 'task', // default or preserved
    boards: Array.isArray(c.boards) && c.boards.length > 0 ? c.boards : ['Work'],
    status: c.status || 'open',
    dueDate: c.dueDate || null,
  }));

  const proposalDoc: Proposal = {
    id: newProposalRef.id,
    status: 'pending',
    entryDate: now.toISOString().slice(0, 10),
    proposedNotes,
    origin: 'coach',
    createdAt: now.toISOString(),
    expiresAt,
  };

  await setDoc(newProposalRef, sanitizePayload(proposalDoc));
  console.log(`[Mini-Me Coach] Created proposal ${newProposalRef.id} with ${proposedNotes.length} change(s)`);
  return newProposalRef.id;
}

// Subscribe to a specific coach session
export function subscribeToCoachSession(
  uid: string,
  sessionId: string,
  onUpdate: (session: CoachSession | null) => void,
  onError?: (err: Error) => void
): () => void {
  const sessionRef = doc(db, 'users', uid, 'coachSessions', sessionId);
  return onSnapshot(
    sessionRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          id: sessionId,
          title: data.title || 'Coach Chat',
          messages: Array.isArray(data.messages) ? data.messages : [],
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error(`Error subscribing to coach session ${sessionId}:`, error);
      if (onError) onError(error);
    }
  );
}

// Persist coach session updates
export async function saveCoachSession(
  uid: string,
  sessionId: string,
  sessionData: Partial<CoachSession>
): Promise<void> {
  const sessionRef = doc(db, 'users', uid, 'coachSessions', sessionId);
  const now = new Date().toISOString();

  const payload = sanitizePayload({
    ...sessionData,
    id: sessionId,
    updatedAt: now,
  });

  await setDoc(sessionRef, payload, { merge: true });
}

// Fetch all coach sessions for user ordered by updatedAt desc
export function subscribeToCoachSessions(
  uid: string,
  onUpdate: (sessions: CoachSession[]) => void,
  onError?: (err: Error) => void
): () => void {
  const sessionsCol = collection(db, 'users', uid, 'coachSessions');
  const q = query(sessionsCol, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CoachSession[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          title: data.title || 'Coach Chat',
          messages: Array.isArray(data.messages) ? data.messages : [],
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Error querying coach sessions:', error);
      if (onError) onError(error);
    }
  );
}
