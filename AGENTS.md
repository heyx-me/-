# Heyx Hub Coding Standards & Decisions

## 1. Development Workflow
- **Commit Mandate:** NEVER stage or commit changes without an explicit "Directive" from the user. Always propose a strategy ("Inquiry") and wait for approval first.
- **"No Build" Architecture:** Adhere to the established pattern of avoiding complex build steps. Use JSX transpilation in the Service Worker and standard Node.js execution for the agent and server.
- **Validation:** Always verify changes by running tests or performing manual checks before requesting final approval. Use the `logs/` directory to monitor Agent-Server communication.

## 2. Messaging & Protocol
- **Structured JSON:** All agent communication must use a structured JSON protocol (e.g., `type: "text"`, `type: "thinking"`, `type: "DATA"`).
- **Supabase Realtime:** Use Supabase as the primary channel for Agent-UI communication. Support in-place updates (for streaming/thinking) and deletions.
- **Ephemeral Messages:** 
    - Mark control, system, or data-transfer messages with `ephemeral: true`.
    - **Mandatory Cleanup:** The receiver (Agent or UI) MUST delete ephemeral messages from the `messages` table immediately after they are successfully processed/consumed.
    - **Filtering:** Use `shouldHideMessage` logic in the UI to filter protocol/ephemeral clutter from the human chat history.

## 3. AI & Prompting
- **Context Sanitization:** Always unwrap/sanitize protocol JSON when building chat history context for the LLM to prevent it from hallucinating or being confused by JSON markers.
- **Tool-Free Analysis:** For specific skills, inject relevant state (e.g., the last 10 messages or recent data snapshots) directly into the prompt context to enable fast analysis without redundant tool calls.
- **Language Consistency:** Always respond in the language used by the user in the most recent prompt.

## 4. Security & Architecture
- **Internal Coordination:** Use the authenticated Supabase database rather than exposing local server endpoints (HTTP) for Agent-UI coordination (e.g., key exchange, registration).
- **Sensitive Data Handling:** For skills dealing with sensitive credentials or records, use E2E encryption or ephemeral remote tunnels (e.g., Serveo) to ensure data is never stored unencrypted in the persistent database.
- **Hybrid Routing:** Optimize latency by routing between a full CLI process (for tool-heavy root tasks) and lightweight SDKs (e.g., `@google/genai`) for app-specific interactions.
