# Phase 12 Research: Backend Memory Isolation

## 1. Architecture Refactoring
The monolithic `ella_cache.json` and synchronous `loadCache`/`saveCache` functions in `agent.mjs` will be replaced by a modular system consisting of three key components:

### A. MappingManager
Responsible for resolving `conversation_id` (Supabase/Frontend) to `groupId` (WhatsApp).
*   **Storage:** `nanie/mappings.json`
*   **In-Memory:** `Map<string, MappingEntry>` for O(1) reads.
*   **Schema:**
    ```json
    {
      "conversation_id_uuid": {
        "groupId": "12036...@g.us",
        "groupName": "Family Group",
        "mappedAt": 1700000000000
      }
    }
    ```
*   **Methods:**
    *   `getGroup(conversationId)`: Returns `groupId` or `null`.
    *   `setMapping(conversationId, groupData)`: Updates map and persists to disk.
    *   `getConversationId(groupId)`: Reverse lookup (iterative or secondary index).

### B. StorageLayer (Per Group)
Responsible for atomic I/O operations for a specific group.
*   **Directory:** `nanie/memory/${groupId}/`
*   **Files:**
    *   `timeline.json`: Array of messages/events (Infinite retention).
    *   `metadata.json`: Object (Bot name, generic KV store).
*   **Concurrency:**
    *   Implemented via a `PromiseQueue` pattern per group.
    *   All writes (`appendEvent`, `updateMetadata`) are queued to ensure sequential execution.

### C. Agent Logic (`handleMessage`)
The entry point `handleMessage` will be updated to enforce the strict flow:
1.  **Extract `conversation_id`** from incoming message.
2.  **Check Mapping:** `const groupId = mappingManager.getGroup(conversation_id)`.
3.  **If Unmapped:**
    *   **REJECT** the message.
    *   Send reply: `{ type: 'SYSTEM', code: 'GROUP_SELECTION_REQUIRED' }`.
    *   *Do not* process text or call Gemini.
4.  **If Mapped:**
    *   Load context from `nanie/memory/${groupId}`.
    *   Inject `metadata` and `Group Name` into System Prompt.
    *   Process message normally.

## 2. Implementation Details

### In-Memory Queue Pattern
Since we don't want external dependencies like `p-queue` if avoidable, we can use a simple Promise chain:

```javascript
class GroupLock {
    constructor() {
        this.chain = Promise.resolve();
    }

    add(task) {
        this.chain = this.chain.then(() => task()).catch(err => console.error("Task failed", err));
        return this.chain;
    }
}

const groupLocks = new Map(); // groupId -> GroupLock
```

### File Structure Migration
*   **Action:** The existing `ella_cache.json` will be **deleted** upon the first successful run of the new version (or manually).
*   **Safety:** The new system will check if `nanie/memory/` exists, creating it if not.

### Error Protocol
To satisfy the requirement *"Backend rejects messages... with GROUP_SELECTION_REQUIRED"*, the payload sent back to Supabase will be:
```json
{
  "room_id": "nanie",
  "conversation_id": "...",
  "content": JSON.stringify({
    "type": "SYSTEM",
    "error": "GROUP_SELECTION_REQUIRED",
    "message": "This chat is not linked to a WhatsApp group."
  }),
  "sender_id": "system",
  "is_bot": true
}
```
*Note: The frontend in Phase 13 will listen for this specific `type: 'SYSTEM'` and `error` code to trigger the UI.*

## 3. Revised Agent Constructor
The `NanieAgent` class will need to initialize these managers:
```javascript
class NanieAgent {
    constructor(replyMethods) {
        this.mappingManager = new MappingManager();
        this.storage = new StorageManager(); // Manages locks and file I/O
        // ...
    }
    
    async init() {
        await this.mappingManager.load();
        // ...
    }
}
```

## 4. Testing Strategy
*   **Unit Tests:** Test `MappingManager` persistence and `StorageLayer` queueing in isolation.
*   **Integration:** Mock `replyMethods` and verify that an unmapped `handleMessage` call results in the correct error response.
