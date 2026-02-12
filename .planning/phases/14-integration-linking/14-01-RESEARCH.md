# Phase 14 Research: Integration & Linking

## 1. Backend Implementation (`agent.mjs`)
We need to handle `action: 'SELECT_GROUP'`.

**Logic:**
1.  **Extract:** `groupId` and `groupName` from payload.
2.  **Validate:** Ensure `groupId` exists in `store.getGroups()` (security check - must be a visible group).
3.  **Persist:** `this.mappingManager.setMapping(conversationId, { groupId, groupName, mappedAt: Date.now() })`.
4.  **Broadcast:** Call `this.updateGroupTimeline(groupId, conversationId)` immediately to send history.
5.  **Confirm:** Send `{ type: 'STATUS', text: 'LINKED' }`.

## 2. Frontend Implementation (`app.jsx`)
We need to implement `handleSelectGroup(groupId)`.

**Logic:**
1.  **Find Group:** Look up `groupName` from `availableGroups` using `groupId`.
2.  **Optimistic UI:** `setViewMode('chat')` immediately? Or wait for confirmation?
    - *Decision:* Wait for confirmation OR optimistic update.
    - Context said "Instant transition".
    - So: Set `viewMode('chat')`, `setLoading(true)`, send command.
3.  **Send Command:**
    ```javascript
    await supabase.from('messages').insert({
        // ...
        content: JSON.stringify({ 
            action: 'SELECT_GROUP', 
            groupId, 
            groupName 
        })
    });
    ```
4.  **Title Update:** The frontend handles the Supabase conversation title update directly to be faster/simpler?
    - *Decision:* Yes, frontend can do `supabase.from('conversations').update(...)`. It has the `owner_id` context.
    - Check current title first. If "Nanie Chat" or "New Chat", update to `groupName`.

## 3. Database Constraints
- No schema changes needed.
- `mappings.json` handles the relationship.

## 4. Edge Cases
- **Network Fail:** If `SELECT_GROUP` fails, user is stuck in "loading" chat.
    - *Mitigation:* `addToast` on error, revert `viewMode`.

## 5. Testing
- **Integration Test:** Verify sending `SELECT_GROUP` results in `DATA` broadcast and updated `mappings.json`.
