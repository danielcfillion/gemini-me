import React, { useState, useEffect } from 'react';
import { UserProfile, JournalEntry } from '../types/journal';
import { subscribeToUserEntries } from '../lib/firebase';
import { formatEntryDateHeader, formatTime } from '../lib/dateUtils';
import { ArrowLeft, BookOpen } from 'lucide-react';

interface HistoryViewProps {
  user: UserProfile;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ user }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (fetched) => {
        setEntries(fetched);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load history:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Helper to get first line of user's text
  const getFirstLine = (entry: JournalEntry): string => {
    const firstUserMsg = entry.messages?.find((m) => m.role === 'user');
    if (!firstUserMsg || !firstUserMsg.text) return 'No notes recorded.';
    const firstLine = firstUserMsg.text.split('\n')[0].trim();
    return firstLine.length > 90 ? `${firstLine.substring(0, 90)}…` : firstLine;
  };

  // If a past entry is selected, render full read-only conversation
  if (selectedEntry) {
    return (
      <div className="w-full max-w-[680px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <button
            id="back-to-history-btn"
            type="button"
            onClick={() => setSelectedEntry(null)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#68635D] dark:text-[#A49E96] hover:text-[#1E1D1C] dark:hover:text-[#F3EFE9] transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All entries</span>
          </button>
        </div>

        {/* Selected Date Header */}
        <div className="border-b border-[#EAE5DC] dark:border-[#2C2926] pb-4">
          <h2 className="font-journal text-3xl font-medium tracking-tight text-[#1A1918] dark:text-[#EFECE6]">
            {formatEntryDateHeader(selectedEntry.date)}
          </h2>
          <p className="text-xs text-[#7A756E] dark:text-[#918B82] mt-1">
            Read-only archive · {selectedEntry.date}
          </p>
        </div>

        {/* Gemini's summary pill if available */}
        {selectedEntry.summary && (
          <div className="p-4 bg-[#F5F2EC] dark:bg-[#1D1B19] rounded-lg border border-[#E8E3D8] dark:border-[#2E2B27]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#79736A] dark:text-[#999287] mb-1">
              Summary
            </p>
            <p className="font-journal text-base italic text-[#4A4641] dark:text-[#BDB7AE] leading-relaxed">
              &ldquo;{selectedEntry.summary}&rdquo;
            </p>
          </div>
        )}

        {/* Full conversation */}
        <div className="space-y-6">
          {selectedEntry.messages?.map((msg) => {
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
                  <div className="space-y-1">
                    <p className="font-journal text-[18px] leading-relaxed text-[#1F1E1D] dark:text-[#ECE9E4] whitespace-pre-wrap">
                      {msg.text}
                    </p>
                    <p className="text-[12px] text-[#918B82] dark:text-[#7B756D]">
                      {formatTime(msg.ts)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#767169] dark:text-[#9A948C]">
                      <span>Mini-Me</span>
                      <span className="text-[11px] font-normal text-[#A39D94] dark:text-[#6C665F]">
                        {formatTime(msg.ts)}
                      </span>
                    </div>
                    <p className="font-journal text-[16px] leading-relaxed text-[#514D47] dark:text-[#B5B0A8] whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[680px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h2 className="font-journal text-2xl sm:text-3xl font-medium tracking-tight text-[#1A1918] dark:text-[#EFECE6]">
          History
        </h2>
        <p className="text-sm text-[#74706B] dark:text-[#9B958E] mt-0.5">
          Your thoughts and reflections over time
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[#8D8880] dark:text-[#746F67] font-journal animate-pulse">
          Opening pages…
        </div>
      ) : entries.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <BookOpen className="w-8 h-8 mx-auto text-[#B0AAA0] dark:text-[#55504A]" />
          <p className="font-journal text-lg text-[#5E5952] dark:text-[#ADA69C]">
            No previous entries yet.
          </p>
          <p className="text-sm text-[#8D8880] dark:text-[#78726A]">
            Write in today&apos;s page to start building your personal record.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#EBE6DD] dark:divide-[#2A2724]">
          {entries.map((entry) => {
            const firstLine = getFirstLine(entry);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedEntry(entry)}
                className="w-full text-left py-5 px-3 -mx-3 rounded-lg hover:bg-[#F4EFE7] dark:hover:bg-[#1E1C1A] transition cursor-pointer group"
              >
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="font-journal text-base font-semibold text-[#201F1E] dark:text-[#EAE6E1] group-hover:text-[#000] dark:group-hover:text-[#FFF]">
                    {formatEntryDateHeader(entry.date)}
                  </span>
                  <span className="text-xs text-[#8F8A82] dark:text-[#77726A]">
                    {entry.date}
                  </span>
                </div>

                {/* First line of user writing */}
                <p className="font-journal text-[17px] text-[#363432] dark:text-[#D1CCC4] line-clamp-1 leading-snug">
                  {firstLine}
                </p>

                {/* Gemini's short summary */}
                {entry.summary && (
                  <p className="text-xs text-[#6F6A63] dark:text-[#97928A] mt-2 line-clamp-2 leading-relaxed">
                    <span className="font-medium text-[#504C46] dark:text-[#B5B0A7]">Mini-Me: </span>
                    {entry.summary}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
