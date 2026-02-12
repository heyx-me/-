# Roadmap: v0.9 Chat Clutter Reduction

## Phase 15: Safe Deletion Infrastructure [COMPLETE]
**Goal:** Implement the "Hydrate & Destroy" pattern and Debug Mode to ensure data safety before deleting messages.
- **reqs:** [DATA-01], [DATA-02], [DATA-03]
- **Success Criteria:**
    - `debug_mode` toggle works (prevents deletion when true).
    - `DATA` messages persist in DB but disappear from UI (via delete action) ONLY after successful Store update.
    - Hydration errors prevent deletion (safety check).

## Phase 16: Control Message Cleanup
**Goal:** Clean up the command stream (GET_STATUS, etc.) to reduce noise.
- **reqs:** [SYS-01], [SYS-02]
- **Success Criteria:**
    - "User" command messages are removed after agent acknowledgement.
    - Historical view filters out "zombie" command messages.
    - UX is smoother (actions feel like UI interactions, not chat).

## Phase 17: Context Injection Strategy
**Goal:** Decouple AI intelligence from Chat History to allow aggressive message pruning.
- **reqs:** [CTX-01], [CTX-02]
- **Success Criteria:**
    - Agent can answer "What is the status?" correctly even with an empty chat history.
    - System prompt includes structured state from Nanie/Rafi memory files.
    - "Amnesia" regression test passes.
