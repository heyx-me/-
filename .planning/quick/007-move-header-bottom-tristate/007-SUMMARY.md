# Summary: Move Header Bottom & Unified Controls

## Changes
- **Unified Bottom Controls:** Replaced separate `ChatHeader` and `ChatInput` with a single `BottomControls` component fixed at the bottom of the screen.
- **Consistent Layout:** The bottom bar now maintains the same layout in both "Chat" and "App" (Preview) modes: `[Back] [Input] [Toggle] [Menu]`.
- **View Toggle:** Toggles between Chat and App (Preview) modes. The toggle icon indicates the target state (Layout icon for Preview, Chat icon for Chat).
- **Consolidated Action Menu:** The "Action Menu" button (`MoreVertical`) now houses both "New Thread" and "Share Link" options, reducing clutter.
- **Layout Cleanup:** Removed the sticky top header from the main layout, maximizing vertical space for content.