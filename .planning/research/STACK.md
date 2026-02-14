# Stack Research: Chat Clutter Reduction

## Overview
No major new libraries are required. The focus is on leveraging existing Supabase capabilities and React state management patterns to handle ephemeral messages.

## Recommended Stack
- **Database:** Supabase (PostgreSQL)
    - Use `messages` table.
    - Potential schema change: Add `metadata` column or `is_hidden` flag if "Soft Delete" strategy is chosen.
    - *Decision:* Stick to Hard Delete for "clutter reduction" per user request, but ensure robust client-side hydration first.
- **Frontend:** React + Supabase Realtime
    - **Optimistic UI:** Use `useRef` or local state to track "processing" messages.
    - **Lifecycle:** `useEffect` to trigger deletion after successful storage update.

## Integration Points
- **Nanie App:** `nanie/app.jsx` (currently handles `DATA` hydration).
- **Rafi App:** `rafi/contexts/BankingContext.jsx` (handles financial data).
- **Agent:** `agent.js` (currently handles persistence).

## What NOT to add
- **Complex State Libraries:** Redux/Zustand is overkill. Context API + LocalStorage is sufficient.
- **New Backend Services:** The existing Node.js agent can handle the deletion logic.