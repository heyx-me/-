# Phase 14 Context: Integration & Linking

## Goal
Implement the `SELECT_GROUP` action to finalized the mapping between a Supabase conversation and a WhatsApp group.

## Linking Logic
- **Action Name:** `SELECT_GROUP`
- **Payload:** `{ "groupId": "...", "groupName": "..." }`
- **Duplicate Handling:** **Allow Multi-mapping**. Multiple Supabase conversations can point to the same WhatsApp group (Option 1C). They will share the same underlying memory/timeline files.
- **Security:** No verification challenge; allow linking to any group the bot can see (Option 4).

## Data Synchronization
- **Title Update:** Upon linking, the backend (or frontend via Supabase call) should update the Conversation Title to match the WhatsApp Group Name.
    - **Logic:** Only update if the current title is generic ("New Chat", "Nanie Chat"). Do not overwrite custom titles (Option 2B).
- **Initial Sync:** Immediately after mapping, the backend must trigger a `DATA` broadcast with the group's current history so the UI populates instantly.

## User Experience
- **Transition:** **Instant**. As soon as the command is sent, the UI should optimistically switch to the "Connected" view (Option 3A).
- **Feedback:** Show a small toast notification: "Connected to [Group Name]".

## Backend Implementation
- **MappingManager:** Needs to support `setMapping(convId, { groupId, groupName, ... })`.
- **Agent Logic:** Handle `action: 'SELECT_GROUP'`:
    1.  Validate inputs.
    2.  Call `mappingManager.setMapping`.
    3.  Trigger `updateGroupTimeline` (which broadcasts `DATA`).
    4.  Reply with `STATUS: "LINKED"`.
