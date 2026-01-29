# Project Structure

## Root Directory (`heyx-me/`)
-   `agent.js`: **Core**. The main agent router and orchestrator.
-   `server.js`: **Dev Server**. Serves the frontend and provides local Git/Shell APIs.
-   `app.jsx`: **Host UI**. Main application shell (React/Preact).
-   `apps.json`: **Registry**. Lists available sub-applications.
-   `package.json`: Dependencies for the host and shared utilities.

## Sub-Applications

### Rafi (`rafi/`) - Financial Advisor
-   `agent.js`: **Domain Logic**. Handles banking flows, scraping, and OTP.
-   `app.jsx`: **App UI**. React components for the banking dashboard.
-   `config.js`: App-specific configuration.
-   `components/`: Reusable UI components (Charts, Modals, Transaction Lists).
-   `contexts/`: React Contexts (Banking state, Theme).
-   `utils/`: Helpers (Categorization, i18n, Bank Definitions).
-   `locales/`: i18n translation files.

## Configuration
-   `.env`: Environment variables (Supabase keys, Gemini API key).
-   `.planning/`: GSD workflow artifacts.
-   `.gemini/`: Gemini CLI configuration and memory.
