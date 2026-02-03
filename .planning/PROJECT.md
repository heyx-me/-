# Project: Heyx-Me Test Suite Retrofit

## Vision
Transform the `heyx-me` and `rafi` codebase from zero test coverage to a robust, confidence-inspiring system. By implementing a multi-layered testing strategy (Unit, Integration, E2E), we will enable safe refactoring, prevent regressions in critical financial data flows, and ensure stability across the hybrid agent architecture.

## Core Value
**Confidence.**
- Confidence to refactor complex agent logic.
- Confidence that scraper updates won't break the UI.
- Confidence that the financial advisor agent behaves deterministically.

## Current Milestone: v0.6 Multi-Conversation Support

**Goal:** Enable management of multiple conversation threads and allow sharing contexts between users and agents.

**Target features:**
- UI for managing multiple conversation threads (create, list, switch, delete).
- Backend/Storage support for distinct conversation contexts.
- Mechanism to "share" conversations (context/history) between multiple human users or bots.

## Goals
1.  **Infrastructure:** Establish a modern testing harness using **Vitest** (Unit/Integration) and **Playwright** (E2E).
2.  **Unit Coverage:** High coverage (>80%) for pure logic in `utils/`, `hooks/`, and independent components.
3.  **Integration Stability:** Verify the `Agent <-> Supabase <-> Client` message loop works reliably.
4.  **E2E Critical Paths:** Automate verification of the "Login -> Scrape -> Dashboard" user journey (mocking bank backends).

## Scope

### In Scope
-   **Unit Tests:**
    -   `rafi/utils/` (categorizer, i18n, storage, bankDefinitions)
    -   `rafi/hooks/` (useBanking, useLocalStorageState)
    -   `rafi/components/` (Rendering logic for Charts, Lists)
-   **Integration Tests:**
    -   `rafi/agent.js` (RafiAgent state machine, message handling)
    -   `agent.js` (Root router logic, partial mocking of CLI)
-   **E2E Tests:**
    -   Full banking dashboard rendering.
    -   Mocked auth flows (happy path & error states).
    -   Responsive layout checks.

### Out of Scope
-   **Live Bank Scraping in CI:** We will *mock* the scraper responses. We cannot automate 2FA/OTP login against real banks in a test environment reliably or safely.
-   **Testing 3rd Party Libs:** We assume `israeli-bank-scrapers` works; we test our *usage* of it.

## Constraints
-   **Brownfield:** Tests must adapt to existing code structure; heavy refactoring should be driven by test needs but kept minimal initially.
-   **Local/Termux:** Tests must run efficiently in the local environment (no heavy cloud dependencies).

## Success Metrics
-   **Pipeline:** `npm test` runs all unit/integration tests and passes.
-   **Coverage:** 50%+ global coverage (ambitious start), 80%+ on `utils`.
-   **Safety:** Critical bug in `categorizer.js` or `agent.js` would be caught by a test.
