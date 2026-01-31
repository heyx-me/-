# Requirements

## v1 Requirements

### Infrastructure (INFRA)
- [x] **INFRA-01**: Vitest is configured for the project (supports ES modules, JSX).
- [x] **INFRA-02**: Playwright is installed and configured for local E2E testing.
- [x] **INFRA-03**: `npm test` script runs all unit tests.
- [x] **INFRA-04**: `npm run test:e2e` script runs Playwright tests.

### Unit Tests (UNIT)
- [x] **UNIT-01**: `rafi/utils/categorizer.js` has 90%+ coverage (transaction enrichment logic).
- [x] **UNIT-02**: `rafi/utils/storage.js` is tested (mocking local storage/fs).
- [x] **UNIT-03**: `rafi/utils/i18n.js` is tested (translation loading, language switching).
- [x] **UNIT-04**: `rafi/hooks/useBanking.jsx` hook logic is tested (state transitions, context usage).
- [x] **UNIT-05**: `rafi/components/Showcase.jsx` (and similar UI components) render correctly with mock data.

### Integration & E2E (INT)
- [x] **INT-01**: `RafiAgent` state machine transitions are verified (INIT -> STATUS -> DATA/ERROR).
- [x] **INT-02**: Agent handles invalid JSON/Messages gracefully without crashing.
- [x] **INT-03**: UI displays Login Modal when token is missing (E2E).
- [x] **INT-04**: UI renders Dashboard correctly when provided with mock financial data (E2E).
- [x] **INT-05**: Auth flow (Mocked) works: User enters creds -> Agent simulates scraping -> Token returned.

## v2 Requirements (Deferred)
- [ ] **DEFER-01**: Visual Regression Testing (Snapshot testing pixel-perfect UI).
- [ ] **DEFER-02**: Performance Testing (Load testing the Agent router).
- [ ] **DEFER-03**: CI/CD Pipeline integration (GitHub Actions).

## Out of Scope
- **OOS-01**: Testing live banking credentials/sites (Security/Fragility risk).
- **OOS-02**: Testing the `gemini` CLI binary itself (we assume it works).

## Traceability
| Requirement | Phase | Status |
|---|---|---|
| (Populated by Roadmap) | | |
