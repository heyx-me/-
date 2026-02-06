# Phase 10 Context: Contacts & Sidebar

## Sidebar Navigation
- **Structure:** Replace the "New Chat" button with a Tab-based navigation at the top of the sidebar.
- **Tabs:** "Chats" and "Contacts".
- **Initial State:** 
    - If the user has existing conversations, default to the "Chats" tab.
    - If the "Chats" list is empty, default to the "Contacts" tab.
- **Empty State UI:** Show a generic placeholder image centered in the list area when no items are available in the selected tab.

## Contacts (Apps) List
- **Data Source:** Use `apps.json`.
- **Layout:** Flat list (no categories).
- **UI:** Standard contact style (App Icon + App Name).
- **Navigation:**
    - Clicking a Contact -> Open the **most recent** existing conversation with that specific app.
    - If no conversation exists for that app -> Create a new one and navigate to it immediately.

## Thread Management
- **Multiple Threads:** Users can have multiple distinct conversations with the same app.
- **New Thread Action:**
    - Explicitly starting a *new* conversation with an app (when one already exists) is handled via an **Action Menu in the Chat Header**.
    - This menu will include a "New Conversation" option.

## Routing
- **URL Strategy:** Maintain query-param consistency. Switching tabs in the sidebar does not necessarily need a URL change unless it helps mobile "Back" behavior (TBD during implementation).
