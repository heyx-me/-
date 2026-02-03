# Stack Research: Multi-Conversation & Sharing

## Stack Decisions

### 1. State Management (Frontend)
**Decision:** React Context + `useLocalStorage` (Enhanced)
**Rationale:**
- The app currently uses `useState` and custom `useLocalStorageState`.
- Introducing Redux/Zustand is overkill for this specific addition.
- We will lift the "current conversation" state to a context (`ConversationContext`) that wraps the main layout.

### 2. Database (Supabase)
**Decision:** Add `conversations` table (Logical)
**Rationale:**
- We need to store metadata: `title`, `created_at`, `updated_at`.
- Relying on `distinct(conversation_id)` from the `messages` table is performantly expensive as the table grows.
- **New Table:** `conversations`
  - `id` (uuid, pk)
  - `room_id` (text, fk/index) - which "app" this belongs to
  - `title` (text)
  - `created_at`
  - `last_message_at`
- **Existing Table:** `messages`
  - Ensure `conversation_id` is indexed.

### 3. Routing (URL)
**Decision:** Query Parameters
**Rationale:**
- Current app uses `?appId` or `?chat`.
- New format: `?app=rafi&thread=<uuid>`.
- Allows deep linking and sharing easily.

### 4. ID Generation
**Decision:** `uuid` (client-side)
**Rationale:**
- Consistent with existing usage in `agent.js`.
- `crypto.randomUUID()` available in modern browsers (Termux WebView is Chromium based).

## Integration Points
- **Frontend:** `app.jsx` needs a "Sidebar" component for thread switching.
- **Backend:** `agent.js` needs to respect `conversation_id` when fetching history.

## What NOT to add
- **Real-time Collaboration Libs (Yjs, Automerge):**
  - **Why:** Supabase Realtime is sufficient for "turn-based" chat. We are not doing Google Docs style simultaneous editing.
- **Complex Router (React Router):**
  - **Why:** The app uses a simple `activeApp` state. Rewriting to React Router is a huge refactor. Stick to the custom router.
