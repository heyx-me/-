# Features Research: Chat Clutter Reduction

## Core Features

### 1. Ephemeral Control Messages
**Table Stakes:**
- User-initiated commands (e.g., clicking "Resync") send a request (`GET_STATUS`) that is **not** added to the visible chat history, or is removed immediately after the agent acknowledges it.
- **Behavior:**
    - User clicks button.
    - "Syncing..." toast appears.
    - No "User: /get_status" bubble clogs the chat.

### 2. Ephemeral Data Handoff
**Table Stakes:**
- Agent sends `DATA` payload (JSON).
- UI receives it -> Updates LocalStorage/State.
- UI removes the `DATA` bubble from the view.
- **Differentiator:** "Flash" effect or "absorbed" animation to show data being integrated into the dashboard/header.

### 3. History Sanitization
**Table Stakes:**
- When scrolling up (pagination), raw JSON `DATA` or old `GET_STATUS` commands are filtered out.
- Only human-readable text and relevant system events (like "User joined group") remain.

## Anti-Features
- **Silent Failures:** Deleting a message that *failed* to process/hydrate. The UI must retain it (red state) if hydration fails.
- **Context Amnesia:** Deleting data that the AI needs to answer follow-up questions (e.g., "What was the amount?").