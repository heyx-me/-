# Pitfalls Research: Nanie Multi-tenancy

## 1. File Locking & Concurrency
-   **Risk:** Two requests (or a request and the background loop) try to write to `memory/XYZ.json` simultaneously.
-   **Mitigation:**
    -   Use `fs.promises.writeFile` with a specialized "save queue" or simple in-memory flag `isSaving[groupId]`.
    -   Keep the "source of truth" in memory (`this.timelines`) and only flush to disk periodically or after significant changes, rather than on every event.

## 2. Notification Storms
-   **Risk:** If a user has 5 conversations open for the *same* WhatsApp group, a single new WhatsApp message could trigger 5 simultaneous updates/re-renders.
-   **Mitigation:**
    -   The UI should handle debouncing.
    -   The backend should optimize: distinct conversations map to the same group, but we should perhaps only define *one* primary conversation per group?
    -   *Decision:* For now, allow multiple, but be aware. Typically a user only needs one conversation per group.

## 3. Baileys Session State
-   **Risk:** The `auth_info` is shared. If the connection drops, *all* tenants go offline.
-   **Mitigation:**
    -   This is acceptable (it's one phone).
    -   Ensure re-connection logic remains robust.

## 4. Unmapped Conversations
-   **Risk:** A user starts a chat but never selects a group. The agent receives "Hello" but doesn't know where to look.
-   **Mitigation:**
    -   `handleMessage` must check for mapping existence.
    -   If missing, return a special `GROUP_SELECTION_REQUIRED` response (or just a text prompt) to trigger the UI flow.

## 5. Privacy Leakage
-   **Risk:** `getGroupId` implementation bug returns Group A for Conversation B.
-   **Mitigation:**
    -   Strict lookup logic.
    -   Unit tests for the `ConversationMapper`.
