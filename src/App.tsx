import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  getOrCreateUserProfile,
  ensureDefaultBoards,
  subscribeToBoards,
  subscribeToNotes,
  subscribeToUserEntries,
} from './lib/firebase';
import { UserProfile, NavTab, Board, Note, JournalEntry } from './types/journal';
import { AuthLanding } from './components/AuthLanding';
import { Navigation } from './components/Navigation';
import { TodayView } from './components/TodayView';
import { HistoryView } from './components/HistoryView';
import { BoardsView } from './components/BoardsView';
import { ProfileView } from './components/ProfileView';
import { CoachDrawer } from './components/CoachDrawer';
import { Sparkles } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState<NavTab>('today');
  const [isCoachOpen, setIsCoachOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const profile = await getOrCreateUserProfile(user);
          setUserProfile(profile);
          // Seed default boards (Work, Personal, Ideas, Health) on first sign-in
          await ensureDefaultBoards(user.uid);
        } catch (err) {
          console.error('Error fetching user profile:', err);
          // Fallback profile if Firestore read has an issue
          setUserProfile({
            uid: user.uid,
            displayName: user.displayName || 'Friend',
            email: user.email || '',
            role: 'user',
            coachTone: 'warm',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        setUserProfile(null);
      }
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to user's boards, notes, and entries when authenticated
  useEffect(() => {
    if (!currentUser) {
      setBoards([]);
      setNotes([]);
      setEntries([]);
      return;
    }

    const unsubBoards = subscribeToBoards(currentUser.uid, setBoards);
    const unsubNotes = subscribeToNotes(currentUser.uid, setNotes);
    const unsubEntries = subscribeToUserEntries(currentUser.uid, setEntries);

    return () => {
      unsubBoards();
      unsubNotes();
      unsubEntries();
    };
  }, [currentUser]);

  // Subtle initial loading screen with journal notebook feel
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF9F5] dark:bg-[#151413]">
        <div className="text-center space-y-3">
          <h1 className="font-journal text-3xl font-medium tracking-tight text-[#1F1E1D] dark:text-[#EAE6E1]">
            Gemini Me
          </h1>
          <p className="font-journal text-sm text-[#87827A] dark:text-[#807B73] italic">
            Opening your journal…
          </p>
        </div>
      </div>
    );
  }

  // Not signed in: Landing Page with one-line pitch and Google Sign-In only
  if (!currentUser || !userProfile) {
    return <AuthLanding />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] dark:bg-[#151413] text-[#201F1E] dark:text-[#E8E6E3]">
      {/* Top Bar Navigation */}
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main View Area */}
      <main className={`flex-1 w-full flex flex-col ${currentTab === 'today' ? '' : 'pb-16'}`}>
        {currentTab === 'today' && <TodayView user={userProfile} />}
        {currentTab === 'history' && <HistoryView user={userProfile} />}
        {currentTab === 'boards' && (
          <BoardsView
            userId={userProfile.uid}
            boards={boards}
            notes={notes}
          />
        )}
        {currentTab === 'profile' && (
          <ProfileView
            user={userProfile}
            onProfileUpdate={(updated) =>
              setUserProfile((prev) => (prev ? { ...prev, ...updated } : null))
            }
          />
        )}
      </main>

      {/* Floating "Ask Mini-Me" button bottom right on every screen */}
      <button
        id="ask-mini-me-floating-btn"
        type="button"
        onClick={() => setIsCoachOpen(true)}
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-30 inline-flex items-center gap-2 rounded-full bg-stone-900 dark:bg-stone-100 px-4 py-2.5 text-xs font-semibold text-white dark:text-stone-900 shadow-lg hover:bg-stone-800 dark:hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer border border-stone-700/20 dark:border-stone-300/40"
        aria-label="Ask Mini-Me"
        title="Open Coach Chat"
      >
        <Sparkles className="h-4 w-4 text-amber-400 dark:text-amber-600 shrink-0" />
        <span>Ask Mini-Me</span>
      </button>

      {/* Coach Chat Drawer */}
      <CoachDrawer
        isOpen={isCoachOpen}
        onClose={() => setIsCoachOpen(false)}
        userId={userProfile.uid}
        coachTone={userProfile.coachTone || 'warm'}
        availableBoards={boards}
        allEntries={entries}
        allNotes={notes}
      />
    </div>
  );
}
