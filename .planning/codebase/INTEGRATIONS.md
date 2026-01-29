# Integrations

## Primary Services

### Supabase
- **Purpose**: Primary database and message bus.
- **Usage**:
  - `messages` table stores chat history and tool outputs.
  - Realtime subscriptions used for instant agent responses.
  - Auth (implied, though custom auth flow exists for banking).

### Google Gemini
- **Purpose**: Intelligence layer.
- **Usage**:
  - **SDK**: Used for fast, conversational responses in sub-apps (`rafi`).
  - **CLI**: Spawning `gemini` process for system-level control in `home`/`root` rooms.

### Israeli Bank Scrapers
- **Purpose**: Fetching financial data.
- **Usage**:
  - Wraps Puppeteer to scrape banks (Hapoalim, Leumi, etc.).
  - Handles OTP flows and data normalization.

### Serveo.net / Localtunnel
- **Purpose**: Remote Access / Auth Callback.
- **Usage**:
  - Exposes local Express server to public internet.
  - Used during the OAuth/Credential exchange flow to securely pass encrypted credentials from the client to the local agent.

## APIs
- **Git**: Local git operations via `server.js` API endpoints (`/api/git/*`).
