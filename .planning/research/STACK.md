# Stack Research

## Analysis
The current stack (React + Tailwind + Supabase) is fully capable of the "WhatsApp Desktop" layout. No new libraries are strictly needed, but `framer-motion` (already present) will be crucial for smooth transitions between "Chats" and "Contacts" views, and for mobile navigation.

## Recommendations

### Core Stack
- **Framework:** React (Existing)
- **Styling:** Tailwind CSS (Existing) - Will use `grid` and `flex` extensively for the master-detail layout.
- **Icons:** `lucide-react` (Existing) - Has all necessary icons (MessageSquare, Users, Phone, MoreVertical, etc.).

### UI Patterns
- **Layout:** CSS Grid with 2 columns on desktop (`minmax(300px, 30%) 1fr`).
- **Scroll Areas:** Independent scroll containers for Sidebar List and Chat History. `h-screen` with `overflow-hidden` on the container.
- **Mobile:** Conditional rendering (or CSS hiding) to show only one pane at a time.

### New Components Needed
- `LayoutShell`: The main grid container.
- `SidebarShell`: The left pane container.
- `ChatList`: The list of conversations (refactored from current modal Sidebar).
- `ContactList`: The new view for "Apps/Contacts".
- `ChatPane`: The right pane container.

### Data
- **Contacts Source:** `apps.json` (Existing) + potentially `supabase.users` in the future. For now, flat merge of Apps + saved Contacts.

### What NOT to add
- Do not add a heavy UI library (MUI/Chakra). Tailwind is sufficient and keeps it lightweight.
- Do not add a specialized router (like `react-router`). The current state-based routing works fine for this SPA scale and fits the "App" model better.