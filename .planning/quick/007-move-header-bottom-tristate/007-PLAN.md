# Plan: Move Header Bottom & Tri-State Preview

## Goal
Move conversation controls to the bottom and implement a tri-state view (Chat <-> Preview with Input <-> Full Preview).

## Tasks

### 1. Refactor App Layout & State
- Update `viewMode` in `App` to support three states:
  - `'chat'`: Standard chat view.
  - `'split'`: Preview with chat input (consolidated).
  - `'app'`: Full preview (minimal controls).
- Remove top `ChatHeader`.
- Move header controls logic into `ChatInterface`.

### 2. Create `BottomControls` Component
- Replace `ChatInput` and `ChatHeader` with `BottomControls`.
- **Modes:**
  - **Chat**: Displays standard Input area + Header controls (Back, Title, Share, Toggle) stacked or adjacent.
  - **Split**: Displays Consolidated Input (Input + Mini Controls).
  - **App**: Displays Minimal Controls (Toggle, Back) - Input hidden.

### 3. Update `ChatInterface`
- Render `BottomControls` at the bottom.
- Handle `viewMode` transitions:
  - Button click cycles: Chat -> Split -> App -> Chat.

### 4. Styles
- Ensure bottom bar is sticky/fixed properly.
- Handle mobile/desktop responsiveness.
