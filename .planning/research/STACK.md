# Stack Research: Nanie Multi-tenancy

## Overview
This milestone leverages the existing stack (Node.js, Baileys, React) but requires significant restructuring of the internal data storage patterns to support multi-tenancy. No new external libraries are strictly required, but we will formalize the filesystem structure.

## Dependencies

### Existing (Leverage)
-   **@whiskeysockets/baileys:**
    -   Use `sock.groupFetchAllParticipating()` to retrieve available groups.
    -   Use `sock.ev.on('messages.upsert')` filtering by `jid` (Group ID).
-   **FileSystem (Node.js `fs`):**
    -   Move from flat files (`ella_cache.json`) to directory-based indexing (`nanie/memory/${groupId}.json`).

### New / Changed
-   **State Management (Backend):**
    -   Introduce `conversation_mapping.json` (or similar) to map `supa_conversation_id` -> `whatsapp_group_id`.
    -   Refactor `NanieAgent` to be a "Manager" of multiple group timelines rather than a single timeline instance.

## Considerations
-   **Database vs. FileSystem:**
    -   *Current:* Filesystem for ease of prototyping/portability.
    -   *Recommendation:* Stick to Filesystem for this milestone to minimize migration friction, but structure it cleanly (`nanie/memory/`) so it can be ported to Supabase later if needed.
-   **Supabase:**
    -   Continue using Supabase for the `conversations` table (which provides the `conversation_id`), but the *link* to the WhatsApp group will be stored locally by the agent for now (to keep the agent self-contained).

## Conclusion
No `package.json` changes expected. Focus is on refactoring `nanie/agent.mjs` logic.
