# Pitfalls Research: Common Mistakes

## 1. The "Ghost Thread" Problem
- **Issue:** User opens app -> New Thread ID generated. User closes app. User opens app -> New Thread ID generated.
- **Result:** Database filled with thousands of empty conversation IDs or threads with 0 messages.
- **Prevention:**
  - Do NOT create a `conversations` row until the first message is sent.
  - UI should hold an ephemeral "New Chat" state.

## 2. Context Bleeding
- **Issue:** User switches from Thread A to Thread B rapidly. Network request for Thread A finishes *after* Thread B loads, overwriting messages.
- **Prevention:**
  - **AbortController:** Cancel pending fetch on thread switch.
  - **ID Check:** In `setMessages`, check if `fetchedThreadId === currentThreadId`.

## 3. URL State Sync
- **Issue:** User clicks "New Chat", URL updates, browser "Back" button breaks.
- **Prevention:**
  - Use `history.pushState` for new threads.
  - Handle `popstate` event correctly (already handled in `app.jsx` for apps, need to extend to threads).

## 4. Mobile Layout Cramping
- **Issue:** Adding a sidebar to a mobile layout that already has a chat view and a preview pane (on desktop).
- **Prevention:**
  - **Mobile:** Hamburger menu / Drawer for thread list.
  - **Desktop:** Collapsible sidebar.

## 5. Agent "Amnesia"
- **Issue:** Agent doesn't see the immediate previous message because of replication lag or query ordering.
- **Prevention:**
  - Ensure `agent.js` uses consistent sorting (`created_at desc`) and includes the trigger message in its "prompt construction" if not found in DB yet (usually passed directly).
