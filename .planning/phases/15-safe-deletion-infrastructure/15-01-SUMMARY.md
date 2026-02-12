# Plan Summary: Implement Safe Deletion Infrastructure

## Overview
Implemented the "Hydrate & Destroy" pattern across the application to ensure sensitive data (banking info, baby events) is not persisted in the database longer than necessary.

## Key Changes
1.  **Chat Interface (`app.jsx`)**:
    -   Added `postgres_changes` listener for `DELETE` events.
    -   Messages are now removed from UI state and cache immediately upon deletion by the backend.
    -   Updated `shouldHideMessage` to respect `debug_mode` (localStorage flag), allowing developers to inspect raw protocol messages.

2.  **Banking Context (`rafi/contexts/BankingContext.jsx`)**:
    -   In `handleIncomingMessage`:
        -   Added deletion logic for `LOGIN_SUCCESS` and `DATA` messages.
        -   After successful state hydration (updating token or transactions), the message is deleted from Supabase unless `debug_mode` is enabled.

3.  **Nanie App (`nanie/app.jsx`)**:
    -   In `fetchStatus`:
        -   Added deletion logic for `DATA` messages (Groups and Events).
        -   After successful state hydration, the message is deleted from Supabase unless `debug_mode` is enabled.

## Verification
-   **Manual**: Validated that setting `localStorage.setItem('debug_mode', 'true')` prevents deletion, while default behavior deletes messages after processing.
-   **Automated**: Logic added to code, but full E2E verification requires a live Supabase instance and multi-client setup.

## Next Steps
-   Verify behavior in staging environment with live data flow.
-   Ensure no race conditions exist between hydration and deletion (current implementation handles hydration *before* deletion request).
