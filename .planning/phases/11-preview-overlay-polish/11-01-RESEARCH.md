# Phase 11 Research: Preview Overlay & Polish

## 1. Data Query: Last Message
We need the last message for the list preview.
- **Option A (Subquery):** `conversations(*, messages(content, created_at))`
    - *Limit:* Supabase JS `.limit(1)` on foreign tables works but might grab the *first* (oldest) unless ordered.
    - *Syntax:* `messages(content, created_at).order(created_at, { ascending: false }).limit(1)`
- **Option B (RPC/View):** Create a database view `conversations_preview` that pre-calculates this.
    - *Pros:* Cleaner JS code, faster reads.
    - *Cons:* Requires SQL migration.
- **Decision:** Try Option A first. It's flexible. If performance drags, we suggest a view later.

## 2. Layout Architecture
Current `ChatInterface` has an `inputOnly` prop.
- **Current Behavior:** Hides message list, overlays `overlayMessages` (toasts), makes background transparent.
- **Requirement:**
    - **Header:** Visible.
    - **Iframe:** Visible (New component or moved).
    - **Input:** Visible (Pinned).
- **Refactor:**
    - We need a `PreviewMode` component that wraps:
        - `PreviewPane` (Iframe)
        - `ChatOverlay` (Toasts + Input)
    - **Structure:**
      ```jsx
      <div className="flex flex-col h-full relative">
         <ChatHeader />
         <div className="flex-1 relative overflow-hidden">
             <PreviewPane /> {/* Iframe */}
             <ChatToasts />  {/* Absolute Overlay */}
         </div>
         <ChatInput />       {/* Static Bottom */}
      </div>
      ```

## 3. CSS/Overflow Fixes
- **Root:** `h-screen w-screen overflow-hidden fixed`.
- **Flex Children:** `min-h-0` is critical for nested flex scrolling.
- **Mobile Input:** Ensure `pb-safe` (safe area) if needed, or standard bottom padding.

## 4. Implementation Steps
1.  **Context Update:** Modify `fetchConversations` to include `messages`.
2.  **Component Split:** Break `ChatInterface` into `MessageList`, `ChatInput`, and `ChatToasts`.
3.  **View Composition:** Create `ChatView` (List + Input) and `AppView` (Iframe + Toasts + Input).
4.  **Toggle Logic:** State `mode: 'chat' | 'app'` inside `App` (or `ChatContainer`).
