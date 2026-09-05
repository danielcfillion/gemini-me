import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, JournalEntry, JournalMessage } from '../types/journal';
import {
  subscribeToEntry,
  saveJournalEntry,
} from '../lib/firebase';
import { getTodayDateKey, formatEntryDateHeader, formatTime } from '../lib/dateUtils';
import { ArrowUp, RefreshCw, AlertCircle } from 'lucide-react';

interface TodayViewProps {
  user: UserProfile;
}

export const TodayView: React.FC<TodayViewProps> = ({ user }) => {
  const todayKey = getTodayDateKey();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Adjust textarea height dynamically to user input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        Math.max(textareaRef.current.scrollHeight, 96),
        280
      )}px`;
    }
  }, [inputText]);

  // Scroll to latest message smoothly when new message arrives
  useEffect(() => {
    if (entry?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entry?.messages?.length, isThinking]);

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
        textareaRef.current.style.height = '96px';
      }

      // 2. Call backend /api/chat with resilient Gemini fallback ladder
      const isFirstOfDay = existingMessages.filter((m) => m.role === 'user').length === 0;

      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: finalMessages }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Summary failed'))))
        .then((summaryData) => {
          if (summaryData.summary) {
            saveJournalEntry(user.uid, todayKey, { summary: summaryData.summary });
          }
        })
        .catch((e) => console.warn('Background summary update skipped:', e));
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
    <div className="w-full max-w-[680px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Date Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-journal text-2xl sm:text-3xl font-medium tracking-tight text-[#1A1918] dark:text-[#EFECE6]">
            {formatEntryDateHeader(todayKey)}
          </h2>
          <p className="text-sm text-[#74706B] dark:text-[#9B958E] mt-0.5">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Input Box: single text area with "What happened today?" */}
      <div className="bg-[#FAF7F2] dark:bg-[#1C1B19] rounded-xl border border-[#EBE6DD] dark:border-[#2C2926] p-4 sm:p-5 shadow-xs transition-shadow focus-within:border-[#D5CDC2] dark:focus-within:border-[#423E3A]">
        <textarea
          id="journal-input-today"
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isThinking}
          placeholder="What happened today?"
          rows={3}
          className="w-full font-journal text-lg sm:text-[19px] leading-relaxed text-[#1C1B19] dark:text-[#EAE6E0] placeholder-[#9C968D] dark:placeholder-[#6E6962] bg-transparent border-0 focus:outline-none resize-none disabled:opacity-60"
        />

        <div className="flex items-center justify-between pt-3 border-t border-[#EFECE6] dark:border-[#262421]">
          <span className="text-xs text-[#8A847C] dark:text-[#807A72]">
            Press <kbd className="font-sans px-1 py-0.5 text-[11px] bg-[#EAE6DF] dark:bg-[#2B2825] rounded text-[#5E5A54] dark:text-[#ABA49A]">⌘</kbd> + <kbd className="font-sans px-1 py-0.5 text-[11px] bg-[#EAE6DF] dark:bg-[#2B2825] rounded text-[#5E5A54] dark:text-[#ABA49A]">Enter</kbd> to send
          </span>

          <button
            id="journal-send-btn"
            type="button"
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isThinking}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#201F1E] dark:bg-[#EAE6E1] text-[#FAF8F5] dark:text-[#1C1B19] text-sm font-medium rounded-lg hover:opacity-90 active:scale-[0.98] transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span>Send</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline error state with retry button */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 p-4 bg-[#FDF2F2] dark:bg-[#341818] border border-[#F8D7DA] dark:border-[#602727] rounded-lg text-sm text-[#922B21] dark:text-[#F1948A]"
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

      {/* Thinking state: subtle "Mini-Me is thinking" */}
      {isThinking && (
        <div className="flex items-center gap-2 text-sm text-[#7D7871] dark:text-[#948F87] italic font-journal pl-1 animate-pulse">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#99938A]" />
          <span>Mini-Me is thinking…</span>
        </div>
      )}

      {/* Conversation stream for today's entry */}
      {messages.length > 0 ? (
        <div className="space-y-6 pt-2">
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
          <div ref={messagesEndRef} />
        </div>
      ) : (
        // Gentle empty state
        <div className="py-12 text-center text-[#8D8880] dark:text-[#746F67] font-journal text-base">
          Today is unwritten. Write whatever comes to mind.
        </div>
      )}
    </div>
  );
};
