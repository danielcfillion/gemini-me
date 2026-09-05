export type UserRole = 'user' | 'admin';
export type CoachTone = 'warm' | 'blunt';

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
  createdAt: string;
  updatedAt: string;
}

export type NavTab = 'today' | 'history' | 'profile';
