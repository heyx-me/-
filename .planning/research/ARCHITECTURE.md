# Architecture Research: Nanie Multi-tenancy

## System Overview

The architecture shifts from a **Singleton Agent** (One App = One WhatsApp Group) to a **Multi-Tenant Manager** (One App = Many WhatsApp Groups).

## Data Flow Changes

### Current (Singleton)
```
[UI] <-> [Agent] <-> [FileSystem (ella_cache.json)]
                 <-> [Baileys (Single JID)]
```

### Proposed (Multi-Tenant)
```
[UI A (Conv 1)] --+
                  |
[UI B (Conv 2)] --+--> [Agent Manager] <-> [Conversation Map]
                            |
                            +--> [Memory Manager]
                                    |-- [Group A Cache]
                                    |-- [Group B Cache]
                            |
                            +--> [Baileys] (Filters stream by JID)
```

## Key Components

### 1. Conversation Mapper (`agent.mjs`)
-   **Responsibility:** Maps `supa_conversation_id` (from request) to `whatsapp_group_id`.
-   **Storage:** `nanie/mappings.json`
-   **Methods:**
    -   `getGroupId(conversationId)`
    -   `setGroupId(conversationId, groupId)`

### 2. Memory Manager (`agent.mjs` refactor)
-   **Responsibility:** Load/Save timeline data per group.
-   **Storage:** `nanie/memory/${groupId}/timeline.json`
-   **Logic:**
    -   Instead of `this.timeline = []`, use `this.timelines = { [groupId]: [] }`.
    -   `updateTimeline()` loop now iterates over *active* groups (groups with at least one active conversation).

### 3. API Extensions
-   **Action:** `LIST_GROUPS`
    -   Input: None
    -   Output: List of Groups
-   **Action:** `SELECT_GROUP`
    -   Input: `groupId`
    -   Side Effect: Updates Conversation Map.

## Integration Points
-   **`handleMessage`**: Must now parse `conversation_id` from the incoming request (it is already passed).
-   **`updateTimeline`**: Must broadcast updates to *all* conversations listening to the updated group. (Supabase Realtime handles the transport, but the agent needs to know which "rooms" to publish to? actually, `agent.js` handles the routing. The Nanie agent just processes. The *Agent Router* needs to know where to send the response. If the Nanie agent is responding to a request, it replies to that conversation. If it's a *background update* (new event in WhatsApp), it needs to know which conversations are watching that group to send a push/event).

**Refined Push Logic:**
If a new event occurs in WhatsApp Group A:
1.  Agent finds all `conversation_ids` mapped to Group A.
2.  Agent sends a "Timeline Update" message to *each* of those conversations.

## Directory Structure
```
nanie/
  agent.mjs
  mappings.json (NEW)
  memory/ (NEW)
    12345@g.us.json
    67890@g.us.json
```
