# Conventions

## Coding Style
-   **Modules**: Strict ES Modules (`import`/`export`). No `require` (unless via `createRequire` shim).
-   **Async/Await**: Used extensively for IO operations.
-   **Formatting**: Standard JS formatting.
-   **Naming**: CamelCase for variables/functions. PascalCase for React components and Classes.

## React Patterns
-   **Hooks**: Heavy usage of custom hooks (`useBanking`, `useLocalStorageState`).
-   **Context**: Global state managed via Context API (`BankingContext`).
-   **Styling**: Tailwind CSS utility classes.
-   **Components**: Functional components. Separated into `components/`, `layouts/`, `contexts/`.

## Agent Protocol
-   **Communication**: JSON payloads over Supabase.
-   **Schema**:
    ```json
    {
      "type": "text | tool | thinking | DATA | LOGIN_SUCCESS",
      "content": "string",
      "data": { ... }
    }
    ```
-   **Thinking**: Agents post `{ type: 'thinking' }` immediately to acknowledge receipt.

## Security
-   **Credentials**: NEVER stored in DB. Passed ephemerally via encrypted payload or entered during scraper runtime.
-   **Tunnels**: Keys generated per-session.
