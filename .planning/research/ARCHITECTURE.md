# Architecture Research: Chat Clutter Reduction

## Message Lifecycle Update

### Current Flow
1. User/UI sends `GET_STATUS`.
2. Saved to DB.
3. Agent reads DB, sends `DATA`.
4. Saved to DB.
5. UI renders `DATA` bubble.

### Proposed Flow (Clean)
1. **Command:** UI sends `GET_STATUS`.
    - *Option A:* Send as `ephemeral: true` (Agent doesn't save to DB, just processes).
    - *Option B:* Save to DB, Agent processes, then Agent deletes command.
2. **Response:** Agent sends `DATA`.
    - Saved to DB (for reliability).
3. **Consumption:** UI receives `DATA`.
    - Validates payload.
    - Merges into `localStorage`.
4. **Cleanup:**
    - UI triggers `DELETE_MESSAGE { id }` (or Agent self-destructs after N seconds?).
    - *Decision:* **UI-driven cleanup** is safer. The consumer knows when it has successfully ingested the data.

## Integration Strategy

### Frontend (`app.jsx`)
- **Interceptor:** A `useEffect` monitoring the `messages` array.
- **Logic:**
    ```javascript
    if (msg.type === 'DATA' && !msg.processed) {
      const success = hydrateStore(msg.content);
      if (success) {
        deleteMessage(msg.id); // Call backend/agent to remove
      }
    }
    ```

### Backend (`agent.js`)
- **Context Preservation:**
    - If `DATA` is deleted, `agent.js` can no longer read it from the `messages` table for context.
    - **Mitigation:**
        - **Nanie:** Relies on `nanie/memory/` (Filesystem). Safe.
        - **Rafi:** Relies on scraped state. *Action needed:* Ensure Rafi injects context from `latest_state` (memory/cache) rather than chat history.

## Components
- **MessageFilter:** A utility in the frontend to filter out "zombie" control messages that might have been missed by cleanup (sanitization).
- **CleanupQueue:** A robust retry mechanism in the UI to ensure delete requests go through even if network flickers.