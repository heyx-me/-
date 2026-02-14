# Phase 17: Context Injection Strategy

## Goal
Decouple AI intelligence from Chat History by injecting a structured **Memory Object** into the System Prompt. This ensures the agent remains "aware" of the app state even after protocol messages are deleted (Phase 16).

## Core Decisions

### 1. Pure Tool-Based Fetching (With Context Header)
- **Primary Mechanism:** The agent will primarily use **Tools** to fetch detailed data (e.g., `get_transactions`, `get_event_logs`) to keep the initial prompt clean and token-efficient.
- **Context Header:** A lightweight `CURRENT_STATE` JSON block will be injected at the top of the System Prompt. This is *not* the full history, but a snapshot of critical pointers (e.g., "Active Group: Family", "User ID: 123").

### 2. Memory Object Structure
The System Prompt will include a dynamic `CURRENT_STATE` block updated every turn.

**Structure:**
```json
CURRENT_STATE: {
  "timestamp": "2023-10-27T10:00:00Z", // Current server time
  "context": {
     // App-specific lightweight context
     "active_group_id": "12036...",
     "last_sync_status": "SUCCESS"
  },
  "derived": {
     // Pre-calculated values to help the LLM
     "time_since_last_feed": "2 hours 15 minutes",
     "is_sleeping": false
  }
}
```

### 3. Isolation & Source of Truth
- **Strict Isolation:** `home` agent sees nothing. `rafi` sees only banking files. `nanie` sees only Baileys store.
- **Source of Truth:** The agent reads directly from the backend files (`.json`, `user_data`), *never* from the Supabase message table for state.

### 4. Derived Data for Nanie
- **Problem:** LLMs struggle with time math (calculating "2 hours ago" from timestamps).
- **Solution:** The `Context` object MUST include pre-calculated **derived fields** for time-sensitive data:
    - `last_feed_relative`: "2 hours ago"
    - `next_expected_feed`: "in 1 hour" (based on simple logic)
    - `current_status`: "Awake" vs "Sleeping"
