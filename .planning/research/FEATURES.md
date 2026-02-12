# Features Research: Nanie Multi-tenancy

## Core Capabilities

### 1. Group Discovery
**Goal:** Allow the user to see which WhatsApp groups the connected phone number is a participant of.
-   **Mechanism:** Agent API exposes a `LIST_GROUPS` command.
-   **Data:** Returns an array of `{ id, subject, participantCount }`.
-   **UI:** A scrollable list in the Nanie setup screen.

### 2. Context Linking (Multi-tenancy)
**Goal:** Associate a generic "New Chat" in Heyx-me with a specific WhatsApp context (Group).
-   **Mechanism:**
    -   User selects a group from the list.
    -   UI sends `SELECT_GROUP { groupId, conversationId }`.
    -   Agent saves this mapping.
-   **Behavior:** Once linked, all future messages in this Heyx-me conversation are treated as "queries" against that specific WhatsApp group's timeline.

### 3. Isolated Memory
**Goal:** Ensure that "What happened yesterday?" queries only search the relevant group's history.
-   **Behavior:**
    -   If I'm in the "Family Group" chat, Nanie only recalls family events.
    -   If I'm in the "Work Group" chat, Nanie only recalls work events.
-   **Implementation:** The timeline extraction and caching logic must be scoped by `groupId`.

## UX Flow
1.  **User** clicks "New Chat" -> "Nanie".
2.  **App** checks if this conversation is already linked.
    -   *No:* Displays "Select a WhatsApp Group to track".
    -   *Yes:* Displays the Timeline view.
3.  **User** selects "Family Chat".
4.  **App** sends selection to Agent.
5.  **Agent** initializes memory for "Family Chat" (if not exists) and acknowledges.
6.  **App** switches to Timeline view.

## Differentiators
-   **Zero-Config:** No need to edit config files to switch groups.
-   **Privacy:** Strict isolation ensures context doesn't bleed between groups.
