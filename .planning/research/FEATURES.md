# Features Research: Multi-Conversation UI/UX

## Feature Categories

### 1. Conversation Management (Table Stakes)
- **New Chat:** Button to start a fresh context. Clears current view, generates new UUID.
- **History List:** Sidebar showing past conversations.
  - Sorted by `last_message_at` (desc).
  - Grouped by headers (Today, Yesterday, Previous 7 Days).
- **Auto-Titling:**
  - **Behavior:** The *first* user message or a generated summary becomes the title.
  - **Implementation:** Simple heuristic (first 30 chars) for v1. AI summary for v2.
- **Delete Chat:** Remove from list (soft delete or hard delete).

### 2. Sharing & Context (Differentiator)
- **Deep Linking:**
  - URL contains the thread ID.
  - Opening the link loads that specific history.
- **"Forking" (Advanced/Optional):**
  - Starting a new thread *from* a specific message in an old thread. (Likely out of scope for v1 but good to keep in mind).

### 3. Agent Awareness
- **Context Isolation:**
  - Agent must ONLY see messages from the current thread.
  - **Critical:** Prevents "hallucination" where Agent references a bank account from Thread A while user is asking about Thread B.

## Anti-Features (Do Not Build)
- **Folder/Tag Organization:** Too complex for v1.
- **Multi-Agent Chat:** Multiple bots in one thread. (Architecture supports it, but UI shouldn't expose complex controls for it yet).
- **Search across all threads:** Database intensive, defer to v2.

## Complexity Assessment
- **Sidebar UI:** Low (standard CSS/Component).
- **Deep Linking:** Medium (Need to handle race conditions where app loads before auth/data).
- **Context Isolation:** Low (Backend query change), but High Impact if missed.
