# Quick Task 008: Analyze Timezone Bug & Draft Milestone Bullets

## Analysis of Timezone Bug
- **Symptom:** User reported "21:30 extracted vs 19:30 written in message".
- **Environment:** Israel (UTC+2/UTC+3).
- **Technical Detail:** 19:30 Local = 17:30 UTC.
    - If model extracted "21:30", it likely returned `19:30Z` (UTC).
    - `19:30Z` displayed in Israel is `21:30`.
- **Root Cause:** The model returned the *explicit* local time string ("19:30") as a UTC ISO string (`...T19:30:00Z`), ignoring the prompt instruction to preserve the offset. The current fallback logic in `agent.mjs` (lines 135-156) failed to catch this because either `explicitTime` was missing from the JSON or the regex fallback didn't match the specific text format used.
- **Fix Required:** Strengthen prompt, improve regex fallback, and force offset correction when model returns Z for what looks like local time.

## Proposed Milestone Bullets (v0.9 Addition)

### 1. Fix Critical Timezone Extraction Bug (Nanie)
*   **Problem:** Events with explicit times (e.g., "19:30") are being extracted as UTC (19:30Z -> 21:30 Local), resulting in a +2/3 hour offset error.
*   **Action Items:**
    *   **Enhance Regex Fallback:** Improve `nanie/agent.mjs` to catch more time formats (e.g., "HH:MM", "H:MM", "HHmm") when the model fails to populate `explicitTime`.
    *   **Strict Prompting:** Update the system prompt to explicitly forbid `Z` (UTC) suffixes for extracted events, requiring `+02:00` (or current offset) instead.
    *   **Heuristic Correction:** Implement a "Local-as-UTC" detector: If `(UTC_Hour == Local_Message_Hour)`, automatically apply the timezone offset correction.
    *   **Regression Testing:** Add a specific test case in `nanie/extract_events.test.js` simulating the "19:30Z" response payload.

### 2. Smooth Onboarding & Real-time Sync
*   **Problem:** User reported needing to refresh the page after creating a thread/selecting a group to see updates.
*   **Action Items:**
    *   **Hot-Reload State:** Ensure `ConversationContext` or `NanieContext` immediately re-subscribes to Supabase channels upon group selection.
    *   **Optimistic UI:** clear the event list immediately upon group switch to prevent showing stale data while fetching.

### 3. Logging & Monitoring
*   **Action Items:**
    *   Add structured logging for "Timezone Correction Triggered" events to track how often the fallback logic is used.
