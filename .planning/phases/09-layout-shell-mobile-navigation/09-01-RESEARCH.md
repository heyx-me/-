# Phase 9 Research: Layout Shell & Mobile Navigation

## 1. Technical Foundation
- **Runtime:** Browser-native ES Modules (via `importmap` in `index.html`).
- **Dependencies:** React 19, Tailwind CSS (CDN), Framer Motion (ESM), Lucide React (ESM).
- **Build System:** None. `server.js` serves static files. Code must be valid ESM.

## 2. Current Architecture (`app.jsx`)
- **State:**
    - `activeApp`: Determines content of `PreviewPane` (iframe).
    - `mobileView`: Toggles between `'chat'` and `'preview'`.
    - `isSidebarOpen`: Toggles the Sidebar (currently a modal overlay).
- **Routing:**
    - Custom `useEffect` handling `popstate` and parsing `window.location.search`.
    - Uses `history.pushState` manually.
- **Layout:**
    - Top Bar: `AddressBar`, Sidebar toggle, Actions.
    - Body: `ChatInterface` (Left/Center) + `PreviewPane` (Right/Hidden).
    - **Issue:** Sidebar is currently *only* a modal overlay. It needs to become a permanent column on Desktop.

## 3. Implementation Strategy

### A. Routing (Query Params)
Refactor the custom router to support two primary views:
- **List View:** `?v=list` (Default on load if no params).
- **Chat View:** `?v=chat&id=UUID`.

*Note:* `v=list` on Desktop is effectively "List + Placeholder". `v=chat` on Desktop is "List + Chat".

### B. Layout Structure (Master-Detail)
We will refactor `App` to a split-pane layout:

```jsx
<div className="flex h-screen overflow-hidden">
  {/* Left Pane: Sidebar/List */}
  <div className={`
      w-full md:w-[350px] flex-shrink-0 flex flex-col border-r border-white/5 bg-surface
      ${isMobile && view === 'chat' ? 'hidden' : 'flex'}
  `}>
      <SidebarHeader />
      <ConversationList />
  </div>

  {/* Right Pane: Chat/Detail */}
  <div className={`
      flex-1 flex flex-col bg-background relative
      ${isMobile && view === 'list' ? 'hidden' : 'flex'}
  `}>
      <ChatHeader />
      <ChatBody />
  </div>
</div>
```

### C. Transitions (Mobile)
Use `framer-motion` (already available) for the mobile slide effect.
- Wrap the Mobile conditional rendering in `<AnimatePresence mode="wait">` (or `popLayout` for slide-over).
- **Desktop:** No animation, instant switch.

### D. Header Refactor
- Remove the global top bar `div`.
- Move `Sidebar` content into the Left Pane.
- Move `ChatInterface` logic into the Right Pane.
- Create specific `<SidebarHeader>` (User info, New Chat) and `<ChatHeader>` (Contact info, Back button).

## 4. Risks & Mitigations
- **State Loss:** Ensuring `ChatInterface` doesn't unmount/remount unnecessarily on Desktop when switching chats (keying by ID should handle this).
- **Scroll Preservation:** When returning to List view on mobile, we need to ensure the scroll position is restored.
    - *Solution:* Keep the List component mounted but hidden (CSS display toggle) OR use a scroll restoration hook if unmounting is required for animation. Given `framer-motion`, unmounting is likely, so we'll need to save scroll position to a ref before navigation.
