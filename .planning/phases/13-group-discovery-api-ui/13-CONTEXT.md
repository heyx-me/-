# Phase 13 Context: Group Discovery API & UI

## Goal
Implement the frontend interface and backend API to allow users to discover and select which WhatsApp group should be linked to their Nanie conversation.

## User Interface (UX)
- **Integration Style:** **Inline Placeholder**. When a group is required, the event timeline area will be replaced by the group selection list, while maintaining the app header and context (Option 3.1B).
- **List Style:** Vertical list with **Group Names and Icons/Placeholders** (Option 1.1C).
- **Interactions:**
    - **One-click selection:** Clicking a group immediately triggers the linking process (Option 1.3A).
    - **No Confirmation:** Skip confirmation modals to keep the flow fast.
- **Empty State:** Simple "No groups found" text with a "Refresh" button (Option 3.2B).
- **Transitions:** Use **faded transitions** matching the existing Nanie "WavyText" style (Option 3.3B).

## Discovery Logic
- **Filtering:** Show **ALL** groups the bot is currently participating in (Option 2.1A).
- **Sorting:** Sort by **Most Recently Active** (Option 2.2A).
- **Exclusions:** Include everything, including broadcast/announcement groups if present (Option 2.3B).
- **Trigger:** **Auto-fetch** the list as soon as the selection UI is mounted (Option 4.1A).
- **Manual Override:** No manual ID entry; rely entirely on automatic discovery (Option 4.2B).

## Protocol & Backend
- **Action Name:** `LIST_GROUPS` (Option 4.4).
- **Method:** Poll the Baileys `chats` store for immediate response (Option 4.3A).
- **Bot Identity:** Do not display the bot's own number/identity on the setup screen (Option 3.4No).

## Data Schema (LIST_GROUPS response)
```json
{
  "type": "DATA",
  "data": {
    "groups": [
      { "id": "12036...@g.us", "name": "Family", "lastActivity": 1700000000 },
      ...
    ]
  }
}
```
