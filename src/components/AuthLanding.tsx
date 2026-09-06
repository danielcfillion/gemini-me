import React, { useState } from 'react';
import { signInWithGoogle } from '../lib/firebase';
import { AlertCircle, ExternalLink, Copy, Check, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

export const AuthLanding: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefererBlocked, setIsRefererBlocked] = useState(false);
  const [isActionInvalid, setIsActionInvalid] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleCopyDomain = async () => {
    try {
      await navigator.clipboard.writeText(currentDomain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setIsRefererBlocked(false);
      setIsActionInvalid(false);
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code;
      const rawMessage = err?.message || String(err);

      // User closed the popup before finishing sign-in - not a system error, just reset cleanly
      if (
        code === 'auth/popup-closed-by-user' ||
        rawMessage.includes('popup-closed-by-user')
      ) {
        setErrorMsg(null);
        return;
      }

      console.error('Sign-in error:', err);
      if (
        rawMessage.includes('requests-from-referer') ||
        rawMessage.includes('are-blocked') ||
        code === 'auth/requests-from-referer-are-blocked'
      ) {
        setIsRefererBlocked(true);
        setErrorMsg(
          `Your Firebase Web API key has HTTP Referrer restrictions in Google Cloud Console that do not yet permit requests from this domain (${currentOrigin}).`
        );
      } else if (
        code === 'auth/invalid-action-code' ||
        code === 'auth/unauthorized-domain' ||
        rawMessage.includes('invalid action') ||
        rawMessage.includes('unauthorized domain')
      ) {
        setIsActionInvalid(true);
        setShowTroubleshoot(true);
        setErrorMsg(
          'Firebase returned "The requested action is invalid". This happens when this domain is not listed in Firebase Authorized Domains or Google sign-in is disabled.'
        );
      } else if (code === 'auth/cancelled-popup-request') {
        // Another popup was opened or request cancelled, ignore cleanly
        setErrorMsg(null);
      } else {
        setErrorMsg(
          err?.message || 'Unable to sign in with Google right now. Please check the setup steps below.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-[560px] text-center space-y-8">
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
            className="p-4 text-sm text-[#922B21] dark:text-[#F1948A] bg-[#FDEDEC] dark:bg-[#341816] rounded-lg border border-[#FADBD8] dark:border-[#5B2C27] text-left space-y-3"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <p className="font-medium">{errorMsg}</p>
                {isRefererBlocked && (
                  <div className="mt-2 text-xs text-stone-700 dark:text-stone-300 space-y-2">
                    <p className="font-semibold text-stone-800 dark:text-stone-200">
                      How to resolve in Google Cloud Console:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 pl-1 text-[13px]">
                      <li>
                        Go to{' '}
                        <strong>
                          APIs & Services → Credentials → API Keys
                        </strong>{' '}
                        in Google Cloud Console.
                      </li>
                      <li>
                        Select your Firebase Web API Key (or Browser Key).
                      </li>
                      <li>
                        Under <strong>Application restrictions</strong>, either select{' '}
                        <strong>None</strong> or add{' '}
                        <code className="bg-stone-200 dark:bg-stone-800 px-1 py-0.5 rounded font-mono text-[11px]">
                          {currentOrigin}/*
                        </code>{' '}
                        to Website restrictions.
                      </li>
                      <li>Save and wait 1–2 minutes to propagate.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Google Sign-In Button & Open in New Tab Button */}
        <div className="pt-2 flex flex-col items-center gap-3">
          <button
            id="google-signin-btn"
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-7 py-3.5 bg-[#1F1E1D] dark:bg-[#FAF8F5] text-[#FAF8F5] dark:text-[#1F1E1D] font-medium text-base rounded-lg hover:opacity-90 active:scale-[0.99] transition cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
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

          {/* Open in New Window Link if inside iframe */}
          {isInsideIframe && (
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#7A746B] dark:text-[#A8A399] hover:text-[#1C1B1A] dark:hover:text-[#FAF8F5] underline underline-offset-4 transition"
            >
              <span>Open app in a separate browser tab</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Troubleshooting / Setup Helper Collapsible */}
        <div className="pt-4 border-t border-[#EAE6DF] dark:border-[#2C2A28] text-left">
          <button
            type="button"
            onClick={() => setShowTroubleshoot(!showTroubleshoot)}
            className="w-full flex items-center justify-between py-2 text-xs font-medium text-[#7A746B] dark:text-[#A8A399] hover:text-[#1C1B1A] dark:hover:text-[#FAF8F5] transition cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Getting &quot;The requested action is invalid&quot;?</span>
            </span>
            {showTroubleshoot ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTroubleshoot && (
            <div className="mt-3 p-4 bg-[#F5F2EC] dark:bg-[#242220] rounded-lg border border-[#E3DED5] dark:border-[#383532] text-xs text-[#4A4641] dark:text-[#C5BFB5] space-y-3">
              <p className="font-semibold text-[#1C1B1A] dark:text-[#FAF8F5]">
                Firebase requires adding this domain to your Authorized Domains list:
              </p>

              {/* Domain Copy Box */}
              <div className="flex items-center justify-between gap-2 p-2 bg-[#FAF8F5] dark:bg-[#1A1918] rounded border border-[#D9D3C7] dark:border-[#3A3835] font-mono text-[11px]">
                <span className="truncate select-all">{currentDomain}</span>
                <button
                  type="button"
                  onClick={handleCopyDomain}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded hover:bg-stone-300 dark:hover:bg-stone-700 transition cursor-pointer font-sans text-xs"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="space-y-2 pt-1 text-[11px] leading-relaxed">
                <p className="font-medium text-[#2C2A28] dark:text-[#EAE6DF]">
                  Two quick steps in the Firebase Console:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 pl-0.5">
                  <li>
                    Open{' '}
                    <a
                      href="https://console.firebase.google.com/project/my-project-cohort-lab-3/authentication/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold text-blue-600 dark:text-blue-400 inline-flex items-center gap-0.5"
                    >
                      Firebase Console → Authentication → Settings
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </li>
                  <li>
                    Under <strong>Authorized domains</strong>, click <strong>Add domain</strong> and paste the copied domain above.
                  </li>
                  <li>
                    Under <strong>Authentication → Sign-in method</strong>, verify that <strong>Google</strong> is toggled to <strong>Enabled</strong> with a support email selected.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
