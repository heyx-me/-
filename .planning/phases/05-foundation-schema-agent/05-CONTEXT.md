# Phase 5 Context: Foundation & Schema

## Strategy: Clean Slate
- **Legacy Data:** Discard. Existing messages in the database are not valuable.
- **Migration:** No complex migration scripts. We will truncate/clear the `messages` table.
- **Constraint:** `conversation_id` will be added as a **NOT NULL** column (foreign key to new `conversations` table).
- **Code:** Application logic does not need to handle `NULL` conversation IDs.

## Database Schema Decisions

### Conversations Table
- **Fields:** `id` (UUID), `title` (Text), `owner_id` (UUID), `created_at`.
- **Visibility:** Private only (no public flag needed).
- **Ownership:** Explicit `owner_id` column.
  - **Permissions:** Owner has full control (delete, manage). Non-owners are simple members.

### Conversation Members Table
- **Support:** Multi-user immediately (1-to-N relationship).
- **Fields:** `conversation_id`, `user_id`, `joined_at`.
- *(Note: Role column can be added later if needed, since owner is defined on the parent table).*

## Agent Behavior & Scope

### Isolation
- **Default:** Agent only sees messages from the `currentConversationId` by default.
- **Enforcement:** Application-level filtering (Simple `WHERE` clause) is sufficient for MVP. RLS is not required to block read access yet.

### Cross-Thread Context
- **User Memory:** Global. Facts learned about the user in Thread A are valid/accessible in Thread B.
- **Cross-Access:** The architecture must **allow** the agent to read other threads via explicit tools (e.g., "Summarize chat X").
  - *Implication:* Do not implement strict cryptographic or row-level blocking that would permanently blind the agent to other user threads.

### System Prompt
- **Scope:** Global. Same system prompt applies to all conversations.
