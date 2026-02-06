# Phase 11 Context: Preview Overlay & Polish

## View Modes (Right Pane)
- **Concept:** The Right Pane (Desktop) / Main View (Mobile) has two modes:
    1.  **Chat Mode:** Standard message history + input.
    2.  **App Mode (Preview):** The Iframe running the app + Chat Input bar at bottom.

## Navigation & Toggle
- **Toggle Location:** Chat Header.
- **Icon:** Eye (View App) / MessageSquare (View Chat).
- **Behavior:**
    - Switching modes replaces the main content area (Slide transition).
    - **Mobile & Desktop:** Same behavior. "App Mode" replaces "Chat Mode".

## App Mode Experience
- **Layout:**
    - Top: Chat Header (Sticky).
    - Middle: Iframe (Flex grow).
    - Bottom: Chat Input Bar (Static/Pinned).
- **Incoming Messages:**
    - Display as **floating toast bubbles** (overlay) on top of the iframe when they arrive.
    - Matches previous "Overlay" UX.

## Layout & Polish
- **Constraints:** Strict `100vh` container. No body scrolling.
- **Input Visibility:** Ensure Chat Input is always visible/pinned in both modes.
- **List Styling:** Fetch and display the *actual* last message content and timestamp in the `ConversationList`.

## Data Requirements
- **Last Message:** Update `fetchConversations` query to join/select the latest message for each conversation.
