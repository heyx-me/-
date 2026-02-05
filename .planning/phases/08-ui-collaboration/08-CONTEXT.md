# Phase 8 Context: UI Collaboration

## Sharing Strategy
- **Mechanism:** Shareable Link (Invite Link).
- **Flow:**
  1. Owner clicks "Share" in the sidebar/header.
  2. App generates a link: `heyx.me/?thread=<UUID>&invite=true` (or relies on open access via RLS for now if we skip tokens). *Decision:* Simplest for MVP is just sharing the URL `/?thread=<UUID>`.
  3. **Access Control:**
     - If a user visits a thread they are NOT a member of:
     - Show a "Join Conversation?" prompt.
     - On "Yes", insert row into `conversation_members`.
     - *Constraint:* This technically makes all threads "public" to anyone with the UUID. For MVP v0.6, this is acceptable.

## UI Elements
- **Header:** Display a list of participants (avatars/initials) in the top bar.
- **Sidebar:** Add a "Share" button to the active thread item (or top header) that copies the current URL to clipboard.
- **Join Screen:** A simple modal or overlay when visiting a link for a new thread.

## Permissions
- **Owner:** Can delete the thread.
- **Members:** Can chat and view history.
- **Simplification:** No complex role management UI for this version.

## Requirements Covered
- SHR-06: Permission Management (Implicit via Join)
- SHR-07: Shared Access (View shared threads)
- SHR-02: Deep Linking (Load logic)
- MGMT-04: Edit Title (Optional/Implicit)
- MGMT-05: Delete Thread (Already done, verify Owner-only check)
