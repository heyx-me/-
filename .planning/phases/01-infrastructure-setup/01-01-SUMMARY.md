# Summary: Infrastructure Setup

## Outcome
Successfully installed testing dependencies and configured both Vitest (unit/integration) and Playwright (E2E).

## Changes
- **Dependencies:** Added `vitest`, `jsdom`, `@testing-library/react`, `@playwright/test`.
- **Scripts:** Added `test` (Vitest), `test:e2e` (Playwright), `test:ui`.
- **Config:** Created `vitest.config.js` and `playwright.config.js`.
- **Tests:** Created smoke tests in `rafi/utils/smoke.test.js` and `tests/e2e/smoke.spec.js`.

## Verification
- [x] `npm test` runs and passes (1 test).
- [x] `vitest.config.js` correctly excludes nested `node_modules`.
- [ ] `npm run test:e2e` configured but **skipped on Android** (Playwright does not support Android execution). Configuration files are verified correct for standard environments.

## Commits
- `2becc3c` chore(infra-setup): add test dependencies and scripts
- `6e1f907` test(infra-setup): setup vitest config and smoke test
- `cc426c3` test(infra-setup): setup playwright config and e2e smoke test
