# Research Summary: Chat Clutter Reduction

## Key Findings

### 1. Stack & Architecture
- **No new libs:** Use existing Supabase + React stack.
- **UI-Driven Cleanup:** The Frontend (Consumer) is the authority on when data is safely stored, so it should initiate the deletion.
- **Protocol:** `DATA` messages remain as `type: 'DATA'` but will be actively hunted down and destroyed by the UI after consumption.

### 2. Feature Behavior
- **Ephemeral Commands:** `GET_STATUS` and `LIST_GROUPS` vanish after processing.
- **Data Absorption:** `DATA` bubbles appear, transfer their payload to the dashboard/header, and then disappear (visual "absorption" effect is a nice-to-have).
- **History Hygiene:** Historical views filter out leftover JSON.

### 3. Critical Risks
- **AI Context Amnesia:** Deleting `DATA` messages removes them from the LLM's context window if the agent relies on raw chat history.
    - *Mitigation:* Ensure Agents inject context from their **State Store** (Nanie: FS, Rafi: Cache), not Chat History.
- **Debugging:** Invisible messages make bugs hard to trace.
    - *Mitigation:* Implement a `debug_mode` toggle.

## Recommendations
1.  **Implement "Auto-Delete" in `app.jsx`:** A hook that ingests `DATA`, updates store, then calls `deleteMessage(id)`.
2.  **Verify Agent Context:** Audit `agent.js` prompt construction to ensure it uses the *current state* snapshot, not just the message log.
3.  **Debug Toggle:** Add a hidden/developer toggle to keep messages for troubleshooting.