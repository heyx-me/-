# Research Summary: Nanie Multi-tenancy

## Key Findings

**Stack:**
-   **No new deps.** Relies on `baileys` (existing) and Node `fs`.
-   **Data Model:** Shifts from singleton files to directory-based isolation (`nanie/memory/${groupId}.json`).

**Architecture:**
-   **Manager Pattern:** `NanieAgent` becomes a manager of multiple timelines.
-   **Mapping:** A persistent JSON map links `Supabase Conversation ID` <-> `WhatsApp Group ID`.
-   **Push Updates:** Background loop broadcasts WhatsApp events to all subscribed conversations.

**Feature Table Stakes:**
-   **Group List:** Fetching/displaying available groups.
-   **Selection:** Binding a conversation to a group.
-   **Isolation:** Ensuring memory/events are strictly scoped to the selected group.

**Watch Out For:**
-   **Concurrency:** Race conditions writing to JSON files (mitigate with in-memory truth + periodic flush).
-   **Unmapped State:** Handling "orphaned" conversations gracefully.

## Conclusion
The path is clear. We will refactor `nanie/agent.mjs` to handle the mapping and isolation logic, and update `nanie/app.jsx` to support the selection flow.
