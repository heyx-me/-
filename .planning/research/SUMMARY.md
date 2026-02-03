# Research Summary: Multi-Conversation Support

## Key Findings

**1. Architecture & Stack**
- **State:** Lift state to `ConversationContext` in React. Use `uuid` for IDs.
- **DB:** New `conversations` table is required for metadata (titles, lists).
- **Agent:** Must update `agent.js` to strictly filter history by `conversation_id`.

**2. Features (Table Stakes)**
- Sidebar for history (collapsible).
- "New Chat" button.
- Auto-titling (first few words).
- Deep linking (`?thread=UUID`).

**3. Critical Pitfalls**
- **Ghost Threads:** Don't persist empty threads.
- **Context Bleed:** Ensure UI discards responses from previous thread selections.
- **Legacy Data:** Handle existing messages with `null` conversation IDs (group into "Legacy" thread).

**4. Build Strategy**
- **Phase 1: Logic & Schema.** Update Agent to respect IDs. Create DB table.
- **Phase 2: Frontend State.** Implement URL routing and Context.
- **Phase 3: UI.** Sidebar and Management.

## Recommendations
- **Research First:** Validated. The complexity of "Ghost Threads" and "Context Bleeding" warrants careful state design.
- **Schema:** We need to provide a SQL migration script or manual instruction for the user to create the `conversations` table.
