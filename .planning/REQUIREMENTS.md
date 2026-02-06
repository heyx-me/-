# Requirements: v0.7 WhatsApp UI & Contacts

## UI/UX (Mobile First)
- [ ] **UI-01**: "Home" view is the **Conversation List** (Sidebar).
- [ ] **UI-02**: Clicking a conversation opens the **Chat View** (fullscreen on mobile, right pane on desktop).
- [ ] **UI-03**: **Preview Overlay**: A mechanism to toggle the App Iframe *over* the chat view.
    - Must have a "Close/Minimize" button to return to chat.
    - Must preserve state (don't reload iframe on toggle if possible).
- [ ] **UI-04**: **Contacts View**: A list of available Apps (Rafi, Nanie) + Users.
    - Accessible via "New Chat" button.
    - Clicking an App opens a chat with it.

## Navigation & State
- [ ] **NAV-01**: URL routing supports `?view=chats` (default), `?view=contacts`, `?thread=id`.
- [ ] **NAV-02**: Mobile Back Button handling:
    - Overlay -> Chat
    - Chat -> List
- [ ] **NAV-03**: Desktop Layout:
    - Sidebar always visible (if width > 768px).
    - Chat View occupies remaining space.
    - Preview Overlay covers the Chat View (or 50% split?). *Requirement says "on top of just a chat", implying overlay.*

## Components
- [ ] **COMP-01**: `ChatList` component (Avatar, Name, Last Message, Time).
- [ ] **COMP-02**: `ContactList` component (Section headers: "Apps", "Contacts").
- [ ] **COMP-03**: `AppHeader` (Context-aware: Home vs Chat).

## Data
- [ ] **DATA-01**: `apps.json` integration into Contact List.

## Future / Out of Scope
- [ ] Real-time "Typing..." indicators.
- [ ] Media attachments.
- [ ] Voice calls.