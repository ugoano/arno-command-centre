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
npm run deploy     # Deploy to Alpic
```

## Testing
Use DevTools at localhost:3000 to call tools directly without an LLM.
For Claude Web: Settings → Connectors → Add custom connector → ngrok URL + /mcp
