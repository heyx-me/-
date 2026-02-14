# Plan: Context Injection Strategy

## Goal
Implement a robust Context Injection system that decouples AI intelligence from chat history. The Agent will receive a structured `CURRENT_STATE` in its system prompt—derived directly from backend files—enabling it to answer "How long ago did she eat?" instantly without searching old messages.

## Task List

### 1. Context Managers Refactor
- [ ] **Nanie Context Manager (`nanie/managers.mjs`):**
    -   Extend `getMetadata` (or create `getContextSnapshot`) to return derived fields:
        -   `last_event_summary`: "Feeding (Right) 120ml"
        -   `time_since_last_event`: "2h 15m"
        -   `is_sleeping`: Boolean (based on last event type).
- [ ] **Rafi Context Manager (`rafi/utils/context.js` - New):**
    -   Create a helper to read `user_data` files and generate a lightweight snapshot:
        -   `connected_accounts`: ["Hapoalim (1234)", "Leumi (5678)"]
        -   `last_sync`: Timestamp
        -   *Note:* Do NOT inject balances in the snapshot (privacy/token cost). Use tools for that.

### 2. Tool Definitions
- [ ] **Nanie Tools:**
    -   `get_recent_events(limit: number, type?: string)`: Fetches raw event logs.
    -   `get_daily_summary(date: string)`: Aggregates stats for a specific day.
- [ ] **Rafi Tools:**
    -   `get_account_balance(account_id?: string)`: Fetches current balance.
    -   `search_transactions(query: string, date_range: string)`: Searches the JSON store.

### 3. Agent Integration (`agent.js`)
- [ ] **Prompt Construction:**
    -   Modify `handleMessage` to call the respective Context Manager *before* generating the prompt.
    -   Inject the `CURRENT_STATE` JSON block at the very top of the system instruction.
- [ ] **Tool Binding:**
    -   Register the new tools with the Gemini SDK configuration.
    -   Implement the tool execution logic (routing the call to the App's context manager).

### 4. Verification
- [ ] **"Amnesia" Test:**
    1.  Clear chat history (or start new).
    2.  Ask: "When did she last eat?"
    3.  Verify: Agent answers correctly using `CURRENT_STATE` or `get_recent_events` tool, despite 0 messages in history.
- [ ] **Latency Check:** Ensure the overhead of calculating `CURRENT_STATE` is negligible (<100ms).

## Implementation Steps
1.  **Nanie Manager**: Implement `getContextSnapshot` with time logic.
2.  **Rafi Manager**: Implement `getContextSnapshot` for banking.
3.  **Agent Logic**: Wire up the injection and tool registration.
4.  **Test**: Verify strictly without history.
