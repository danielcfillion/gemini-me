import React, { useState } from 'react';
import { signInWithGoogle } from '../lib/firebase';
import { AlertCircle } from 'lucide-react';

export const AuthLanding: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setErrorMsg(
        err?.message || 'Unable to sign in with Google right now. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-[540px] text-center space-y-10">
        {/* Notebook Title */}
        <div className="space-y-4">
          <h1 className="font-journal text-4xl sm:text-5xl font-medium tracking-tight text-[#1C1B1A] dark:text-[#EFECE6]">
            Gemini Me
          </h1>
          <p className="font-journal text-lg sm:text-xl text-[#5C5750] dark:text-[#B0ABA1] leading-relaxed max-w-[420px] mx-auto">
            Just tell it about your day. It&apos;ll figure out the rest.
          </p>
        </div>

        {/* Error message banner if sign-in fails */}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-3 p-4 text-sm text-[#922B21] dark:text-[#F1948A] bg-[#FDEDEC] dark:bg-[#341816] rounded-md border border-[#FADBD8] dark:border-[#5B2C27] text-left"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        <div className="pt-2">
          <button
            id="google-signin-btn"
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-[#1F1E1D] dark:bg-[#FAF8F5] text-[#FAF8F5] dark:text-[#1F1E1D] font-medium text-base rounded-lg hover:opacity-90 active:scale-[0.99] transition cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg
              className="w-4 h-4 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>{loading ? 'Opening sign in...' : 'Sign in with Google'}</span>
          </button>
        </div>
      </div>
    </main>
  );
};
