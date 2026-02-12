# Requirements: Milestone v0.9 Chat Clutter Reduction

## Overview
Improve the user experience by treating system messages (commands and data payloads) as ephemeral signals rather than permanent chat logs. This ensures the conversation history remains focused on human-readable content while maintaining data consistency and AI context.

## v0.9 Requirements

### Ephemeral Control (SYS)
- [ ] **SYS-01**: **Ephemeral Commands**: UI-initiated command messages (e.g., `action: 'GET_STATUS'`) are deleted from the chat history once the agent has acknowledged or processed them.
- [ ] **SYS-02**: **Historical Sanitization**: The chat interface filters out pre-existing/stale system command messages from the history view to clean up legacy conversations.

### Ephemeral Data (DATA)
- [ ] **DATA-01**: **Hydrate & Destroy**: Upon receiving a `type: 'DATA'` message, the UI successfully updates the local application state (Store/Context) and then immediately triggers a deletion of that message from the server.
- [ ] **DATA-02**: **Safe Deletion**: The deletion only occurs *after* successful hydration. If hydration fails, the message remains visible (potentially with an error state) for debugging.
- [ ] **DATA-03**: **Debug Mode**: A developer toggle (e.g., `localStorage.debug_mode`) disables the auto-deletion logic, keeping all messages visible for troubleshooting.

### AI Context Safety (CTX)
- [ ] **CTX-01**: **Context Injection**: The Agent (`agent.js`) injects the *current known state* (from Nanie's filesystem or Rafi's cache) directly into the system prompt.
- [ ] **CTX-02**: **History Independence**: The Agent's ability to answer questions about current status (e.g., "What is my balance?") functions correctly even when the original `DATA` messages describing that status have been deleted from the chat history.

## Future / Out of Scope
- **Visual "Absorption" Animations:** Fancy UI effects showing messages flying into the dashboard are nice-to-have but not required for v0.9.
- **Server-side TTL:** We are using client-driven deletion for now; server-side auto-expiry is out of scope.

## Traceability
*(To be populated by Roadmap)*
