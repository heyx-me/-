# Roadmap: v0.7 WhatsApp UI & Contacts

## Phase 9: Layout Shell & Mobile Navigation
**Goal:** Establish the responsive "Master-Detail" shell and mobile routing.
- **reqs:** [UI-01], [UI-02], [NAV-01], [NAV-02], [NAV-03]
- **Success Criteria:**
    - Mobile: Starts on List. Clicking item -> Pushes URL -> Shows Chat. Back button -> Shows List.
    - Desktop: Shows List (Left) and Chat (Right) side-by-side.
    - "Preview" is temporarily hidden or just a placeholder overlay.

## Phase 10: Contacts & Sidebar
**Goal:** Implement the "New Chat" flow and Contacts list.
- **reqs:** [UI-04], [DATA-01]
- **Success Criteria:**
    - Sidebar has a header with "New Chat" button.
    - Clicking "New Chat" switches Sidebar view to "Contacts List".
    - Contacts List renders apps from `apps.json`.
    - Clicking an App in Contacts -> Creates/Opens thread -> Navigates to Chat.

## Phase 11: Preview Overlay & Polish
**Goal:** The "App on top" experience and final UI polish.
- **reqs:** [UI-03], [COMP-01], [COMP-03]
- **Success Criteria:**
    - Chat Header has "View App" toggle.
    - Toggle opens the Iframe Overlay (covering the chat).
    - Overlay has "Close/Minimize" button.
    - List Items show Avatar/Last Message styling (COMP-01).
