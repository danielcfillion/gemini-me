import React, { useState, useEffect } from 'react';
import { Board, Note, NoteType, NoteStatus } from '../types/journal';
import {
  createBoard,
  createManualNote,
  deleteNote,
  updateNoteStatus,
  subscribeToBoardNotes,
} from '../lib/firebase';
import {
  Folder,
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Tag,
  Briefcase,
  Users,
  UserCheck,
  Heart,
  DollarSign,
  Coffee,
  Target,
  FileText,
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
} from 'lucide-react';

interface BoardsViewProps {
  userId: string;
  boards: Board[];
  notes: Note[];
}

export const BoardsView: React.FC<BoardsViewProps> = ({
  userId,
  boards,
  notes,
}) => {
  const [selectedBoardName, setSelectedBoardName] = useState<string | null>(null);
  const [boardSpecificNotes, setBoardSpecificNotes] = useState<Note[]>([]);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');

  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState<NoteType>('task');
  const [newNoteDueDate, setNewNoteDueDate] = useState('');
  const [newNoteBoards, setNewNoteBoards] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When a board is selected, run subscription with where('boards', 'array-contains', boardName)
  useEffect(() => {
    if (!selectedBoardName) {
      setBoardSpecificNotes([]);
      return;
    }
    setNewNoteBoards([selectedBoardName]);
    const unsubscribe = subscribeToBoardNotes(
      userId,
      selectedBoardName,
      (fetchedNotes) => {
        setBoardSpecificNotes(fetchedNotes);
      }
    );
    return () => unsubscribe();
  }, [userId, selectedBoardName]);

  const selectedBoard = boards.find(
    (b) => b.name.toLowerCase() === selectedBoardName?.toLowerCase()
  );

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    setIsSubmitting(true);
    try {
      await createBoard(userId, newBoardName, newBoardDesc);
      setNewBoardName('');
      setNewBoardDesc('');
      setIsCreatingBoard(false);
    } catch (err) {
      console.error('Failed to create board:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateManualNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setIsSubmitting(true);
    try {
      const targetBoards = newNoteBoards.length > 0 ? newNoteBoards : [selectedBoardName || 'Work'];
      await createManualNote(userId, {
        text: newNoteText.trim(),
        type: newNoteType,
        boards: targetBoards,
        status: 'open',
        dueDate: newNoteDueDate || null,
      });
      setNewNoteText('');
      setNewNoteDueDate('');
      setIsAddingNote(false);
    } catch (err) {
      console.error('Failed to create note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (noteId: string, newStatus: NoteStatus) => {
    try {
      await updateNoteStatus(userId, noteId, newStatus);
    } catch (err) {
      console.error('Failed to update note status:', err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(userId, noteId);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const getBoardIcon = (nameOrSlug: string) => {
    const s = nameOrSlug.toLowerCase();
    if (s.includes('work')) return <Briefcase className="h-5 w-5 text-stone-700" />;
    if (s.includes('family')) return <Users className="h-5 w-5 text-stone-700" />;
    if (s.includes('friends')) return <UserCheck className="h-5 w-5 text-stone-700" />;
    if (s.includes('health')) return <Heart className="h-5 w-5 text-stone-700" />;
    if (s.includes('money')) return <DollarSign className="h-5 w-5 text-stone-700" />;
    if (s.includes('leisure')) return <Coffee className="h-5 w-5 text-stone-700" />;
    if (s.includes('goals')) return <Target className="h-5 w-5 text-stone-700" />;
    return <Folder className="h-5 w-5 text-stone-700" />;
  };

  const noteTypeBadges: Record<NoteType, { label: string; style: string }> = {
    task: { label: 'Task', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    idea: { label: 'Idea', style: 'bg-purple-50 text-purple-800 border-purple-200' },
    plan: { label: 'Plan', style: 'bg-sky-50 text-sky-800 border-sky-200' },
    habit: { label: 'Habit', style: 'bg-amber-50 text-amber-800 border-amber-200' },
    win: { label: 'Win', style: 'bg-green-50 text-green-800 border-green-200' },
    worry: { label: 'Worry', style: 'bg-rose-50 text-rose-800 border-rose-200' },
    fact: { label: 'Fact', style: 'bg-stone-100 text-stone-700 border-stone-300' },
  };

  // Group notes by status: open first, done second, dropped third
  const openNotes = boardSpecificNotes.filter((n) => n.status === 'open');
  const doneNotes = boardSpecificNotes.filter((n) => n.status === 'done');
  const droppedNotes = boardSpecificNotes.filter((n) => n.status === 'dropped');

  return (
    <div className="w-full max-w-[760px] mx-auto px-4 sm:px-6 py-8">
      {selectedBoard ? (
        /* Board Detail View */
        <div className="space-y-6">
          {/* Breadcrumb & Header */}
          <div className="flex items-center justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <button
                type="button"
                onClick={() => setSelectedBoardName(null)}
                className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors mb-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to All Boards
              </button>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100">
                  {getBoardIcon(selectedBoard.name)}
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-stone-900">
                    {selectedBoard.name}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {selectedBoard.description || 'Categorized notes and action items.'}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingNote((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-stone-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Note
            </button>
          </div>

          {/* Add note inline form */}
          {isAddingNote && (
            <form
              onSubmit={handleCreateManualNote}
              className="rounded-xl border border-stone-300 bg-stone-50/80 p-4 shadow-xs space-y-3"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                New Note in {selectedBoard.name}
              </h4>

              <textarea
                rows={2}
                required
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="What is on your mind?"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:outline-hidden"
              />

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-stone-600">
                  <span>Type:</span>
                  <select
                    value={newNoteType}
                    onChange={(e) => setNewNoteType(e.target.value as NoteType)}
                    className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900"
                  >
                    <option value="task">Task</option>
                    <option value="idea">Idea</option>
                    <option value="plan">Plan</option>
                    <option value="habit">Habit</option>
                    <option value="win">Win</option>
                    <option value="worry">Worry</option>
                    <option value="fact">Fact</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-stone-600">
                  <span>Due:</span>
                  <input
                    type="date"
                    value={newNoteDueDate}
                    onChange={(e) => setNewNoteDueDate(e.target.value)}
                    className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800"
                  />
                </div>
              </div>

              {/* Boards selector */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-stone-600">
                  Boards:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {boards.map((b) => {
                    const checked = newNoteBoards.includes(b.name);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          if (checked) {
                            if (newNoteBoards.length > 1) {
                              setNewNoteBoards(newNoteBoards.filter((x) => x !== b.name));
                            }
                          } else {
                            setNewNoteBoards([...newNoteBoards, b.name]);
                          }
                        }}
                        className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                          checked
                            ? 'bg-stone-900 text-white'
                            : 'bg-stone-200/70 text-stone-700 hover:bg-stone-300'
                        }`}
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNote(false)}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          )}

          {/* Notes list grouped by status */}
          {boardSpecificNotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 py-12 text-center">
              <FileText className="mx-auto h-8 w-8 text-stone-300" />
              <h3 className="mt-2 text-sm font-medium text-stone-700">
                No notes in {selectedBoard.name} yet
              </h3>
              <p className="mt-1 text-xs text-stone-500">
                Notes appear here when Mini-Me extracts them or when you add them manually.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. Open Notes */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Circle className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Open ({openNotes.length})
                  </h3>
                </div>

                {openNotes.length === 0 ? (
                  <p className="text-xs text-stone-400 italic pl-5">No open notes.</p>
                ) : (
                  <div className="space-y-2.5">
                    {openNotes.map((note) => renderNoteCard(note))}
                  </div>
                )}
              </div>

              {/* 2. Done Notes */}
              {doneNotes.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600/20" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                      Done ({doneNotes.length})
                    </h3>
                  </div>
                  <div className="space-y-2.5">
                    {doneNotes.map((note) => renderNoteCard(note))}
                  </div>
                </div>
              )}

              {/* 3. Dropped Notes */}
              {droppedNotes.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-stone-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Dropped ({droppedNotes.length})
                    </h3>
                  </div>
                  <div className="space-y-2.5">
                    {droppedNotes.map((note) => renderNoteCard(note))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Boards Grid View */
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-stone-900">
                Boards
              </h2>
              <p className="text-xs text-stone-500">
                Organize your life domains: Work, Family, Friends, Health, Money, Leisure, Goals, and custom boards.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingBoard((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-stone-800"
            >
              <Plus className="h-3.5 w-3.5" />
              New Board
            </button>
          </div>

          {/* New Board Modal/Form */}
          {isCreatingBoard && (
            <form
              onSubmit={handleCreateBoard}
              className="rounded-xl border border-stone-300 bg-stone-50 p-4 shadow-xs space-y-3"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                Create Board
              </h4>
              <input
                type="text"
                required
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Board name (e.g. Side Project, Gardening)"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:outline-hidden"
              />
              <input
                type="text"
                value={newBoardDesc}
                onChange={(e) => setNewBoardDesc(e.target.value)}
                placeholder="Short description (optional)"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 focus:outline-hidden"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingBoard(false)}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}

          {/* Boards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => {
              // Count how many notes belong to this board
              const count = notes.filter(
                (n) => Array.isArray(n.boards) && n.boards.includes(b.name)
              ).length;

              return (
                <div
                  key={b.id}
                  id={`board-card-${b.id}`}
                  onClick={() => setSelectedBoardName(b.name)}
                  className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-2xs transition-all hover:border-stone-400 hover:shadow-xs cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 group-hover:bg-stone-200 transition-colors">
                        {getBoardIcon(b.name)}
                      </div>
                      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                        {count} {count === 1 ? 'note' : 'notes'}
                      </span>
                    </div>

                    <h3 className="mt-3.5 text-base font-semibold text-stone-900">
                      {b.name}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">
                      {b.description || 'Categorized reflections and tasks.'}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs font-medium text-stone-600 group-hover:text-stone-900">
                    <span>View Board</span>
                    <span>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  function renderNoteCard(note: Note) {
    const badge = noteTypeBadges[note.type] || noteTypeBadges.idea;

    return (
      <div
        key={note.id}
        id={`note-${note.id}`}
        className="group relative rounded-xl border border-stone-200 bg-white p-4 shadow-2xs transition-shadow hover:shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${badge.style}`}
            >
              <Tag className="mr-1 h-2.5 w-2.5" />
              {badge.label}
            </span>

            {note.dueDate && (
              <span className="flex items-center text-[11px] text-stone-500">
                <Clock className="mr-1 h-3 w-3 text-stone-400" />
                Due: {note.dueDate}
              </span>
            )}
          </div>

          {/* Action controls: mark done / mark dropped / delete */}
          <div className="flex items-center gap-1.5">
            {note.status !== 'done' && (
              <button
                type="button"
                onClick={() => handleStatusChange(note.id, 'done')}
                className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                title="Mark note as Done"
              >
                <CheckCircle2 className="h-3 w-3" />
                Done
              </button>
            )}

            {note.status !== 'dropped' && (
              <button
                type="button"
                onClick={() => handleStatusChange(note.id, 'dropped')}
                className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                title="Mark note as Dropped"
              >
                <XCircle className="h-3 w-3" />
                Drop
              </button>
            )}

            {note.status !== 'open' && (
              <button
                type="button"
                onClick={() => handleStatusChange(note.id, 'open')}
                className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                title="Reopen note"
              >
                Reopen
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDeleteNote(note.id)}
              className="ml-1 text-stone-300 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
              title="Delete note permanently"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Note single text field */}
        <p
          className={`text-xs leading-relaxed ${
            note.status === 'done'
              ? 'line-through text-stone-400'
              : note.status === 'dropped'
              ? 'text-stone-400 italic'
              : 'text-stone-900 font-medium'
          }`}
        >
          {note.text}
        </p>

        {/* Multi-board tags */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-stone-400 mr-1">Boards:</span>
          {note.boards.map((bName) => (
            <span
              key={bName}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedBoardName(bName);
              }}
              className="cursor-pointer rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 hover:bg-stone-200 hover:text-stone-900 transition-colors"
            >
              {bName}
            </span>
          ))}

          {note.sourceQuote && (
            <span className="ml-auto text-[10px] italic text-stone-400">
              "{note.sourceQuote}"
            </span>
          )}
        </div>
      </div>
    );
  }
};
