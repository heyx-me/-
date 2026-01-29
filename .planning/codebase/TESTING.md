# Testing

## Current State
-   **Automated Tests**: Minimal to None. `npm test` echoes "Error: no test specified".
-   **Manual Testing**: Primary method. Developers run `server.js` and `agent.js` and interact via the UI.
-   **Files**:
    -   `controller-test.html`: Likely a standalone manual test for UI controllers.
    -   `rafi/test_server.js`: Likely a mock server for developing the Rafi frontend without the full scraper backend.

## Gaps
-   No Unit Tests for logic (e.g., categorizer, parsers).
-   No Integration Tests for the Agent-Supabase loop.
-   No E2E tests for the Banking flows (difficult due to OTP/Captchas).

## Recommended Strategy
-   Add Jest/Vitest for `utils/` logic.
-   Add Playwright for UI testing (mocking the Agent responses).
