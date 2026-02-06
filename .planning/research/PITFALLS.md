# Pitfalls Research

## Common Layout Issues

### 1. Scroll Chaining
- **Issue:** Scrolling the chat list accidentally scrolls the body or chat history.
- **Prevention:** Use `overscroll-behavior: contain` and fixed heights (`h-screen`) with `overflow-y-auto` on specific pane containers.

### 2. Mobile Navigation Back-Button
- **Issue:** On mobile, if the user goes List -> Chat, pressing "Back" in the browser might exit the app instead of going back to the List.
- **Prevention:** Use `history.pushState` when entering a chat on mobile, so the browser "Back" button works as "Up to List".

### 3. "Preview" Space on Small Desktops
- **Issue:** 3 columns (List | Chat | Preview) is too wide for 1024px or 1280px screens.
- **Prevention:**
    - **Responsive breakpoints:**
        - `< md`: Mobile (1 pane).
        - `md - xl`: 2 Panes (List | Chat+Preview). *Wait, Chat+Preview is tight.*
        - **Alternative:** Collapsible Sidebar. Or "Preview" is a toggleable drawer on the right (like WhatsApp "Contact Info").
        - **Decision:** The "Preview" (Iframe) is critical for this app. We should allow collapsing the Sidebar to give more room to Chat/Preview, or collapse the Chat to focus on Preview.

### 4. Search State
- **Issue:** Searching in the sidebar filters the list. Switching views (Chats -> Contacts) might lose the search term or apply it wrongly.
- **Prevention:** Clear search when switching views, or maintain separate search states.

### 5. App Iframe Reloads
- **Issue:** If the `PreviewPane` is unmounted when switching chats, the iframe reloads (losing state).
- **Prevention:** Keep the active app's iframe mounted if possible, or accept that switching threads switches the app context (which implies reload). *Actually*, since `activeApp` changes, reload is expected/desired.