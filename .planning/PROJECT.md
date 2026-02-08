# Project: Heyx-Me Test Suite Retrofit

## Vision
Transform the `heyx-me` and `rafi` codebase from zero test coverage to a robust, confidence-inspiring system. By implementing a multi-layered testing strategy (Unit, Integration, E2E), we will enable safe refactoring, prevent regressions in critical financial data flows, and ensure stability across the hybrid agent architecture.

## Core Value
**Confidence.**
- Confidence to refactor complex agent logic.
- Confidence that scraper updates won't break the UI.
- Confidence that the financial advisor agent behaves deterministically.

## Current Milestone: v0.8 Nanie Multi-tenancy

**Goal:** Enable multi-tenancy for Nanie agents by isolating filesystem memory per conversation and implementing WhatsApp group selection.

**Target features:**
- **Memory Isolation:** Refactor Nanie to store/load filesystem state based on `conversation_id`.
- **Group Discovery:** Expose WhatsApp groups list via the agent API (using Baileys).
- **Onboarding UI:** "Select Group" interface in the Nanie app preview for new chats.
- **Linkage:** Associate the selected WhatsApp group with the current `heyx-me` conversation.

## Current State (v0.7)
**Shipped:** February 2026
**Key Features:**
- **Responsive Shell:** WhatsApp-style master-detail layout (desktop) / stacked (mobile).
- **Contacts:** Tabbed sidebar for starting chats with Apps (Rafi, Nanie).
- **Smart Jump:** Intelligent resuming of conversations.
- **Dual View:** Toggle between Chat and App (Iframe) modes.
