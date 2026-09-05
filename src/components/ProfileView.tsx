import React, { useState } from 'react';
import { UserProfile, CoachTone } from '../types/journal';
import { updateCoachTone, logOut } from '../lib/firebase';
import { LogOut, Check } from 'lucide-react';

interface ProfileViewProps {
  user: UserProfile;
  onProfileUpdate: (updated: Partial<UserProfile>) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onProfileUpdate }) => {
  const [tone, setTone] = useState<CoachTone>(user.coachTone || 'warm');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleToneChange = async (newTone: CoachTone) => {
    if (newTone === tone || isSaving) return;

    setTone(newTone);
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updateCoachTone(user.uid, newTone);
      onProfileUpdate({ coachTone: newTone });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2400);
    } catch (err) {
      console.error('Failed to update coach tone:', err);
      // Rollback on failure
      setTone(user.coachTone || 'warm');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await logOut();
    } catch (err) {
      console.error('Sign out failed:', err);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="w-full max-w-[680px] mx-auto px-4 sm:px-6 py-8 space-y-10">
      <div>
        <h2 className="font-journal text-2xl sm:text-3xl font-medium tracking-tight text-[#1A1918] dark:text-[#EFECE6]">
          Profile
        </h2>
        <p className="text-sm text-[#74706B] dark:text-[#9B958E] mt-0.5">
          Your personal journal settings
        </p>
      </div>

      {/* Identity Details */}
      <section className="bg-[#FAF7F2] dark:bg-[#1C1B19] rounded-xl border border-[#EBE6DD] dark:border-[#2C2926] p-5 sm:p-6 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-[#8C867D] dark:text-[#827D75]">
            Display Name
          </label>
          <p className="font-journal text-xl text-[#1E1D1C] dark:text-[#EFECE6] mt-1 font-medium">
            {user.displayName || 'Friend'}
          </p>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-[#8C867D] dark:text-[#827D75]">
            Email
          </label>
          <p className="text-sm text-[#524E48] dark:text-[#BDB7AE] mt-0.5">
            {user.email || 'No email associated'}
          </p>
        </div>

        <div className="pt-2 border-t border-[#EFECE6] dark:border-[#282522] flex items-center justify-between text-xs text-[#8A847B] dark:text-[#7A756D]">
          <span>Account role: {user.role}</span>
          <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
      </section>

      {/* Coach Tone Toggle Section */}
      <section className="bg-[#FAF7F2] dark:bg-[#1C1B19] rounded-xl border border-[#EBE6DD] dark:border-[#2C2926] p-5 sm:p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-journal text-lg font-medium text-[#1E1D1C] dark:text-[#EFECE6]">
              Coach Tone: Mini-Me
            </h3>
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs text-[#2E7D32] dark:text-[#81C784]">
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </span>
            )}
          </div>
          <p className="text-sm text-[#706B64] dark:text-[#9A948B] mt-1">
            How Mini-Me speaks when asking follow-up questions and reflecting on your day.
          </p>
        </div>

        {/* Tone Selector Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Coach Tone">
          {/* Warm Option */}
          <button
            id="tone-warm-btn"
            type="button"
            role="radio"
            aria-checked={tone === 'warm'}
            onClick={() => handleToneChange('warm')}
            disabled={isSaving}
            className={`p-4 rounded-lg text-left border transition cursor-pointer ${
              tone === 'warm'
                ? 'border-[#201F1E] dark:border-[#E8E4DD] bg-[#FFFFFF] dark:bg-[#252320] shadow-xs'
                : 'border-[#E7E2D8] dark:border-[#2D2A26] bg-transparent hover:bg-[#F3EFE7] dark:hover:bg-[#22201D]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-base text-[#1E1D1C] dark:text-[#ECE8E2]">
                Warm
              </span>
              {tone === 'warm' && (
                <span className="w-2 h-2 rounded-full bg-[#201F1E] dark:bg-[#E8E4DD]" />
              )}
            </div>
            <p className="font-journal text-sm text-[#66615A] dark:text-[#A7A197] leading-relaxed">
              Gentle, thoughtful, and reflective. Sounds like an empathetic friend sitting across the table.
            </p>
          </button>

          {/* Blunt Option */}
          <button
            id="tone-blunt-btn"
            type="button"
            role="radio"
            aria-checked={tone === 'blunt'}
            onClick={() => handleToneChange('blunt')}
            disabled={isSaving}
            className={`p-4 rounded-lg text-left border transition cursor-pointer ${
              tone === 'blunt'
                ? 'border-[#201F1E] dark:border-[#E8E4DD] bg-[#FFFFFF] dark:bg-[#252320] shadow-xs'
                : 'border-[#E7E2D8] dark:border-[#2D2A26] bg-transparent hover:bg-[#F3EFE7] dark:hover:bg-[#22201D]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-base text-[#1E1D1C] dark:text-[#ECE8E2]">
                Blunt
              </span>
              {tone === 'blunt' && (
                <span className="w-2 h-2 rounded-full bg-[#201F1E] dark:bg-[#E8E4DD]" />
              )}
            </div>
            <p className="font-journal text-sm text-[#66615A] dark:text-[#A7A197] leading-relaxed">
              Direct, crisp, and plain-spoken. Minimal pleasantries, cutting straight to the essence of your entry.
            </p>
          </button>
        </div>
      </section>

      {/* Sign out */}
      <div className="pt-4">
        <button
          id="sign-out-btn"
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#7D2820] dark:text-[#E57373] hover:bg-[#FBEAE9] dark:hover:bg-[#341818] rounded-lg transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    </div>
  );
};
