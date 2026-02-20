# Arno Command Centre

MCP App built with Skybridge for the Super MCP World hackathon (Feb 2026).

## What This Is
An AI command centre widget that renders inside Claude/ChatGPT, showing a live task dashboard with voice integration. Built on top of real daily-use MCP infrastructure.

## Architecture
- `server/src/index.ts` — Skybridge MCP server with 3 registered widgets
- `web/src/widgets/` — React widget components (one per registered widget)
- `web/src/helpers.ts` — Type-safe hook generators
- Trello MCP backend at `TRELLO_MCP_URL` (default: http://134.209.178.194:8002)

## Tools
- `show-task-dashboard` — Main widget, shows todo_today list
- `complete-task` — Mark a task as done (callable from widget via useCallTool)
- `add-task` — Create a new task (callable from widget via useCallTool)

## Dev
```bash
npm run dev        # DevTools at localhost:3000, MCP at localhost:3000/mcp
npm run build      # Production build
npm run test       # Run all tests (vitest)
npm run test:watch # Watch mode for TDD
npm run deploy     # Deploy to Alpic
```

## Testing
- **Unit tests:** `npm test` — 45 tests across 4 files (vitest + @testing-library/react)
  - `server/src/index.test.ts` — Server handler tests (16): callTrello JSON-RPC, all 3 widget handlers
  - `web/src/widgets/show-task-dashboard.test.tsx` — Dashboard widget tests (15): rendering, interactions, data-llm
  - `web/src/widgets/complete-task.test.tsx` — Complete widget tests (7): success/failure states, data-llm
  - `web/src/widgets/add-task.test.tsx` — Add widget tests (7): success/failure states, data-llm
- **Manual:** DevTools at localhost:3000 to call tools directly without an LLM
- **Integration:** Claude Web → Settings → Connectors → Add custom connector → ngrok/Alpic URL + /mcp

## SDLC Discipline
All new features require tests before merge. Run `npm test && npm run build` to verify.

## Key Patterns
- Widget `.tsx` filenames MUST match registered widget names exactly
- All tools need `_meta: { "openai/widgetAccessible": true }` for useCallTool access
- `data-llm` attributes on all interactive elements for dual-surface sync
- Server handlers return `structuredContent` (widget) + `content` (LLM) + optional `_meta` (private)
- Test files excluded from production build via tsconfig.json `exclude`
