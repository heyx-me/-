# Roadmap: v0.8 Nanie Multi-tenancy

## Phase 12: Backend Memory Isolation
**Goal:** Refactor `agent.mjs` to support multi-tenant memory and directory-based storage.
- **reqs:** [MEM-01], [MEM-02], [MULTI-01], [MULTI-02], [MULTI-03]
- **Success Criteria:**
    - Agent creates `nanie/memory/${groupId}/timeline.json` instead of `ella_cache.json`.
    - `mappings.json` tracks `conversation_id` <-> `groupId`.
    - Backend rejects messages to unmapped conversations with `GROUP_SELECTION_REQUIRED`.

## Phase 13: Group Discovery API & UI
**Goal:** Expose WhatsApp groups to the frontend and implement the selection interface.
- **reqs:** [GRP-01], [GRP-02]
- **Success Criteria:**
    - `LIST_GROUPS` action returns real group data from Baileys.
    - Nanie App (Preview Pane) shows a "Select Group" list when unmapped.
    - List displays Group Name and Participant Count.

## Phase 14: Integration & Linking
**Goal:** Connect the UI selection to the backend mapping and polish the experience.
- **reqs:** [GRP-03], [GRP-04], [MEM-03]
- **Success Criteria:**
    - Selecting a group sends `SELECT_GROUP` and updates `mappings.json`.
    - Conversation title updates to the Group Name automatically.
    - Timeline updates are correctly broadcast *only* to linked conversations.
