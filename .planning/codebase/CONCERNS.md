# Concerns & Technical Debt

## Critical
1.  **Security of Credentials**:
    -   While encrypted in transit, handling banking credentials in a Node.js process (even in memory) is high risk.
    -   Dependency on `serveo.net` implies trusting a third-party tunnel with traffic (mitigated by inner encryption, but metadata is exposed).
2.  **Scraper Fragility**:
    -   `israeli-bank-scrapers` relies on bank website HTML/API structure. Frequent breaking changes are expected.
    -   OTP flows are complex and prone to timeouts.

## Architectural
1.  **Hybrid Complexity**:
    -   Maintaining two agent runtime paths (CLI vs SDK) in `agent.js` increases complexity.
    -   Debugging cross-process issues (Agent -> CLI -> Shell) is difficult.
2.  **Polling/Realtime**:
    -   `agent.js` has a failsafe polling mechanism in addition to Realtime. This suggests past reliability issues with Supabase Realtime in this environment.

## Deployment
1.  **Local Dependency**:
    -   The system seems designed to run Locally (Termux/Desktop) due to the need to spawn `gemini` CLI and `chromium`. This makes cloud deployment difficult without containerization.
    -   Android/Termux environment constraints (memory, background process killing).

## Testing
1.  **Zero Coverage**:
    -   Lack of automated tests makes refactoring dangerous.
