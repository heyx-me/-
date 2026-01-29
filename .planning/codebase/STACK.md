# Tech Stack

## Core
- **Runtime**: Node.js (ES Modules)
- **Languages**: JavaScript
- **Package Manager**: npm

## Frontend
- **Framework**: React (Rafi), Vanilla JS (Host)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Internationalization**: i18next, react-i18next
- **Bundling**: None visible (likely native ES modules or on-the-fly transpilation via server/browser)

## Backend
- **Server**: Express.js
- **Database Client**: @supabase/supabase-js
- **Auth/Tunneling**: Localtunnel, Serveo.net (via SSH)

## AI & Agents
- **LLM**: Google Generative AI (Gemini 2.0 Flash)
- **CLI**: `gemini` (system-level agent)
- **Orchestration**: Custom `agent.js` router

## Domain Specific
- **Finance**: `israeli-bank-scrapers` (Puppeteer/Playwright wrapper)
- **Browser Automation**: Chromium (via Termux/System packages)
