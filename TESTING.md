# Manual test walkthrough

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the app, click Sign in with Google. | Redirect to the Today screen. Profile document created under `users/{uid}` with role `user`. Seven boards seeded. |
| 2 | Write: "Finished the client proposal this morning. Need to send the invoice by Wednesday. Knee sore since Thursday." Send. | Mini-Me replies in under 150 words with one or two follow-up questions. Entry saved at `users/{uid}/entries/{today}`. |
| 3 | Wait for the "Mini-Me noticed" bar above the composer. Expand it. | Three notes: a win on Work, a task on Work with a due date, a worry on Health. A mood score between 1 and 5. In Firestore, `proposals` has one pending document and `notes` has nothing new. |
| 4 | Toggle a board chip on one note, edit its text, then Approve. | Proposal status becomes `applied`. Notes appear in `users/{uid}/notes`. Entry document gains `mood`. |
| 5 | Open Boards, then Work. | The win and the task appear. Mark the task Done; it moves to the Done section. |
| 6 | Send a short reply such as "yes" in the journal. | Mini-Me replies. No new proposal is created. |
| 7 | In the journal, type "what's open on my Work board?" | One-line handoff to Ask Mini-Me. No model call. |
| 8 | Click Ask Mini-Me and ask "what's open on my Work board?" | Answer lists the open notes with a "Listed notes" badge. |
| 9 | Ask "what did I say about my car?" | Mini-Me says you have not written about it. |
| 10 | Ask "move the invoice note to Money". | Mini-Me says it cannot change notes and points to Boards. |
| 11 | Sign out, sign in again. | History shows the entry with its summary and mood. |
| 12 | `curl -i -X POST https://<service-url>/api/chat` with no header. | `401 {"error":"Sign in required."}`. Same for `/api/extract`, `/api/summarize`, `/api/coach`. |
| 13 | Turn off network mid-send (dev tools, Offline) and send an entry. | Inline error with a Retry button. The typed text is not lost. |