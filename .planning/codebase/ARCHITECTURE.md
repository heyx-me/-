# Architecture

## Hybrid Agent Architecture

The system employs a hybrid architecture to balance power and speed:

1.  **Agent Router (`agent.js`)**:
    -   Acts as the central nervous system.
    -   Listens to Supabase `messages` table (Realtime + Polling).
    -   **Routing Logic**:
        -   **Root/Home**: Spawns `gemini` CLI process. This gives the agent full access to the local shell, filesystem, and tools.
        -   **App Rooms (e.g., `rafi`)**: Uses Gemini SDK + Specialized Agent Logic (`RafiAgent`). This is lightweight, faster, and safer (restricted toolset).

2.  **Rafi Agent (Financial Advisor)**:
    -   **State**: Manages banking sessions and scraper jobs in memory.
    -   **Security**: Implements an E2E encrypted flow for credential handover.
        1.  Agent spawns SSH tunnel (Serveo).
        2.  Agent sends Public Key + Auth URL to User.
        3.  User submits credentials encrypted with Public Key via Auth URL.
        4.  Agent decrypts with Private Key and initiates Scraper.
    -   **Scraping**: Runs `israeli-bank-scrapers` in headless Chromium.

3.  **Frontend (UI)**:
    -   **Chat-Centric**: The primary interface is a chat window.
    -   **Generative UI**: The agent sends structured JSON (`type: 'DATA'`), which the React frontend renders into rich components (Charts, Tables).
    -   **Host vs. App**: `heyx-me` acts as a host shell. Apps like `rafi` are loaded within this context, likely via dynamic imports or iframe-like isolation (though codebase suggests direct module composition).

## Data Flow
`User Input` -> `Supabase (Insert)` -> `agent.js (Subscription)` -> `LLM/Tool` -> `Supabase (Update/Insert)` -> `UI (Realtime Render)`
