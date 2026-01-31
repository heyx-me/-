# Quick Task 003: Adjust Nanie App to Agent System

**Goal:** Integrate the standalone 'nanie' WhatsApp bot into the centralized agent architecture.

## Tasks

### 1. Create `nanie/agent.js`
Create a `NanieAgent` class.
- **Reference:** `rafi/agent.js`
- **Functionality:**
    - Implement `handleMessage(message)` interface.
    - Read `nanie/ella_cache.json` to fetch the latest baby events.
    - Format this data as context for the agent.
- **Output:** `nanie/agent.js`

### 2. Update `agent.js` (Root)
Integrate the new agent.
- Import `NanieAgent`.
- Initialize `nanieAgent`.
- In `handleMessage`, add logic to route `nanie` room messages to `nanieAgent`.

### 3. Update `apps.json`
Register the app in the UI.
- Add an entry for "Nanie" (or "Ella" if that's the displayed name? Let's stick to "Nanie" or "Ella Tracker").
- Ensure `room: 'nanie'` matches the routing logic.
