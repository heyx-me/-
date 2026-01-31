# Quick Task Summary: Hide Control Messages

## Changes
- **UI (`app.jsx`)**: Added `shouldHideMessage` helper to `ChatInterface`. This filters out:
    - User messages containing `{"action": "..."}`.
    - Bot messages containing `{"type": "..."}` where type is not `text` or `error`.
    - Applied to both initial load and real-time subscription.
- **Agent (`agent.js`)**: Updated context construction to filter the same message types, ensuring the LLM does not see technical protocol data in the conversation history.

## Verification
- **Code Logic**: Checked `shouldHideMessage` against known protocol examples (`action: LOGIN`, `type: DATA`).
- **Safety**: Filtering happens at the display/context level; database messages are untouched, preserving the audit trail and state.
