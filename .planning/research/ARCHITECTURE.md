# Architecture Research: Integration Strategy

## Current State Analysis
- **Frontend (`app.jsx`):**
  - View is determined by `activeApp` (room).
  - Messages are fetched by `room_id`.
  - `conversation_id` is generated/used inconsistently.
  - `ChatInterface` clears state on room switch.

- **Backend (`agent.js`):**
  - Listens to `public:messages`.
  - Fetches history: `.eq('room_id', roomId)`. **BUG/GAP:** Does not filter by conversation.
  - `RafiAgent` uses `conversationId` for auth keys, but relies on `agent.js` to route messages.

## Proposed Architecture

### 1. Data Model Changes
**Supabase Schema:**
```sql
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  room_id text not null,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add foreign key to messages (optional but recommended)
-- alter table messages add constraint fk_conversation foreign key (conversation_id) references conversations(id);
```

### 2. Frontend Flow
1.  **Load:** App checks URL for `thread=xyz`.
2.  **No Thread:** Create new UUID, set as `activeThread`. (Don't persist until first message?)
3.  **Thread Selected:** Fetch messages `where room_id = X AND conversation_id = Y`.
4.  **Sidebar:** Fetch `conversations where room_id = X`.

### 3. Agent Loop Changes (`agent.js`)
- **Input:** Receive message.
- **Context Fetch:**
  - `const conversationId = message.conversation_id;`
  - `supabase.from('messages').select('*').eq('conversation_id', conversationId)...`
  - **CRITICAL:** Fallback to `room_id` ONLY if `conversation_id` is null (legacy support), or force migration.

### 4. Build Order
1.  **Backend Logic:** Fix `agent.js` to respect `conversation_id` (it's safe to do this first, as current UI sends it sometimes or we can default it).
2.  **Frontend Logic:** Implement `useConversation` hook and URL parsing.
3.  **UI Components:** Build Sidebar and Header controls.
4.  **Data Persistence:** Create `conversations` table and hook up "Auto-save title".

## Integration Risks
- **Legacy Messages:** Old messages might have `null` conversation_id.
  - *Mitigation:* Treat `null` as a "General" thread for that room.
- **Race Conditions:** User sends message before `conversation` row is created.
  - *Mitigation:* `conversations` row creation can be lazy or optimistic.
