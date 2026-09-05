import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, getOrCreateUserProfile } from './lib/firebase';
import { UserProfile, NavTab } from './types/journal';
import { AuthLanding } from './components/AuthLanding';
import { Navigation } from './components/Navigation';
import { TodayView } from './components/TodayView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState<NavTab>('today');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const profile = await getOrCreateUserProfile(user);
          setUserProfile(profile);
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
      <main className="flex-1 w-full pb-16">
        {currentTab === 'today' && <TodayView user={userProfile} />}
        {currentTab === 'history' && <HistoryView user={userProfile} />}
        {currentTab === 'profile' && (
          <ProfileView
            user={userProfile}
            onProfileUpdate={(updated) =>
              setUserProfile((prev) => (prev ? { ...prev, ...updated } : null))
            }
          />
        )}
      </main>
    </div>
  );
}
