# Research Summary

## Key Findings

**1. Layout Strategy (Mobile-First):**
- **Mobile:** Single view logic.
    - View A: **Sidebar** (List of Chats).
    - View B: **Workspace** (Chat Interface).
    - **Preview:** An overlay/drawer that covers the Chat when active.
- **Desktop:** 2-Pane Shell.
    - **Left:** Sidebar (Chats/Contacts).
    - **Right:** Workspace.
    - **Preview:** Still an **Overlay** on top of the chat (user's explicit request), or perhaps a "Split" mode if space permits, but the primary requirement is "Overlay".

**2. "Apps as Contacts":**
- `apps.json` drives the "Contacts" list.
- Accessible via "New Chat" FAB/Button in the Sidebar.

**3. Preview Integration:**
- **Overlay Mode:** The Iframe sits *on top* of the chat (z-index).
- **Toggle:** A button in the Chat Header (e.g., "View App") toggles this overlay.
- **Transparency:** Maybe the overlay is semi-transparent or has a "peek" mode? Or standard full-cover with a close button.

## Plan Recommendations
1.  **Mobile First CSS:** Build for the single-column view first.
2.  **Sidebar as Root:** The "Home" is the Conversation List.
3.  **Chat as Child:** Clicking a thread pushes the Chat View (and URL state).
4.  **Preview as Modal/Overlay:** A layer above the Chat.