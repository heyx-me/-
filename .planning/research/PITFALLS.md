# Pitfalls Research: Chat Clutter Reduction

## 1. Race Conditions (The "Lost Data" Trap)
- **Risk:** UI receives `DATA`, triggers delete, but the `localStorage` write fails or hasn't finished.
- **Prevention:**
    - **Ack-based Deletion:** Only delete after `localStorage.setItem` returns (it's synchronous, but the state update loop isn't).
    - **Verify-then-Delete:** Re-read storage to confirm data exists before sending DELETE.

## 2. Context Loss for AI
- **Risk:** User asks "Summarize my last transaction". Agent looks at chat history. Chat history is empty because `DATA` message was deleted.
- **Prevention:**
    - The Agent must **inject context** from the current state (the dashboard data) into the system prompt, rather than relying on the chat log.
    - *Note:* Rafi already does this partially, but we must verify it doesn't rely on recent `DATA` messages.

## 3. Debugging Nightmares
- **Risk:** "Why isn't the dashboard updating?" -> Check chat. Chat is empty. Developer is blind.
- **Prevention:**
    - **Debug Mode:** A setting in `localStorage` (`debug_mode=true`) that disables auto-deletion.
    - **Logs:** Browser console logs must be verbose about "Hydrated DATA from msg #123" and "Deleted msg #123".

## 4. "Ghost" Messages
- **Risk:** Realtime update removes the message from DB, but UI state doesn't update, leaving a blank bubble or a broken component.
- **Prevention:**
    - Robust `onDelete` handler in the UI that cleanly removes the message object from the React state array.