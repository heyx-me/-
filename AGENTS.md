# Agent Context & Memories (Heyx-Me)

- **Hybrid Architecture:** Agent router (`agent.js`) splits execution between the 'gemini' CLI (home/root rooms for full tool access) and the lightweight `@google/generative-ai` SDK (app rooms like 'rafi' for speed). Optimized latency by eliminating process startup for app-specific chats.
- **Slim Messaging Protocol:** Implemented a structured JSON protocol (`thinking`, `text`, `DATA`) with support for in-place updates and deletes via Supabase Realtime. Token stats are moved to metadata icons to keep the UI clean.
- **Context & Safety:** Agent sanitizes chat history by unwrapping protocol JSON to prevent hallucinations. Injects last 10 messages and (for Rafi) the latest financial data directly into prompt context for tool-free analysis. Enforces language consistency with the user's request.
- **Rafi Financial Advisor:** Refactored to an agent-based architecture. Features remote auth via Serveo tunnels, E2E encryption, and specialized prompt engineering for data-driven financial advice without local disk storage.
- **UI/UX Polishing:** Main shell (`app.jsx`) includes collapsible data cards, localized thinking spinners (English/Hebrew via `MutationObserver`), and robust state transitions to prevent empty message flashes.
- The user wants to add comprehensive testing (Unit, Integration, E2E) to the Heyx-Me project using Vitest and Playwright.
- **Developer Workflow:** A comprehensive `AGENT_WORKFLOW.md` guide is available for agents. It details the "No Build" architecture, development scripts (`npm start`, `npm run dev`), and logging mechanisms. Always refer to this guide for operational tasks.
