# Features Research

## WhatsApp Desktop Layout Breakdown

### 1. Two-Pane Layout (Master-Detail)
- **Left Pane (Sidebar):** ~30-35% width. Persistent on desktop.
    - **Header:** User Avatar, Status, New Chat, Menu.
    - **Search:** "Search or start new chat".
    - **List:** Scrollable list of threads.
- **Right Pane (Chat):** Remaining width.
    - **Header:** Contact Info (Avatar, Name, "Last seen"), Actions (Search, Menu).
    - **Body:** Message history (bubbles).
    - **Footer:** Input area, Attachments, Mic.

### 2. Contacts / "New Chat"
- In WhatsApp, clicking "New Chat" slides out a "Contacts" drawer (or replaces the chat list).
- **Our Feature:** "Apps as Contacts".
    - A view listing `Rafi`, `Nanie`, `Alex` (from `apps.json`).
    - Clicking one -> Creates/Navigates to a thread with that App.

### 3. "Preview" Integration (The "On Top" Requirement)
- The user wants to view the **App Preview** (iframe) "on top of just a chat".
- **Interpretation:**
    - Standard WhatsApp: Chat is the *only* content.
    - Heyx-Me: Chat + App Iframe.
    - **Solution:** The "Right Pane" must be a split view or tabbed view.
    - **Approach:**
        - **Desktop:** The "Right Pane" is actually *two* columns? Or the Iframe is a "Drawer" that slides in?
        - **Refined Approach:** Keep the current "Chat | Preview" split in the *Right Pane* area.
        - **Result:** **Sidebar (List)** || **Chat Interface** || **App Preview**. (3 columns).
        - **Or:** **Sidebar** || **Chat Interface (with toggle for Preview)**.
        - Given "WhatsApp like layout", strictly 2 panes is best. Maybe the "Preview" is a button that expands/overlays?
        - *Decision:* We will support a **3-column layout** on large screens (Sidebar | Chat | Preview) to satisfy "view a conversation preview". On smaller desktops, maybe Chat | Preview is the main view and Sidebar toggles?
        - Let's stick to **Sidebar (Left)** and **Workspace (Right)**. The Workspace contains the Chat and the Preview.

## Feature Categories

### Table Stakes (Must Have)
- **Responsive 2-Pane Layout:** Persistent Sidebar on Desktop.
- **Unified Sidebar:** Houses both "Chats" and "Contacts" (switchable).
- **Contact List:** Displays Apps (`apps.json`) with icons.
- **Chat Header:** Shows current chat/app info.
- **Mobile Navigation:** Smooth transition between List and Chat.

### Differentiators (Heyx-Me Specific)
- **App Preview Pane:** The iframe integration (not present in WhatsApp).
- **"Apps as Contacts":** Treating software agents as first-class contacts.
- **Git Integration:** Keeping the git controls accessible (maybe in the "Settings" or "Menu").

### Anti-Features (Out of Scope)
- **Status/Stories:** No "Stories" tab.
- **Calls:** No Voice/Video call functionality.
- **Broadcasting:** No broadcast lists.