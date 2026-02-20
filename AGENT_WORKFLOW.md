# Agent Workflow & Development Guide

**Welcome to the Heyx Hub Agent Development Environment.**

This project uses a specialized "No Build" architecture where `sw.js` (Service Worker) handles client-side JSX transpilation. The backend consists of a standard Express server (`server.js`) and an Agent Loop (`agent.js`).

## 🚀 Quick Start

### Interactive Mode (Development)
To start the environment and see logs in your terminal:

```bash
npm start
```

### Background Mode (Production)
To keep the agent running persistently in the background (even after you disconnect):

```bash
nohup npm start > /dev/null 2>&1 &
```

This command will:
1.  **Clean Up:** Kill any previous zombie processes.
2.  **Check:** Run syntax verification on core files.
3.  **Launch:** Start `server.js` (Port 3000) and `agent.js` in parallel.
4.  **Log:** Stream color-coded logs to your terminal AND save them to `logs/`.

---

## 🛠 Developer Tools

We have consolidated all debugging scripts into a single CLI.

**List available tools:**
```bash
npm run dev
```

**Run a specific tool:**
```bash
npm run dev <tool_name>
# Example:
npm run dev check_db
npm run dev fix_access
```

**Common Tools:**
*   `check_db`: Verify Supabase connection and schema.
*   `check_conv`: Inspect conversation states.
*   `fix_access`: Repair permission issues.
*   `send_heartbeat`: Test agent liveliness.

---

## ✅ Pre-flight Checks

Before committing or pushing, run the syntax checker:

```bash
npm run check
```

This uses `esbuild` to verify syntax without producing a bundle.

---

## 📂 Architecture Overview

### 1. No-Build Frontend
*   **File:** `app.jsx` (and `rafi/app.jsx`, `nanie/app.jsx`)
*   **Mechanism:** `sw.js` intercepts requests for `.jsx` files, transpiles them using Babel (in-browser), and serves JS.
*   **Implication:** You can edit `app.jsx` and refresh the browser immediately. No Webpack/Vite waiting time.

### 2. Agent Process (`agent.js`)
*   **Role:** Long-running process that polls/listens to Supabase for messages.
*   **Logging:** Output is critical. Use `npm start` to see it clearly.

### 3. Server (`server.js`)
*   **Role:** Serves static files, handles Git API for the agent, and proxies some requests.
*   **Logs:** Exposed via `npm start` or `/logs` endpoint (see below).

---

## 📊 Viewing Logs

1.  **Terminal:** `npm start` streams them live.
2.  **Web UI:** Navigate to `http://localhost:3000/logs` to view the current session's log file.
3.  **Files:** Check `logs/` directory for historical logs.

---

## 🤖 For AI Agents

*   **Context:** Always check `GEMINI.md` for project memory.
*   **Tools:** Use `scripts/dev.js` to explore the system state.
*   **Safety:** The `npm start` script manages PIDs to prevent orphan processes. Always use it instead of running `node server.js` manually.
