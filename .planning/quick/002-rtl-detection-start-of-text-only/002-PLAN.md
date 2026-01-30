# Plan: Refine RTL Detection

## Context
RTL detection currently checks the entire message. It should only check the beginning of the text to determine the overall direction.

## Tasks

### 1. Update RTL Detection Helper
**File:** `app.jsx`
- Modify `detectDirection(text)` to look at the first few characters (excluding whitespace and common symbols) to decide the direction.

## Verification
- Message starting with Hebrew then English: Should be RTL.
- Message starting with English then Hebrew: Should be LTR.
