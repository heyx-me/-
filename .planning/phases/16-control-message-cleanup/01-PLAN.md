# Plan: Control Message Cleanup

## Goal
Implement the "Hydrate & Destroy" pattern to remove system/protocol messages (`GET_STATUS`, `DATA` updates) from the chat history, reducing clutter while preserving the "conversational" feel.

## Task List

### 1. Schema & Protocol Update
- [ ] **Define Constants:** Standardize `ephemeral: true` flag in the message payload.
- [ ] **Review Existing Actions:** Identify all client actions that should be ephemeral (`GET_STATUS`, `RESYNC_HISTORY`, `SELECT_GROUP`, `ADD_EVENT` if handled via UI).

### 2. Agent-Side Implementation (`agent.js`, `nanie/agent.mjs`)
- [ ] **Request Cleanup:** Update `handleMessage` in `agent.js` to:
    -   Detect `ephemeral: true` (or legacy `action` fields for backward compat).
    -   Immediately delete the user's message from the DB after reading it.
    -   **Constraint:** Skip deletion if global `DEBUG_MODE` (or equivalent check) is active.
- [ ] **Response Flagging:** Ensure all `DATA` / `SYSTEM` type responses from the Agent include `ephemeral: true`.

### 3. Client-Side Implementation (Shared Pattern)
- [ ] **Client Deletion Logic:**
    -   The client MUST delete the agent's `DATA` response **only after** successfully updating its local state/store.
    -   Add safety check: Do not delete if `debug_mode` is enabled in LocalStorage.
- [ ] **Startup Sweep:**
    -   On app mount, scan history for "stale" `ephemeral` messages (from the Agent) that were not consumed.
    -   Consume them -> Update State -> Delete them.
    -   *Note:* Do not delete pending *User Requests* (let the Agent handle those).

### 4. App-Specific Updates
#### Nanie (`nanie/app.jsx`)
- [ ] **Update `fetchStatus`:** Ensure `GET_STATUS` is sent with `ephemeral: true`.
- [ ] **Verify `DATA` Handling:** Confirm the existing delete logic aligns with the new standard (it currently checks `debug_mode`).
- [ ] **Event Adding:** When sending `ADD_EVENT` via the UI (Modal), mark as `ephemeral: true` so the command vanishes (the user sees the event appear in the list instead).

#### Rafi (`rafi/app.jsx` / `BankingContext`)
- [ ] **Audit Requests:** Identify `FETCH_TRANSACTIONS` or similar actions.
- [ ] **Implement Cleanup:** Apply the same "Consume & Delete" pattern for financial data payloads.

### 5. Verification
- [ ] **Debug Toggle:** Verify that setting `debug_mode = 'true'` in LocalStorage prevents deletion.
- [ ] **Empty State:** Verify a new chat with just `GET_STATUS` -> `DATA` results in a visually "empty" chat (but populated UI).
- [ ] **Error Handling:** Ensure if the Agent returns an `{ type: 'error' }`, it is displayed as a Toast and NOT deleted (or deleted but replaced with a persistent error message if needed? *Decision: Show Toast, delete message to keep chat clean?* -> *Refinement: Keep error messages visible or show as Toast? Context says "Show Toast".*)

## Implementation Steps
1.  **Refactor Agent (`agent.js`)**: Add the "Delete Request" logic.
2.  **Refactor Nanie (`nanie/app.jsx`)**: Standardize the "Delete Response" logic and add `ephemeral` flag to requests.
3.  **Refactor Rafi**: Apply similar changes.
4.  **Test**: Manual verification with Debug Mode toggle.
