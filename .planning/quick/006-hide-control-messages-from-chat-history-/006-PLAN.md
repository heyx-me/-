# Quick Plan: Hide Control Messages

## Context
User wants to hide technical JSON protocol messages (control actions, data payloads) from the visual chat history in the main UI and potentially from the agent's context.

## Tasks

### Task 1: Filter Control Messages in UI (`app.jsx`)
**Goal**: Prevent control messages from appearing as chat bubbles.
- **File**: `app.jsx`
- **Change**:
    - Implement a `shouldHideMessage(content)` helper.
    - Logic: Hide if content is JSON and:
        - Has `action` property (User control message).
        - Has `type` property AND `type` is NOT `text`, `thinking`, or `error` (Bot data/status message).
    - Apply this filter in `ChatInterface` when processing incoming messages (both initial load and realtime subscription).

### Task 2: Filter Control Messages in Agent Context (`agent.js`)
**Goal**: Prevent control messages from polluting the LLM's context window.
- **File**: `agent.js`
- **Change**:
    - Reuse/duplicate the filtering logic (since they are separate environments).
    - In `handleMessage`, when building the `history` array for the `model.startChat`, filter out the hidden messages.

### Task 3: Verification
- **Manual**: Send a control message (e.g., via `agent.js` logic or manually if possible) and verify it doesn't show in UI but the system still works.
- **Automated**: Not strictly applicable for this visual change in quick mode, but check for no regressions in build/lint if available.
