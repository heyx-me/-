# Phase 16: Control Message Cleanup

## Goal
Clean up the chat interface by removing system/protocol messages (`GET_STATUS`, `DATA` updates) to reduce visual clutter. The chat should feel like a conversation, while UI actions (refresh, update) feel like seamless app interactions.

## Core Decisions

### 1. Definition of "Clutter" & Ephemeral Messages
- **Explicit Flag:** Use a metadata flag `ephemeral: true` to mark messages intended for cleanup.
- **Content Rule:**
    - Messages with `text` content are **User/Agent Initiated** and MUST be preserved.
    - Messages containing *only* `DATA` or structured JSON commands (e.g., `GET_STATUS`) are considered "Protocol" messages and candidates for deletion.
- **UI Actions:** Button clicks that send commands (e.g., "Pay Now" in a preview) are treated as Protocol messages (`ephemeral: true`).

### 2. Deletion Strategy: "Hard Delete"
Messages are **hard deleted** from the database to save space and privacy, not just hidden in the UI.

#### The "Handshake" Protocol
Responsibility for deletion is distributed based on who "consumes" the message:
1.  **Agent (Consumer of Requests):**
    - The **Agent** is responsible for deleting User Requests (e.g., `GET_STATUS`).
    - **Timing:** Immediately upon reading/processing the message.
    - **Safety:** If the agent deletes the request but fails to respond, it's acceptable (User can retry).
2.  **Client (Consumer of Responses):**
    - The **Client** is responsible for deleting Agent Responses (e.g., `DATA` payloads).
    - **Timing:** Only **after** the client has successfully consumed the data and updated the Store/UI.
    - **Startup Sweep:** On startup, the client checks for unconsumed `DATA` messages, processes them, and then deletes them. This happens *after* initial rendering.
    - **Stale Requests:** The Client does *not* delete stale `GET_STATUS` messages found on startup; it waits for the Agent to process them.

### 3. Visibility & Debugging
- **Brief Visibility:** Messages may be visible briefly before being deleted (Client deletes after render/update).
- **Empty Chat:** It is acceptable for a chat to appear empty if all initial messages were protocol commands.
- **Debug Toggle:**
    - If the global "Show System Messages" toggle is **ON**:
        - **ALL** deletion logic is bypassed.
        - `ephemeral: true` messages remain visible and persistent.
        - Startup sweeps are skipped.

### 4. UI Feedback
- **Preview Pane:**
    - Tracks its own "Pending" state while waiting for data.
    - Relies on the existence of the `GET_STATUS` (or equivalent) message as an indicator of an active request until the Agent deletes it.
- **Errors:** If an ephemeral command fails or produces an error, show a **Toast** notification. Do not resurrect the deleted message in the chat.
