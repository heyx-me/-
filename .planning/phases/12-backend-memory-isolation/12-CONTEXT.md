# Phase 12 Context: Backend Memory Isolation

## Goal
Refactor the Nanie agent (`agent.mjs`) to support multi-tenant memory. Instead of a single global cache, the agent will isolate data by WhatsApp Group ID and manage mappings between Conversation IDs and Groups.

## Data Storage & Migration
- **Legacy Data:** The existing `ella_cache.json` will be **deleted** (starting fresh with this phase).
- **Migration Trigger:** A **manual script** will be used for any migration or setup tasks (Option 3C).
- **Missing Files:** If a mapping exists but the memory file is missing, the system will **auto-heal** by treating it as an empty history (Option 4A).

## Directory Structure
- **Location:** `nanie/memory/${groupId}/`
- **Files:**
    - `timeline.json`: Full message history (Option 3A: grows indefinitely).
    - `metadata.json`: Generic metadata editable by the bot (Option 2.1). Use for event extraction and persistence.

## Concurrency & Performance
- **Write Strategy:** **In-memory queue per Group ID**. All I/O operations for a specific group are serialized to prevent corruption (Option 2.2A).
- **Lookup:** `mappings.json` will be loaded into an **in-memory Map** at startup for O(1) lookups during message processing (Option 3.2A).

## Mapping Logic (`mappings.json`)
- **Schema:** Rich objects (Option 3.1B).
    ```json
    {
      "conversation_id": {
        "groupId": "...",
        "groupName": "...",
        "mappedAt": 1234567890
      }
    }
    ```
- **Unmapped Conversations:** **Strict Blocking**. Messages to conversations without a mapping in `mappings.json` must be rejected with `GROUP_SELECTION_REQUIRED` (Option 1.2A).
- **Orphan Handling:** If a mapping is deleted, the directory `nanie/memory/${groupId}` is **retained** (archived) rather than deleted (Option 3.3A).
- **Reverse Lookup:** The system must support finding a `conversation_id` given a `groupId` (Option 3.4).

## Agent Context Awareness
- **System Instruction:** Prepend "You are participating in the WhatsApp group '[Group Name]'" to the base prompt (Option 4.1A).
- **Participant List:** **Ignore**. The bot does not receive the list of group participants in its context (Option 4.2B).
- **Self-Identity:** Use the **global bot name** from the configuration (Option 4.3A).
- **Metadata Access:** The **entire contents** of `metadata.json` are injected into the prompt context for every message (Option 4.4A).
