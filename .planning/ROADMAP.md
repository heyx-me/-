# Roadmap

## Proposed Roadmap

**4 phases** | **14 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | **Infrastructure Setup** | Establish testing harness and run first trivial tests | INFRA-01, INFRA-02, INFRA-03, INFRA-04 | `npm test` passes, Playwright launches ✓ |
| 2 | **Core Logic (Unit)** | Secure the foundational utilities | UNIT-01, UNIT-02, UNIT-03 | `rafi/utils/` reached >80% coverage |
| 3 | **State & Components** | Verify React state and Agent logic | UNIT-04, UNIT-05, INT-01, INT-02 | Agent state machine verified, Components render in isolation |
| 4 | **End-to-End Flows** | Validate the full user journey | INT-03, INT-04, INT-05 | Full Mocked Login -> Dashboard flow passes in Playwright |

### Phase Details

**Phase 1: Infrastructure Setup**
Goal: Establish testing harness and run first trivial tests.
Requirements:
- INFRA-01: Vitest config
- INFRA-02: Playwright config
- INFRA-03: `npm test` script
- INFRA-04: `npm run test:e2e` script
Success criteria:
1. Vitest runs a "hello world" test.
2. Playwright opens the local server and takes a screenshot.
3. CI scripts are added to `package.json`.

**Phase 2: Core Logic (Unit)**
Goal: Secure the foundational utilities.
Requirements:
- UNIT-01: categorizer.js coverage
- UNIT-02: storage.js coverage
- UNIT-03: i18n.js coverage
Success criteria:
1. Categorizer correctly labels known transaction types.
2. Storage utils handle read/write/error cases.
3. i18n falls back to default language correctly.

**Phase 3: State & Components**
Goal: Verify React state and Agent logic.
Requirements:
- UNIT-04: useBanking hook
- UNIT-05: Showcase/UI components
- INT-01: Agent state machine
- INT-02: Agent error handling
Success criteria:
1. `useBanking` handles login state transitions correctly.
2. `RafiAgent` processes INIT/FETCH/OTP messages correctly in isolation.
3. UI components render without crashing given mock props.

**Phase 4: End-to-End Flows**
Goal: Validate the full user journey.
Requirements:
- INT-03: Login Modal appearance
- INT-04: Dashboard rendering
- INT-05: Mocked auth flow
Success criteria:
1. Playwright test completes a full login flow using mock agent responses.
2. Dashboard shows correct data after login.
3. No console errors during E2E run.
