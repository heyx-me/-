# Phase 7 Context: UI Management

## UI Structure
- **Sidebar Layout:** Slide-out drawer (Drawer) on both Desktop and Mobile. Focus remains on the active chat/app.
- **Toggle:** A clear button (likely top-left) to toggle the conversation list.

## Thread Lifecycle
- **Auto-titling:** Agent-generated.
  - *Trigger:* After ~2-3 user messages.
  - *Mechanism:* The backend agent (Alex) will use a tool or a silent internal prompt to update the `conversations.title` column.
- **Sorting:** Grouped by date categories: "Today", "Yesterday", "Previous 7 Days", etc. Newest at the top.

## Identity & Management
- **User ID:** Displayed at the bottom of the sidebar.
- **New Chat:** A prominent button at the top of the sidebar.
  - *Action:* Sets `thread=new` in URL and clears active chat state (Lazy Creation mode).
- **Cleanup:** "Ghost" threads (New Chat opened but never sent) should not appear in the sidebar list.

## Requirements Covered
- MGMT-01: Sidebar List
- MGMT-02: New Chat
- MGMT-03: Auto-titling
- MGMT-06: Sorting
- TECH-03: Lazy Persistence
