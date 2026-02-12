# Project: Heyx-Me Test Suite Retrofit

## Vision
Transform the `heyx-me` and `rafi` codebase from zero test coverage to a robust, confidence-inspiring system. By implementing a multi-layered testing strategy (Unit, Integration, E2E), we will enable safe refactoring, prevent regressions in critical financial data flows, and ensure stability across the hybrid agent architecture.

## Core Value
**Confidence.**
- Confidence to refactor complex agent logic.
- Confidence that scraper updates won't break the UI.
- Confidence that the financial advisor agent behaves deterministically.

## Current State (v0.8)
**Shipped:** February 2026
**Key Features:**
- **Nanie Multi-tenancy:** Isolated memory/timeline per conversation (no more global cache).
- **Group Linking:** WhatsApp groups can be mapped 1:1 to Heyx-me conversations.
- **Onboarding:** "Select Group" UI for unmapped chats.
- **Robust Sync:** Resync capability for missing history.

<details>
<summary>Past Milestones</summary>

### v0.7 (Feb 2026)
- **Responsive Shell:** WhatsApp-style master-detail layout.
- **Contacts:** Tabbed sidebar.
- **Smart Jump:** Intelligent resuming.
- **Dual View:** Chat/App toggle.

</details>

## Current Milestone: v0.9 Chat Clutter Reduction

**Goal:** Improve UX by making system/control messages ephemeral and keeping the chat history focused on human-readable content.

**Target features:**
- **Ephemeral Control Messages:** `GET_STATUS` and other command messages are removed after successful processing.
- **Clean Data Handoff:** `DATA` payloads are removed from the chat stream once successfully hydrated into local storage.
- **History Sanitization:** Ensure historical logs don't clutter the UI with raw JSON protocols.

## Active Requirements
*(Run `/gsd:plan-milestone` to populate)*