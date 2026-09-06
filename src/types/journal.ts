export type UserRole = 'user' | 'admin';
export type CoachTone = 'warm' | 'blunt';

export interface MoodData {
  score: number; // 1 to 5 (1: Low/Difficult, 2: Somber/Tired, 3: Calm/Even, 4: Content/Good, 5: Radiant/High)
  label: string; // e.g. "Peaceful", "Exhausted", "Optimistic"
}

export type NoteType = 'task' | 'idea' | 'plan' | 'habit' | 'win' | 'worry' | 'fact';

export type NoteStatus = 'open' | 'done' | 'dropped';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  coachTone: CoachTone;
  createdAt: string;
  updatedAt: string;
}

export interface JournalMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  ts: string;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  messages: JournalMessage[];
  summary: string;
  mood?: MoodData;
  lastExtractedMessageIndex?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
}

export interface Note {
  id: string;
  text: string;
  type: NoteType;
  boards: string[];
  status: NoteStatus;
  dueDate: string | null;
  sourceEntryId: string;
  sourceQuote: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposedNote {
  id: string;
  noteId?: string; // Optional: reference to existing note if this is an update
  text: string;
  type: NoteType;
  boards: string[];
  status?: NoteStatus;
  dueDate?: string | null;
  sourceQuote?: string;
}

export interface Proposal {
  id: string;
  status: 'pending' | 'applied' | 'discarded';
  entryDate: string;
  mood?: MoodData;
  suggestedNewBoard?: string | null;
  proposedNotes: ProposedNote[];
  createdAt: string;
  expiresAt: string;
  appliedAt?: string;
  discardedAt?: string;
  updatedAt?: string;
  origin?: 'extract' | 'coach';
}

export interface CoachProposalChange {
  noteId?: string;
  text?: string;
  boards?: string[];
  status?: NoteStatus;
  dueDate?: string | null;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  proposalId?: string | null;
  toolsUsed?: string[];
  ts: string;
}

export interface CoachSession {
  id: string;
  title?: string;
  messages: CoachMessage[];
  createdAt: string;
  updatedAt: string;
}

export type NavTab = 'today' | 'history' | 'boards' | 'profile';
