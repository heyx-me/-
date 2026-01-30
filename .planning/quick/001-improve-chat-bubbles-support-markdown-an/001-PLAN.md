# Plan: Improve Chat Bubbles

## Context
User wants Markdown support in chat messages and automatic RTL detection for languages like Hebrew.
The app uses `importmap` with `esm.sh`.

## Tasks

### 1. Update Import Map
**File:** `index.html`
- Add `react-markdown` to imports.
- Add `remark-gfm` to imports (for tables, etc.).

### 2. Implement Markdown & RTL
**File:** `app.jsx`
- Import `ReactMarkdown` from "react-markdown".
- Import `remarkGfm` from "remark-gfm".
- Create `detectDirection(text)` helper function.
- Update `MessageContent` to render text using `ReactMarkdown`.
- Apply `dir="rtl"` or class based on detection.
- Style markdown elements (tables, code blocks, links) using Tailwind classes via `components` prop of `ReactMarkdown` or global CSS.

## Verification
- Send a message with **bold**, *italic*, `code`, and [link](url).
- Send a message with Hebrew text to verify RTL.
