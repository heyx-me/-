# Phase 10 Research: Contacts & Sidebar

## 1. Database & Query Strategy
We need to find the "latest conversation" for a specific app (room_id).
- **Current Schema Check:**
    - `conversations` table likely has `room_id` (or similar link to the app).
    - *Assumption:* Based on `app.jsx`, `messages` have `room_id`. `conversations` might not.
    - *Investigation Needed:* Check if `conversations` table has a `room_id` column. If not, we might need to rely on the `messages` table or add it.
    - *Constraint:* `conversations` table usually has `owner_id`. We need to ensure we can link a conversation to an app ID (`rafi`, `nanie`, etc.).
    - *Correction:* `app.jsx` shows `messages` have `room_id`. But `conversations` are just titles and owners.
    - *Solution:* We should add `room_id` (or `app_id`) to the `conversations` table to make this lookup efficient. Relying on message joins is slow and complex.

## 2. Component Refactoring
- **`SidebarHeader`**: Will now host the `Tabs` (Chats | Contacts).
- **`ConversationList`**: Needs to accept a `mode` prop ('chats' | 'contacts').
    - **Chats Mode:** Existing behavior (grouped by date).
    - **Contacts Mode:** Render `apps.json` data.
- **`ChatHeader`**:
    - Needs a new "Action Menu" (3-dots icon).
    - Menu Item: "New Thread" -> Triggers creation of a new conversation for the *current* room/app.

## 3. State Management
- **Sidebar Tab State:** Simple `useState('chats')` in the Sidebar component.
- **Auto-Switching:** On mount, check `conversations.length`. If 0, set tab to 'contacts'.

## 4. Risks
- **Schema Mismatch:** If `conversations` doesn't track `room_id`, we can't easily implement "Jump to existing thread for this app".
    - *Mitigation:* I will inspect `check_db.js` or run a query to verify the schema. If missing, I will add a migration column `app_id` to `conversations`.

## 5. Implementation Steps
1.  **Verify/Update Schema:** Ensure `conversations` has `app_id`.
2.  **UI Components:** Build `SidebarTabs` and `ActionMenu`.
3.  **Logic:** Implement "Open latest or create new" logic.
