# Phase 6 Context: Identity & State

## Identity Strategy
- **Persistence:** LocalStorage only (`heyx_user_id`).
- **Scope:** Device-bound. No cross-device recovery or password login for this version.
- **Generation:** Auto-generate UUIDv4 on first visit if missing.

## Routing & URL
- **Structure:** Query parameter: `?thread=<UUID>`.
- **New Chat:** `?thread=new` (or just empty root `/?`).
  - **Behavior:** **Lazy Creation**.
  - The UI shows an empty chat.
  - The `conversations` row is ONLY created when the user sends the first message.
  - *Constraint:* The Agent/Backend must handle the "first message" scenario by receiving a `null` conversation_id (or a special flag) and returning the new ID, OR the frontend creates it optimisticly right before sending.
  - *Decision:* Frontend creates optimistic ID? No, safer to let Frontend create the row via Supabase client *just before* sending the message, then redirect URL from `new` -> `UUID`.

## Session Restoration
- **Root Visit:** If user visits `/`, check `localStorage` for `last_active_thread`.
- **Redirect:** If valid, auto-redirect to `?thread=<last_UUID>`.
- **Fallback:** If invalid or missing, show New Chat state.
