# Testing

## Current State
-   **Automated Tests**: Comprehensive suite implemented using Vitest (Unit/Integration) and Playwright (E2E).
-   **Unit & Integration Tests**: 24 tests passing across `rafi/`, `rafi/utils/`, and `rafi/contexts/`.
-   **E2E Tests**: Playwright configuration in place with initial specs in `tests/e2e/`. Note: Playwright does not support Android/Termux environments and must be run in CI or desktop environments.
-   **Manual Testing**: Still used for UI/UX verification.

## Files
-   `vitest.config.js`: Configuration for Vitest.
-   `playwright.config.js`: Configuration for Playwright.
-   `rafi/agent.test.js`: Integration tests for RafiAgent.
-   `rafi/BankingContext.test.jsx`: Tests for the React Banking Context.
-   `rafi/utils/*.test.js`: Unit tests for categorization, storage, and i18n logic.
-   `tests/e2e/*.spec.js`: E2E test specifications.

## Gaps
-   `nanie/` and `alex/` apps currently lack automated tests.
-   Integration tests for the main `agent.js` router.
-   E2E tests for complex banking flows (OTP/Captchas) require manual intervention or sophisticated mocking.

## Recommended Strategy
-   Expand Vitest coverage to `nanie/` and `alex/` apps.
-   Implement integration tests for the `agent.js` message routing logic.
-   Use mocked responses for Playwright E2E tests to bypass banking scrapers in UI testing.
