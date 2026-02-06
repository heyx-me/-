# Project: Heyx-Me Test Suite Retrofit

## Vision
Transform the `heyx-me` and `rafi` codebase from zero test coverage to a robust, confidence-inspiring system. By implementing a multi-layered testing strategy (Unit, Integration, E2E), we will enable safe refactoring, prevent regressions in critical financial data flows, and ensure stability across the hybrid agent architecture.

## Core Value
**Confidence.**
- Confidence to refactor complex agent logic.
- Confidence that scraper updates won't break the UI.
- Confidence that the financial advisor agent behaves deterministically.

## Current Milestone: v0.7 WhatsApp UI & Contacts

**Goal:** Redesign UI to a WhatsApp Desktop-like 2-pane layout and integrate Apps as "Contacts".

**Target features:**
- **Layout:** Responsive 2-pane interface (Sidebar List | Chat View) mimicking WhatsApp Desktop.
- **Contacts:** New view listing "Apps" (Rafi, Nanie) as startable contacts.
- **Navigation:** mechanism to switch between Chats and Contacts lists.
- **Rich Previews:** Enhanced conversation list items (Avatar, Last Message, Timestamp).

## Goals
1.  **UX Overhaul:** Move away from the simple mobile-first single view to a responsive desktop-class interface.
2.  **Discovery:** Make "Apps" discoverable via a Contacts list rather than just hidden endpoints.
3.  **Maintainability:** Refactor UI components to support the split-view architecture.

## Scope

### In Scope
-   **Layout:** CSS Grid/Flexbox implementation of the 2-pane layout.
-   **Sidebar:** Unified sidebar handling Conversation List and Contact List.
-   **Contacts:** Reading `apps.json` (or similar registry) to populate the Contacts list.
-   **Routing:** Updating URL handling to support `?view=contacts` vs `?thread=xyz` while maintaining deep links.

### Out of Scope
-   **Voice/Video Calls:** Visuals only (if any icons), no functionality.
-   **Status Updates:** "Stories" feature is out of scope.
-   **Settings:** Full settings page (unless needed for basic layout).

## Constraints
-   **Responsive:** Must still work on mobile (collapsing to single view).
-   **Existing Apps:** Must not break the iframe integration of Nanie/Rafi.

## Success Metrics
-   **Usability:** User can switch between chats without reloading the page.
-   **Discovery:** User can find and start a chat with "Nanie" from the Contacts list.
-   **Responsiveness:** UI adapts correctly to desktop vs mobile viewports.
