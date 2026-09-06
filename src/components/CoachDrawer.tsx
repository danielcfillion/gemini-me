import React, { useState, useEffect, useRef } from 'react';
import {
  CoachSession,
  CoachMessage,
  Board,
  JournalEntry,
  Note,
  Proposal,
  CoachTone,
} from '../types/journal';
import {
  subscribeToCoachSessions,
  subscribeToCoachSession,
  saveCoachSession,
  subscribeToPendingProposals,
  getAuthHeaders,
} from '../lib/firebase';
import { ProposalPanel } from './ProposalPanel';
import {
  X,
  Send,
  Sparkles,
  Plus,
  Loader2,
  Compass,
  Search,
  ListFilter,
  CheckCircle2,
} from 'lucide-react';

interface CoachDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  coachTone: CoachTone;
  availableBoards: Board[];
  allEntries: JournalEntry[];
  allNotes: Note[];
}

export const CoachDrawer: React.FC<CoachDrawerProps> = ({
  isOpen,
  onClose,
  userId,
  coachTone,
  availableBoards,
  allEntries,
  allNotes,
}) => {
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<CoachSession | null>(null);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [coachProposals, setCoachProposals] = useState<Proposal[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to all coach sessions for this user
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToCoachSessions(userId, (loadedSessions) => {
      setSessions(loadedSessions);
      if (loadedSessions.length > 0 && !currentSessionId) {
        setCurrentSessionId(loadedSessions[0].id);
      }
    });
    return () => unsubscribe();
  }, [userId, currentSessionId]);

  // Subscribe to the active coach session
  useEffect(() => {
    if (!userId || !currentSessionId) {
      setCurrentSession(null);
      return;
    }
    const unsubscribe = subscribeToCoachSession(userId, currentSessionId, (session) => {
      setCurrentSession(session);
    });
    return () => unsubscribe();
  }, [userId, currentSessionId]);

  // Subscribe to pending proposals to render in-drawer review cards
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToPendingProposals(userId, (proposals) => {
      const coachOnly = proposals.filter((p) => p.origin === 'coach');
      setCoachProposals(coachOnly);
    });
    return () => unsubscribe();
  }, [userId]);

  // Scroll to bottom when messages update or drawer opens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Auto-focus input when opened
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, currentSession?.messages, isSending]);

  // Create a new session
  const handleStartNewSession = async () => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: CoachSession = {
      id: newSessionId,
      title: 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveCoachSession(userId, newSessionId, newSession);
    setCurrentSessionId(newSessionId);
    setInputText('');
    setErrorMessage(null);
  };

  // Submit message to coach
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || isSending || !userId) return;

    setIsSending(true);
    setErrorMessage(null);
    setInputText('');

    // Ensure we have a valid session ID
    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      targetSessionId = `session-${Date.now()}`;
      setCurrentSessionId(targetSessionId);
    }

    const userMessage: CoachMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: messageContent,
      ts: new Date().toISOString(),
    };

    const existingMessages = currentSession?.messages || [];
    const updatedMessages = [...existingMessages, userMessage];

    // Optimistically update the session
    const sessionTitle =
      currentSession?.title && currentSession.title !== 'New Conversation'
        ? currentSession.title
        : messageContent.slice(0, 30);

    await saveCoachSession(userId, targetSessionId, {
      id: targetSessionId,
      title: sessionTitle,
      messages: updatedMessages,
    });

    try {
      const authHeaders = await getAuthHeaders();

      // Send to server-side /api/coach
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          uid: userId,
          sessionId: targetSessionId,
          coachTone,
          messages: existingMessages,
          newMessage: messageContent,
          clientContext: {
            entries: allEntries.slice(0, 15),
            notes: allNotes,
            boards: availableBoards,
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();

      const modelMessage: CoachMessage = {
        id: `msg-model-${Date.now()}`,
        role: 'model',
        text: data.reply || "I've reviewed your request.",
        proposalId: data.proposalId || null,
        toolsUsed: data.toolsUsed || [],
        ts: new Date().toISOString(),
      };

      // Save updated messages with coach reply
      await saveCoachSession(userId, targetSessionId, {
        id: targetSessionId,
        title: sessionTitle,
        messages: [...updatedMessages, modelMessage],
      });
    } catch (err: any) {
      console.error('Error contacting coach:', err);
      setErrorMessage(err?.message || 'Failed to send message to Mini-Me. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatToolBadge = (toolName: string) => {
    switch (toolName) {
      case 'search_entries':
        return { label: 'Searched journal entries', icon: Search };
      case 'list_notes':
        return { label: 'Listed notes', icon: ListFilter };
      case 'get_board_state':
        return { label: 'Inspected board state', icon: Compass };
      case 'propose_note_changes':
        return { label: 'Created proposal', icon: CheckCircle2 };
      default:
        return { label: toolName, icon: Sparkles };
    }
  };

  if (!isOpen) return null;

  const messages = currentSession?.messages || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <aside
        className="relative flex h-full w-full max-w-md flex-col bg-stone-50 dark:bg-stone-900 shadow-2xl border-l border-stone-200 dark:border-stone-800 z-10 animate-in slide-in-from-right duration-200"
        aria-label="Coach chat with Mini-Me"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 px-4 py-3 bg-white dark:bg-stone-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-sm shadow-xs">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 leading-none">
                  Mini-Me
                </h2>
                <span className="inline-flex items-center rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                  {coachTone === 'blunt' ? 'Direct style' : 'Warm style'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                Your personal journal coach
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleStartNewSession}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
              title="Start a new conversation"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
              aria-label="Close coach drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Sessions switcher (if user has multiple past sessions) */}
        {sessions.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-b border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-stone-800/40 text-xs shrink-0 no-scrollbar">
            <span className="text-[10px] uppercase font-semibold text-stone-400 shrink-0">Chats:</span>
            {sessions.slice(0, 6).map((s) => (
              <button
                key={s.id}
                onClick={() => setCurrentSessionId(s.id)}
                className={`truncate max-w-[130px] rounded-full px-2.5 py-0.5 text-[11px] transition-colors cursor-pointer shrink-0 ${
                  currentSessionId === s.id
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-medium'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700'
                }`}
              >
                {s.title || 'Untitled chat'}
              </button>
            ))}
          </div>
        )}

        {/* Active Coach Proposals Banner (Mini-Me noticed style in-drawer) */}
        {coachProposals.length > 0 && (
          <div className="p-3 border-b border-stone-200 dark:border-stone-800 bg-amber-50/50 dark:bg-amber-950/20 shrink-0">
            <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Pending Coach Proposals</span>
            </div>
            {coachProposals.map((prop) => (
              <div key={prop.id} className="mt-2">
                <ProposalPanel
                  userId={userId}
                  proposal={prop}
                  availableBoards={availableBoards}
                  onHandled={() => {
                    // Refreshed via real-time subscription
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 text-stone-500 dark:text-stone-400">
              <div className="h-10 w-10 rounded-full bg-stone-200/70 dark:bg-stone-800 flex items-center justify-center mb-3 text-stone-600 dark:text-stone-300">
                <Compass className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                Ask Mini-Me anything
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-xs">
                I can search your past reflections, check on tasks and boards, and propose updates based on your writing.
              </p>

              {/* Suggested Prompts */}
              <div className="mt-6 flex flex-col gap-2 w-full max-w-xs text-left">
                <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                  Suggestions
                </span>
                {[
                  'What did I work on this week?',
                  'Show open tasks on my Work board',
                  'Summarize my recent wins and worries',
                  'Help me turn recent ideas into action items',
                ].map((promptText) => (
                  <button
                    key={promptText}
                    type="button"
                    onClick={() => handleSendMessage(promptText)}
                    className="text-xs text-left rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800/80 p-2.5 text-stone-700 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    "{promptText}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Message bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 rounded-br-xs'
                      : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700/80 shadow-2xs rounded-bl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>

                {/* Tool badge if tools were used */}
                {!isUser && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-400 dark:text-stone-500">
                    {msg.toolsUsed.map((tool, idx) => {
                      const badge = formatToolBadge(tool);
                      const Icon = badge.icon;
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded bg-stone-100 dark:bg-stone-800/60 px-1.5 py-0.5 border border-stone-200/60 dark:border-stone-700/60"
                        >
                          <Icon className="h-2.5 w-2.5" />
                          <span>{badge.label}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-600 dark:text-stone-300" />
              <span>Mini-Me is reflecting...</span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2.5 text-xs text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer (Sticky bottom) */}
        <div className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Mini-Me a question or request a note..."
                rows={1}
                className="w-full resize-none rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3.5 py-2.5 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:border-stone-500 dark:focus:border-stone-400 focus:bg-white dark:focus:bg-stone-800 focus:outline-hidden max-h-32 transition-colors"
                style={{ height: 'auto', minHeight: '38px' }}
              />
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 transition-opacity hover:opacity-90 disabled:opacity-30 cursor-pointer shrink-0 shadow-xs"
              aria-label="Send message"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
};
