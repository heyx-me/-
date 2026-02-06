# Architecture Research

## Component Refactoring

The current `app.jsx` is a single large file. To support the new layout cleanly, we should decompose it, but given the "brownfield" constraint, we might keep it in one file or split minimally. However, the *structure* needs to change.

### Current Structure
```jsx
<App>
  <Sidebar /> (Modal/Overlay)
  <Header />
  <MainContent> (Flex Row)
    <ChatInterface /> (Left/Full)
    <PreviewPane /> (Right/Hidden on mobile)
  </MainContent>
</App>
```

### New Structure (WhatsApp-like)
```jsx
<App>
  <LayoutContainer> (Grid: [Sidebar] [Main])
    
    {/* Left Pane */}
    <LeftPane>
      <LeftHeader /> (User Profile, "New Chat", "Contacts" toggle)
      <Search />
      <ViewSwitcher>
        <ChatList /> (Default)
        <ContactList /> (When "New Chat" clicked)
      </ViewSwitcher>
    </LeftPane>

    {/* Right Pane */}
    <RightPane>
      {/* If no chat selected: Empty State */}
      {/* If chat selected: */}
      <ChatHeader /> (App Info, Actions)
      <Workspace> (Flex Row)
        <ChatInterface /> (The bubbles)
        <PreviewPane /> (The Iframe - "On top" or side-by-side)
      </Workspace>
    </RightPane>

  </LayoutContainer>
</App>
```

## "Contacts" Data Source
- Currently `apps.json` drives the `AddressBar` dropdown.
- We will repurpose `apps.json` to populate the `ContactList`.
- **Mapping:**
    - `id` -> Contact ID
    - `name` -> Display Name
    - `path` -> (Internal metadata)
- **Future:** Merge with `supabase.users` if we add real human-to-human chat. For now, just Apps.

## Routing
- URL: `/?thread=uuid`
- **State Sync:**
    - If `thread` param exists -> `RightPane` shows that thread.
    - If no `thread` -> `RightPane` shows "Welcome/Empty" state.
    - `LeftPane` always active on Desktop.
    - On Mobile: `thread` param -> Show `RightPane`. No `thread` -> Show `LeftPane`.

## Integration Steps
1.  **Extract Components:** `Sidebar` is currently complex. It needs to be a standard div, not an overlay.
2.  **Grid Layout:** Implement the main CSS Grid shell.
3.  **Contacts View:** Create the component to render the Apps list.
4.  **Navigation Logic:** Update `handleNavigate` to support switching the Left Pane view (Chats <-> Contacts).