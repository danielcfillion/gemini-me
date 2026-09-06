import React, { useState, useEffect } from 'react';
import { Proposal, ProposedNote, NoteType, Board, MoodData } from '../types/journal';
import { applyProposal, discardProposal, updateProposal } from '../lib/firebase';
import { Check, X, Edit2, Sparkles, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';

interface ProposalPanelProps {
  userId: string;
  proposal: Proposal;
  availableBoards: Board[];
  onHandled?: () => void;
}

export const ProposalPanel: React.FC<ProposalPanelProps> = ({
  userId,
  proposal,
  availableBoards,
  onHandled,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMoodScore, setEditedMoodScore] = useState<number>(proposal.mood?.score || 3);
  const [editedMoodLabel, setEditedMoodLabel] = useState<string>(proposal.mood?.label || 'Reflective');
  const [notes, setNotes] = useState<ProposedNote[]>(proposal.proposedNotes || []);
  const [shouldCreateSuggestedBoard, setShouldCreateSuggestedBoard] = useState<boolean>(true);
  const [isApplying, setIsApplying] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(proposal.proposedNotes || []);
    setEditedMoodScore(proposal.mood?.score || 3);
    setEditedMoodLabel(proposal.mood?.label || 'Reflective');
  }, [proposal]);

  // Toggle board assignment on note
  const handleToggleBoard = (noteIndex: number, boardName: string) => {
    const next = [...notes];
    const currentBoards = next[noteIndex].boards || [];
    let updatedBoards: string[];
    if (currentBoards.includes(boardName)) {
      // Don't allow empty boards, keep at least one
      if (currentBoards.length > 1) {
        updatedBoards = currentBoards.filter((b) => b !== boardName);
      } else {
        updatedBoards = currentBoards;
      }
    } else {
      updatedBoards = [...currentBoards, boardName];
    }
    next[noteIndex] = {
      ...next[noteIndex],
      boards: updatedBoards,
    };
    setNotes(next);
  };

  const handleNoteFieldChange = (
    index: number,
    field: keyof ProposedNote,
    value: any
  ) => {
    const next = [...notes];
    next[index] = {
      ...next[index],
      [field]: value,
    };
    setNotes(next);
  };

  const handleRemoveNote = (index: number) => {
    const next = notes.filter((_, i) => i !== index);
    setNotes(next);
  };

  const handleApprove = async () => {
    setIsApplying(true);
    setError(null);
    try {
      const activeMood: MoodData = {
        score: editedMoodScore,
        label: editedMoodLabel.trim() || 'Reflective',
      };
      const activeProposal: Proposal = {
        ...proposal,
        mood: activeMood,
        proposedNotes: notes,
      };

      const newBoardNameToCreate =
        proposal.suggestedNewBoard && shouldCreateSuggestedBoard
          ? proposal.suggestedNewBoard
          : null;

      await applyProposal(userId, proposal.id, activeProposal, newBoardNameToCreate);
      setIsExpanded(false);
      if (onHandled) onHandled();
    } catch (err: any) {
      console.error('Failed to apply proposal:', err);
      setError(err?.message || 'Failed to save notes. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    setError(null);
    try {
      await discardProposal(userId, proposal.id);
      setIsExpanded(false);
      if (onHandled) onHandled();
    } catch (err: any) {
      console.error('Failed to discard proposal:', err);
      setError(err?.message || 'Failed to discard proposal.');
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleSaveEdits = async () => {
    try {
      const activeMood: MoodData = {
        score: editedMoodScore,
        label: editedMoodLabel.trim() || 'Reflective',
      };
      await updateProposal(userId, proposal.id, {
        mood: activeMood,
        proposedNotes: notes,
      });
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to update proposal draft:', err);
      setError('Could not update proposal draft.');
    }
  };

  const noteTypeBadges: Record<NoteType, { label: string; style: string }> = {
    task: { label: 'Task', style: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800' },
    idea: { label: 'Idea', style: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800' },
    plan: { label: 'Plan', style: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800' },
    habit: { label: 'Habit', style: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800' },
    win: { label: 'Win', style: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800' },
    worry: { label: 'Worry', style: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800' },
    fact: { label: 'Fact', style: 'bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700' },
  };

  // Combine available board names with suggested board if present
  const allBoardNames = Array.from(
    new Set([
      ...availableBoards.map((b) => b.name),
      ...(proposal.suggestedNewBoard && shouldCreateSuggestedBoard ? [proposal.suggestedNewBoard] : []),
    ])
  );

  const noteCount = notes.length;
  const countLabel = noteCount === 1 ? '1 thing' : `${noteCount} things`;

  // Collapsed single-line view directly above the composer
  if (!isExpanded) {
    return (
      <div
        id={`proposal-panel-${proposal.id}`}
        className="w-full mb-2"
      >
        <button
          id={`expand-proposal-${proposal.id}`}
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#FAF7F2] dark:bg-[#1E1C1A] border border-[#E8E3DA] dark:border-[#332F2B] hover:bg-[#F4EFE6] dark:hover:bg-[#252220] hover:border-[#DDD6C8] dark:hover:border-[#443F39] text-xs font-medium text-[#201F1E] dark:text-[#E8E6E3] transition-colors cursor-pointer group shadow-2xs"
          aria-expanded="false"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-stone-600 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors shrink-0" />
            <span>Mini-Me noticed {countLabel}</span>
            <span className="text-[#87827A] dark:text-[#7A756D]">·</span>
            <span className="font-semibold underline decoration-stone-400 dark:decoration-stone-500 underline-offset-2">
              Review
            </span>
          </div>
          <ChevronUp className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200 transition-transform group-hover:-translate-y-0.5 shrink-0" />
        </button>
      </div>
    );
  }

  // Expanded in-place view: max 50% of viewport height, scrollable inside
  return (
    <div
      id={`proposal-panel-${proposal.id}`}
      className="w-full mb-2 rounded-xl border border-stone-200 dark:border-[#332F2B] bg-[#FAF8F5] dark:bg-[#1C1B19] shadow-md flex flex-col max-h-[50vh] transition-all overflow-hidden"
      aria-expanded="true"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 dark:border-[#2C2926] px-3.5 py-2.5 bg-[#F6F2EA] dark:bg-[#23201D] shrink-0">
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="flex items-center gap-1.5 text-left cursor-pointer group hover:opacity-80 transition-opacity"
          title="Collapse proposal review"
        >
          <Sparkles className="h-3.5 w-3.5 text-stone-700 dark:text-stone-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-stone-200">
            Mini-Me noticed ({countLabel})
          </span>
          <ChevronDown className="h-3 w-3 text-stone-500 dark:text-stone-400 shrink-0" />
        </button>

        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <button
              type="button"
              onClick={handleSaveEdits}
              className="inline-flex items-center gap-1 rounded-md border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 cursor-pointer"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 cursor-pointer"
              title="Edit extracted notes or boards"
            >
              <Edit2 className="h-3 w-3" />
              <span>Edit</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDiscard}
            disabled={isDiscarding || isApplying}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 disabled:opacity-50 cursor-pointer"
            title="Discard this proposal"
          >
            <X className="h-3 w-3" />
            <span>Discard</span>
          </button>

          <button
            type="button"
            onClick={handleApprove}
            disabled={isApplying || isDiscarding}
            className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 dark:bg-stone-100 px-3 py-1 text-xs font-medium text-white dark:text-stone-900 shadow-xs transition-colors hover:bg-stone-800 dark:hover:bg-white disabled:opacity-50 cursor-pointer"
            title="Approve and write notes to boards"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{isApplying ? 'Saving...' : 'Approve'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable contents inside: max 50% viewport height */}
      <div className="p-3.5 overflow-y-auto overscroll-contain space-y-3 flex-1 text-xs">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Mood detected (only when mood data is present) */}
        {proposal.mood && (
          <div className="flex flex-wrap items-center gap-2.5 text-stone-700 dark:text-stone-300">
            <span className="font-medium text-stone-800 dark:text-stone-200">Detected Mood:</span>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <select
                  value={editedMoodScore}
                  onChange={(e) => setEditedMoodScore(Number(e.target.value))}
                  className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1 text-xs text-stone-900 dark:text-stone-100"
                >
                  <option value={1}>1 - Struggling / Low</option>
                  <option value={2}>2 - Weary / Somber</option>
                  <option value={3}>3 - Steady / Calm</option>
                  <option value={4}>4 - Content / Uplifted</option>
                  <option value={5}>5 - Energized / Joyful</option>
                </select>
                <input
                  type="text"
                  value={editedMoodLabel}
                  onChange={(e) => setEditedMoodLabel(e.target.value)}
                  placeholder="Mood label..."
                  className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-0.5 text-xs font-medium text-stone-800 dark:text-stone-200 shadow-2xs">
                <span
                  className={`h-2 w-2 rounded-full ${
                    editedMoodScore >= 4
                      ? 'bg-emerald-500'
                      : editedMoodScore === 3
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span>
                  {editedMoodLabel} ({editedMoodScore}/5)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Suggested new board offer */}
        {proposal.suggestedNewBoard && (
          <div className="flex items-center gap-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/80 dark:bg-indigo-950/40 p-2.5 text-indigo-950 dark:text-indigo-200">
            <label className="flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={shouldCreateSuggestedBoard}
                onChange={(e) => setShouldCreateSuggestedBoard(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Create new board: <strong>{proposal.suggestedNewBoard}</strong></span>
            </label>
          </div>
        )}

        {/* Proposed notes list */}
        <div className="space-y-2.5">
          {notes.length === 0 ? (
            <p className="py-2 italic text-stone-500 dark:text-stone-400">
              No specific items extracted; approving will record today's mood score.
            </p>
          ) : (
            notes.map((item, idx) => {
              const badge =
                noteTypeBadges[item.type as NoteType] || noteTypeBadges.idea;

              return (
                <div
                  key={item.id || idx}
                  className="rounded-lg border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-900/60 p-3 shadow-2xs"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={item.type}
                            onChange={(e) =>
                              handleNoteFieldChange(
                                idx,
                                'type',
                                e.target.value as NoteType
                              )
                            }
                            className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1 text-xs text-stone-800 dark:text-stone-200"
                          >
                            <option value="task">Task</option>
                            <option value="idea">Idea</option>
                            <option value="plan">Plan</option>
                            <option value="habit">Habit</option>
                            <option value="win">Win</option>
                            <option value="worry">Worry</option>
                            <option value="fact">Fact</option>
                          </select>

                          <input
                            type="date"
                            value={item.dueDate || ''}
                            onChange={(e) =>
                              handleNoteFieldChange(idx, 'dueDate', e.target.value || null)
                            }
                            className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1 text-xs text-stone-700 dark:text-stone-300"
                            title="Optional due date"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveNote(idx)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>

                      <textarea
                        value={item.text}
                        onChange={(e) =>
                          handleNoteFieldChange(idx, 'text', e.target.value)
                        }
                        rows={2}
                        placeholder="Note text..."
                        className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-1.5 text-xs text-stone-800 dark:text-stone-200 focus:outline-hidden"
                      />

                      {/* Board Chips Selector */}
                      <div>
                        <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                          Belongs to boards (click to toggle):
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {allBoardNames.map((boardName) => {
                            const isSelected = item.boards?.includes(boardName);
                            return (
                              <button
                                key={boardName}
                                type="button"
                                onClick={() => handleToggleBoard(idx, boardName)}
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                                    : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                                }`}
                              >
                                {boardName}
                                {isSelected && <Check className="ml-1 h-3 w-3" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${badge.style}`}
                          >
                            {badge.label}
                          </span>

                          {item.dueDate && (
                            <span className="text-[11px] text-stone-500 dark:text-stone-400">
                              Due: {item.dueDate}
                            </span>
                          )}
                        </div>

                        {/* Boards chips */}
                        <div className="flex flex-wrap gap-1">
                          {allBoardNames.map((bName) => {
                            const active = item.boards?.includes(bName);
                            return (
                              <button
                                key={bName}
                                type="button"
                                onClick={() => handleToggleBoard(idx, bName)}
                                title={active ? `Remove from ${bName}` : `Add to ${bName}`}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900'
                                    : 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500 hover:bg-stone-200 hover:text-stone-700 dark:hover:bg-stone-700 dark:hover:text-stone-300'
                                }`}
                              >
                                {bName}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <p className="text-xs font-medium leading-relaxed text-stone-900 dark:text-stone-100">
                        {item.text}
                      </p>

                      {item.sourceQuote && (
                        <p className="mt-1 text-[11px] italic text-stone-500 dark:text-stone-400">
                          "{item.sourceQuote}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
