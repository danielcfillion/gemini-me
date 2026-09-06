import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, JournalEntry, JournalMessage, Proposal, Board, Note } from '../types/journal';
import {
  subscribeToEntry,
  saveJournalEntry,
  subscribeToPendingProposals,
  subscribeToBoards,
  subscribeToNotes,
  upsertProposalForEntry,
  auth,
  getAuthHeaders,
} from '../lib/firebase';
import { getTodayDateKey, formatEntryDateHeader, formatTime } from '../lib/dateUtils';
import { ArrowUp, RefreshCw, AlertCircle } from 'lucide-react';
import { ProposalPanel } from './ProposalPanel';

interface TodayViewProps {
  user: UserProfile;
}

export const TodayView: React.FC<TodayViewProps> = ({ user }) => {
  const todayKey = getTodayDateKey();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [pendingProposals, setPendingProposals] = useState<Proposal[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [existingNotes, setExistingNotes] = useState<Note[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastExtractionMessagesRef = useRef<JournalMessage[]>([]);

  // Subscribe to today's entry document in real-time
  useEffect(() => {
    const unsubscribe = subscribeToEntry(
      user.uid,
      todayKey,
      (liveEntry) => {
        setEntry(liveEntry);
      },
      (err) => {
        console.error('Failed to load today entry:', err);
        setErrorMessage('Unable to sync your journal with cloud storage.');
      }
    );

    return () => unsubscribe();
  }, [user.uid, todayKey]);

  // Subscribe to pending proposals for Human-in-the-Loop review
  useEffect(() => {
    const unsubscribe = subscribeToPendingProposals(
      user.uid,
      (proposals) => {
        setPendingProposals(proposals);
      },
      (err) => console.warn('Proposals subscription error:', err)
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Subscribe to existing notes for deduplication
  useEffect(() => {
    const unsubscribe = subscribeToNotes(
      user.uid,
      (notes) => {
        setExistingNotes(notes);
      },
      (err) => console.warn('Notes subscription error:', err)
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Subscribe to user boards
  useEffect(() => {
    const unsubscribe = subscribeToBoards(
      user.uid,
      (liveBoards) => {
        setBoards(liveBoards);
      },
      (err) => console.warn('Boards subscription error:', err)
    );

    return () => unsubscribe();
  }, [user.uid]);

  const bottomBarRef = useRef<HTMLDivElement>(null);
  const [bottomBarHeight, setBottomBarHeight] = useState(120);
  const hasInitiallyScrolledRef = useRef(false);

  // Measure bottom pinned area height dynamically so conversation bottom padding matches
  useEffect(() => {
    const el = bottomBarRef.current;
    if (!el) return;

    const updateHeight = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        setBottomBarHeight(Math.ceil(rect.height));
      }
    };

    updateHeight();
    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Adjust textarea height dynamically to user input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        Math.max(textareaRef.current.scrollHeight, 56),
        180
      )}px`;
    }
  }, [inputText]);

  // Requirement 1: On load and after each new message, scroll to the bottom.
  useEffect(() => {
    if (entry?.messages) {
      const timer = setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({
            behavior: hasInitiallyScrolledRef.current ? 'smooth' : 'auto',
            block: 'end',
          });
          hasInitiallyScrolledRef.current = true;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [entry?.messages?.length, isThinking]);

  // Trigger extraction for new user messages since last extraction
  const triggerExtraction = async (allMessages: JournalMessage[]) => {
    if (!allMessages.length) return;
    lastExtractionMessagesRef.current = allMessages;

    // Requirement 1: Extract only from user messages added since the last extraction for this entry.
    // Store lastExtractedMessageIndex on the entry document.
    const lastExtractedIndex =
      typeof entry?.lastExtractedMessageIndex === 'number'
        ? entry.lastExtractedMessageIndex
        : -1;

    const messagesSinceLast = allMessages.slice(lastExtractedIndex + 1);
    const userMessagesToExtract = messagesSinceLast.filter((m) => m.role === 'user');
    const targetExtractionIndex = allMessages.length - 1;

    if (userMessagesToExtract.length === 0) {
      console.log('[Gemini Me TodayView] No new user messages added since last extraction. Updating index.');
      if (lastExtractedIndex !== targetExtractionIndex) {
        await saveJournalEntry(user.uid, todayKey, {
          lastExtractedMessageIndex: targetExtractionIndex,
        });
      }
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const currentBoards = boards.map((b) => b.name);

      // Requirement 2: Pass the entry's existing notes (text + sourceQuote) into the extraction prompt
      const todayCommitted = existingNotes.filter((n) => (n.sourceEntryId || '') === todayKey);
      const todayPending = pendingProposals.filter((p) => (p.entryDate || todayKey) === todayKey);
      const pendingNotesForToday = todayPending.flatMap((p) => p.proposedNotes || []);

      const combinedExistingNotes = [
        ...todayCommitted.map((n) => ({
          text: n.text,
          sourceQuote: n.sourceQuote || '',
          sourceEntryId: todayKey,
        })),
        ...pendingNotesForToday.map((pn) => ({
          text: pn.text,
          sourceQuote: pn.sourceQuote || '',
          sourceEntryId: todayKey,
        })),
      ];

      console.log(
        `[Gemini Me TodayView] Calling POST /api/extract with ${userMessagesToExtract.length} new user message(s), ${combinedExistingNotes.length} existing note(s)...`
      );

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: userMessagesToExtract,
          boards: currentBoards.length > 0 ? currentBoards : ['Work', 'Family', 'Friends', 'Health', 'Money', 'Leisure', 'Goals'],
          entryDate: todayKey,
          existingNotes: combinedExistingNotes,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Extraction server error (${res.status})`);
      }

      const extractData = await res.json();
      console.log('[Gemini Me TodayView] Extraction received:', extractData);

      // Requirement 3 & 4:
      // One pending proposal per entry. If one exists for today, merge new notes into it. Never two panels for the same day.
      // Short conversational replies with no new task, plan, win, worry, habit, or fact return an empty notes array and create nothing.
      if (extractData && Array.isArray(extractData.notes) && extractData.notes.length > 0) {
        await upsertProposalForEntry(user.uid, todayKey, {
          mood: extractData.mood || { score: 3, label: 'Reflective' },
          suggestedNewBoard: extractData.suggestedNewBoard || null,
          newNotes: extractData.notes,
        });
        console.log('[Gemini Me TodayView] Proposal merged or created successfully');
      } else {
        console.log('[Gemini Me TodayView] No new notes to propose. Creating nothing.');
      }

      // Requirement 1: Store lastExtractedMessageIndex on the entry document
      await saveJournalEntry(user.uid, todayKey, {
        mood: extractData.mood,
        lastExtractedMessageIndex: targetExtractionIndex,
      });
    } catch (err: any) {
      console.error('[Gemini Me TodayView] Extraction / Proposal failure:', err);
      // Surface inline error with retry button - never fail silently per user directive
      setExtractionError("Mini-Me couldn't sort this entry.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const messageText = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!messageText || isThinking) return;

    setErrorMessage(null);
    setLastFailedText(null);
    setIsThinking(true);

    const userMessage: JournalMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: messageText,
      ts: new Date().toISOString(),
    };

    const existingMessages = entry?.messages || [];
    const updatedMessagesWithUser = [...existingMessages, userMessage];

    try {
      // 1. First persist user's writing to Firestore immediately so user input is never lost
      await saveJournalEntry(user.uid, todayKey, {
        date: todayKey,
        messages: updatedMessagesWithUser,
        summary: entry?.summary || '',
        createdAt: entry?.createdAt || new Date().toISOString(),
      });

      // Clear input buffer ONLY after successful save to Firestore
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '56px';
      }

      // 2. Call backend /api/chat with resilient Gemini fallback ladder
      const isFirstOfDay = existingMessages.filter((m) => m.role === 'user').length === 0;
      const authHeaders = await getAuthHeaders();

      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: updatedMessagesWithUser,
          coachTone: user.coachTone,
          isFirstOfDay,
        }),
      });

      if (!chatResponse.ok) {
        const errJson = await chatResponse.json().catch(() => ({}));
        throw new Error(errJson.error || 'Mini-Me could not reply right now.');
      }

      const chatData = await chatResponse.json();
      const modelReply = String(chatData.reply || '').trim();

      if (!modelReply) {
        throw new Error('Received empty response from coach.');
      }

      const modelMessage: JournalMessage = {
        id: `msg-${Date.now()}-model`,
        role: 'model',
        text: modelReply,
        ts: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessagesWithUser, modelMessage];

      // 3. Persist model reply
      await saveJournalEntry(user.uid, todayKey, {
        messages: finalMessages,
      });

      // 4. Update distilled daily summary in background for History view
      fetch('/api/summarize', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ messages: finalMessages }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Summary failed'))))
        .then((summaryData) => {
          if (summaryData.summary) {
            saveJournalEntry(user.uid, todayKey, { summary: summaryData.summary });
          }
        })
        .catch((e) => console.warn('Background summary update skipped:', e));

      // 5. Unconditionally trigger structured extraction after every model reply
      triggerExtraction(finalMessages);
    } catch (err: any) {
      console.error('Error during send or generation:', err);
      setErrorMessage(err?.message || 'Something went wrong. Your entry can be retried.');
      setLastFailedText(messageText);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = entry?.messages || [];

  return (
    <div className="relative flex flex-col flex-1 w-full min-h-0">
      {/* Scrollable Conversation Stream Area */}
      <div
        className="w-full max-w-[680px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 flex-1 space-y-6"
        style={{ paddingBottom: `${bottomBarHeight + 24}px` }}
      >
        {/* Date Header & Mood badge driven by score */}
        <div className="flex items-baseline justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-journal text-2xl sm:text-3xl font-medium tracking-tight text-[#1A1918] dark:text-[#EFECE6]">
                {formatEntryDateHeader(todayKey)}
              </h2>
              {entry?.mood && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 dark:bg-stone-800/80 px-2.5 py-0.5 text-xs font-medium text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700/50"
                  title={`Mood Score: ${entry.mood.score}/5`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      entry.mood.score >= 4
                        ? 'bg-emerald-500'
                        : entry.mood.score === 3
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />
                  <span>{entry.mood.label}</span>
                </span>
              )}
            </div>
            <p className="text-sm text-[#74706B] dark:text-[#9B958E] mt-0.5">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* 4. The daily brief (coming later) will sit at the top of the conversation, so leave a slot there. */}
        <div
          id="daily-brief-slot"
          data-slot="daily-brief"
          className="w-full empty:hidden"
        >
          {/* Slot reserved for Daily Brief */}
        </div>

        {/* Conversation stream for today's entry: chronological, oldest at top, newest at bottom */}
        {messages.length > 0 ? (
          <div className="space-y-6 pt-1">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={
                    isUser
                      ? 'py-2'
                      : 'pl-4 sm:pl-6 py-2 border-l-2 border-[#E7E2D9] dark:border-[#2D2A26]'
                  }
                >
                  {isUser ? (
                    // User's writing: bold, humanist serif, focal point
                    <div className="space-y-1">
                      <p className="font-journal text-[18px] sm:text-[19px] leading-relaxed text-[#1F1E1D] dark:text-[#ECE9E4] whitespace-pre-wrap">
                        {msg.text}
                      </p>
                      <p className="text-[12px] text-[#918B82] dark:text-[#7B756D]">
                        {formatTime(msg.ts)}
                      </p>
                    </div>
                  ) : (
                    // Gemini's response: visually lighter (smaller, muted colour, no bubble)
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-medium text-[#767169] dark:text-[#9A948C]">
                        <span>Mini-Me</span>
                        <span className="text-[11px] font-normal text-[#A39D94] dark:text-[#6C665F]">
                          {formatTime(msg.ts)}
                        </span>
                      </div>
                      <p className="font-journal text-[16px] sm:text-[17px] leading-relaxed text-[#514D47] dark:text-[#B5B0A8] whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Thinking state: subtle "Mini-Me is thinking…" */}
            {isThinking && (
              <div className="flex items-center gap-2 text-sm text-[#7D7871] dark:text-[#948F87] italic font-journal pl-1 animate-pulse">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#99938A]" />
                <span>Mini-Me is thinking…</span>
              </div>
            )}

            {/* Extraction in-progress indicator */}
            {isExtracting && (
              <div
                id="extraction-loading-indicator"
                className="flex items-center gap-2 text-xs text-[#7D7871] dark:text-[#948F87] italic font-journal pl-1 pt-2"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#99938A] animate-pulse" />
                <span>Mini-Me is reflecting on notes & patterns…</span>
              </div>
            )}

            {/* Inline extraction error under the conversation */}
            {extractionError && (
              <div
                id="extraction-error-banner"
                className="flex items-center justify-between gap-3 p-3 bg-stone-100 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 rounded-lg text-xs text-[#514D47] dark:text-[#B5B0A8] mt-3"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Mini-Me couldn't sort this entry.</span>
                </div>
                <button
                  id="retry-extraction-btn"
                  type="button"
                  onClick={() =>
                    triggerExtraction(
                      lastExtractionMessagesRef.current.length > 0
                        ? lastExtractionMessagesRef.current
                        : messages
                    )
                  }
                  disabled={isExtracting}
                  className="inline-flex items-center gap-1 font-medium underline hover:no-underline cursor-pointer ml-auto disabled:opacity-50 text-[#1A1918] dark:text-[#EFECE6]"
                >
                  <RefreshCw className={`w-3 h-3 ${isExtracting ? 'animate-spin' : ''}`} />
                  <span>{isExtracting ? 'Retrying...' : 'Retry'}</span>
                </button>
              </div>
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>
        ) : (
          // Gentle empty state
          <div className="py-16 text-center text-[#8D8880] dark:text-[#746F67] font-journal text-base">
            Today is unwritten. Write whatever comes to mind.
            <div ref={messagesEndRef} className="h-1" />
          </div>
        )}
      </div>

      {/* 2 & 3. Sticky Bottom Area: Proposal Panel (directly above composer) + Composer */}
      <div
        ref={bottomBarRef}
        className="sticky bottom-0 z-20 w-full bg-[#FBF9F5] dark:bg-[#151413] border-t border-[#EBE7DF] dark:border-[#2A2724] pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xs"
      >
        <div className="w-full max-w-[680px] mx-auto px-4 sm:px-6">
          {/* Inline error state with retry button */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-2 flex items-start justify-between gap-3 p-3 bg-[#FDF2F2] dark:bg-[#341818] border border-[#F8D7DA] dark:border-[#602727] rounded-lg text-xs text-[#922B21] dark:text-[#F1948A]"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {lastFailedText && (
                <button
                  id="retry-failed-send-btn"
                  type="button"
                  onClick={() => handleSend(lastFailedText)}
                  className="inline-flex items-center gap-1 font-medium text-xs underline hover:no-underline cursor-pointer ml-auto"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}

          {/* 3. The "Mini-Me noticed" proposal panel sits directly above the composer, also sticky */}
          {(() => {
            const uniqueByDate = new Map<string, Proposal>();
            for (const p of pendingProposals) {
              const dateKey = p.entryDate || todayKey;
              if (!uniqueByDate.has(dateKey)) {
                uniqueByDate.set(dateKey, p);
              }
            }
            const visibleProposals = Array.from(uniqueByDate.values());
            if (visibleProposals.length === 0) return null;

            return (
              <div className="w-full">
                {visibleProposals.map((proposal) => (
                  <ProposalPanel
                    key={proposal.id}
                    userId={user.uid}
                    proposal={proposal}
                    availableBoards={boards}
                  />
                ))}
              </div>
            );
          })()}

          {/* 2. The composer (textarea + Send) */}
          <div className="bg-[#FAF7F2] dark:bg-[#1C1B19] rounded-xl border border-[#EBE6DD] dark:border-[#2C2926] p-3 sm:p-4 shadow-xs transition-shadow focus-within:border-[#D5CDC2] dark:focus-within:border-[#423E3A]">
            <textarea
              id="journal-input-today"
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 100);
              }}
              disabled={isThinking}
              placeholder="What happened today?"
              rows={2}
              className="w-full font-journal text-base sm:text-lg leading-relaxed text-[#1C1B19] dark:text-[#EAE6E0] placeholder-[#9C968D] dark:placeholder-[#6E6962] bg-transparent border-0 focus:outline-none resize-none disabled:opacity-60"
            />

            <div className="flex items-center justify-between pt-2.5 border-t border-[#EFECE6] dark:border-[#262421]">
              <span className="text-xs text-[#8A847C] dark:text-[#807A72]">
                Press <kbd className="font-sans px-1 py-0.5 text-[11px] bg-[#EAE6DF] dark:bg-[#2B2825] rounded text-[#5E5A54] dark:text-[#ABA49A]">⌘</kbd> + <kbd className="font-sans px-1 py-0.5 text-[11px] bg-[#EAE6DF] dark:bg-[#2B2825] rounded text-[#5E5A54] dark:text-[#ABA49A]">Enter</kbd> to send
              </span>

              <button
                id="journal-send-btn"
                type="button"
                onClick={() => handleSend()}
                disabled={!inputText.trim() || isThinking}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#201F1E] dark:bg-[#EAE6E1] text-[#FAF8F5] dark:text-[#1C1B19] text-xs sm:text-sm font-medium rounded-lg hover:opacity-90 active:scale-[0.98] transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span>Send</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
