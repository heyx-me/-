# Phase 12 Context: Simplify Main Page

## Goal
Transform the Sidebar into a unified "App List" that acts as the primary navigation, merging the concepts of "Contacts" and "Chats".

## Structural Changes
- **Remove Sidebar Header:** The top bar with User ID/Icon is removed.
- **Remove Sidebar Tabs:** No more "Chats" vs "Contacts" toggle.
- **Unified List:**
    - The Sidebar displays a list of **Apps** (from `apps.json`).
    - **Each App Item displays:**
        - App Icon & Name.
        - **Status/Last Message:**
            - If a conversation exists: Show the last message content and relative timestamp.
            - If no conversation exists: Show a "Ready to chat" or similar welcoming state (or just blank subtitle).
    - **Interaction:**
        - Clicking an App Item opens the *most recent* conversation for that app (or creates one).

## Visual Polish
- **Chat Bubbles:**
    - Improve CSS for spacing, border-radius, and alignment.
    - Ensure clear distinction between User (Right) and Bot (Left).
- **Spacing:** Review overall padding/margins in the chat view.

## Data Logic
- We need to join `apps.json` with the `conversations` data from Supabase.
- **Map:** Iterate `apps`. For each app, find the corresponding `conversation` (where `app_id` matches).
- **Sort:** Apps with recent activity should probably float to the top, OR keep a fixed "App Directory" order?
    - *Decision:* Let's keep the **fixed order** from `apps.json` for now to make it feel like an "App Launcher", unless the user explicitly asks for recent-sort. *Actually, "Chats" usually implies time-sort. Let's ask or stick to App order for stability first, maybe time-sort later.*
    - *Refinement:* "Keep the chats with prefilled ready to interact chats one per app". This implies a static list of apps.

## Routing
- No changes to URL structure (`?v=chat&id=...`).
