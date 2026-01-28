# Performance Improvement Plan

The current delay in responding to simple messages like "Hi" is primarily due to the architectural overhead of spawning a new process for every interaction.

## Root Cause Analysis
1.  **Process Spawning Overhead:** `agent.js` uses `spawn('gemini', ...)` for every user message.
    *   **Cost:** 500ms - 2000ms per message.
    *   **Reason:** Node.js startup, module loading, authentication handshake, and CLI initialization run from scratch *every single time*.
2.  **Network Round-trips:** Supabase Realtime adds ~100-300ms latency, which is acceptable but adds to the total.
3.  **Debouncing:** The output stream in `agent.js` is debounced by 800ms, delaying the first visual token.

## Recommendations

### 1. Direct SDK Integration (Highest Impact)
Instead of spawning the `gemini` CLI, import and use the `@google/generative-ai` SDK directly within `agent.js`.
*   **Status:** The package is already in `package.json`.
*   **Benefit:** Zero process startup time. Instant response generation after network call.
*   **Implementation:** Refactor `spawnGemini` to call `model.generateContentStream` directly.

### 2. Persistent Agent Process
If the CLI wrapper provides essential functionality (like file system tools) that the raw SDK doesn't:
*   **Strategy:** Start the `gemini` process *once* in "interactive/chat mode" and pipe inputs/outputs via `stdin`/`stdout`.
*   **Benefit:** Eliminates repeated startup costs.

### 3. Adaptive Debouncing
*   **Problem:** `updateDB` waits 800ms before pushing the first update.
*   **Fix:** Remove the delay for the *first* chunk of data. Push the first token immediately to give the user instant feedback ("Time to First Token" metric).

### 4. Optimistic UI
*   **Done:** The new `ThinkingBubble` provides immediate visual feedback while the backend processes.

## Next Steps
Refactor `agent.js` to replace `spawn('gemini')` with:
```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// ... generateContentStream ...
```
This will reduce response time from ~3s to <1s.
