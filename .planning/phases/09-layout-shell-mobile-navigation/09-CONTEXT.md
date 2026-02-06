# Phase 9 Context: Layout Shell & Mobile Navigation

## Navigation & Routing
- **Strategy:** Use URL query parameters exclusively (e.g., `?v=list`, `?v=chat&id=123`).
- **Rationale:** GitHub Pages compatibility (no path rewrite support).
- **Transitions:** Mobile view must use CSS slide transitions between list and chat views.
- **Persistence:**
    - Refreshing the page while in a chat must restore that chat view (Deep Linking).
    - Scroll position in the chat list must be preserved when navigating back from a chat.

## Responsive Layout
- **Breakpoint:** 768px (Mobile < 768px <= Desktop).
- **Behavior:**
    - On Desktop: Fixed-width sidebar on the left, chat/detail view on the right. Sidebar is always visible.
    - On Mobile: Single-column view. Chat view takes over the screen when active.
    - Resizing: If a chat is active while resizing from desktop to mobile, the UI must stay on the chat view.
- **Empty State (Desktop):**
    - Display a generic, passive placeholder in the right-hand pane when no chat is selected.

## Header Architecture
- **Structure:** Split headers (Independent headers for Sidebar and Chat).
- **Sidebar Header:** Contains the "Main Menu" actions.
- **Chat Header:**
    - Contains the Chat Title and Avatar.
    - Includes a placeholder/toggle for "View App" (for Phase 11).
    - **Back Button:** Only visible on Mobile.
- **Mobile Behavior:** Headers must remain sticky at the top of the viewport.
