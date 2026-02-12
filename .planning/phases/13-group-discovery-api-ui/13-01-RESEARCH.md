# Phase 13 Research: Group Discovery

## 1. Upgrading SimpleStore
The current `SimpleStore` in `agent.mjs` is insufficient for sorting groups by activity because it doesn't update the chat timestamp (`t`) when new messages arrive.

**Required Changes:**
- Update `bind()` method to listen to `messages.upsert`.
- When a message arrives, update `this.chats[jid].t` with the message timestamp.
- Ensure `contacts.upsert` properly merges names so `getChatName` works reliably for groups.

## 2. Implementing LIST_GROUPS
We need to add a handler for `action: 'LIST_GROUPS'`.

**Logic:**
1.  **Source:** `this.store.chats`.
2.  **Filter:** `id.endsWith('@g.us')`.
3.  **Enrich:**
    - Name: `this.store.getChatName(id)`.
    - Last Activity: `this.chats[id].t` (after upgrade).
    - Participant Count: Currently not tracked in `SimpleStore`.
        - *Option:* We might need to call `sock.groupMetadata(id)` for *every* group. This is slow.
        - *Alternative:* Just show "Group" for now, or rely on `store.contacts` if it has participant info (unlikely for groups).
        - *Decision:* Skip participant count for the list to keep it fast. Use Name + Timestamp.
4.  **Sort:** Descending by `t`.
5.  **Response:**
    ```json
    {
      "type": "DATA",
      "data": {
        "groups": [
          { "id": "...", "name": "Family", "lastActivity": 17000... },
          ...
        ]
      }
    }
    ```

## 3. Frontend Implementation
- **Component:** `GroupSelectionList` in `nanie/app.jsx`.
- **State:** `showGroupSelector` (boolean).
- **Trigger:**
    - If `events.length === 0` AND we receive `GROUP_SELECTION_REQUIRED` error -> Set `showGroupSelector(true)`.
    - Note: The error comes as a `type: 'SYSTEM'` message.
- **Effect:**
    - On mount of `GroupSelectionList`, send `{ action: 'LIST_GROUPS' }`.
    - Listen for `type: 'DATA', data: { groups: [...] }`.
- **Render:**
    - List of groups.
    - Click -> (Phase 14: Send `SELECT_GROUP`). For Phase 13, just `console.log`.

## 4. Dependencies
- No new packages needed.
- `Baileys` is already there.

## 5. Security
- `LIST_GROUPS` returns *all* groups. This is acceptable for a personal agent (Single User).
