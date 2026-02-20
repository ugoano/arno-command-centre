# Arno Command Centre

An AI-powered command centre that renders as a live widget inside Claude and ChatGPT. Built with [Skybridge](https://github.com/alpic-ai/skybridge) for the [Super MCP World](https://super-mcp-world.netlify.app) hackathon.

## What It Does

Ask your AI assistant to "show my tasks" and instead of a text list, you get an interactive task dashboard widget — right inside the conversation. Mark tasks done, add new ones, request a spoken summary, all without leaving the chat.

**Key Features:**
- Live task dashboard with real-time Trello integration
- Mark tasks complete directly from the widget (dual-surface sync)
- Add tasks via the widget or natural language
- Voice summary via speech integration
- Inline and fullscreen display modes
- `data-llm` annotations keep the LLM aware of everything the user sees

## Architecture

```
User → Claude/ChatGPT → MCP Tool Call → Skybridge Server → Trello API
                                              ↓
                                    Widget renders in chat
                                    (React + data-llm sync)
```

Built on top of real infrastructure used daily — 11 MCP servers, 3 months of production use.

## Quick Start

```bash
npm install
npm run dev          # DevTools at localhost:3000
npm test             # Run 45 unit tests
```

Connect to Claude Web: Settings → Connectors → Add custom connector → `[your-url]/mcp`

## Project Structure

```
├── server/src/index.ts          # Skybridge MCP server with 3 tools
├── web/src/widgets/
│   ├── show-task-dashboard.tsx  # Main dashboard widget
│   ├── complete-task.tsx        # Task completion confirmation
│   └── add-task.tsx             # Task creation confirmation
├── web/src/helpers.ts           # Type-safe hook generators
├── web/src/index.css            # Dark theme styling
├── CLAUDE.md                    # Project context for AI assistants
└── alpic.json                   # Deployment config
```

## Tools

| Tool | Description | Widget |
|------|-------------|--------|
| `show-task-dashboard` | Display interactive task list | Full dashboard with cards, stats, actions |
| `complete-task` | Mark a task as done | Confirmation badge |
| `add-task` | Create a new task | Confirmation badge |

## Testing

45 tests across 4 files using Vitest + React Testing Library:

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode for TDD
```

- Server handler tests — Trello JSON-RPC integration, all 3 widget handlers
- Widget component tests — Rendering, user interactions, data-llm annotations, error states

## Tech Stack

- **Framework:** [Skybridge](https://docs.skybridge.tech) (TypeScript, MCP + React widgets)
- **Backend:** Trello MCP server (card CRUD, list management)
- **Frontend:** React 19, Vite 7, custom dark theme
- **Testing:** Vitest, React Testing Library, jsdom
- **Protocol:** Model Context Protocol (MCP)

## Deploy

```bash
npm run deploy       # Deploy to Alpic
```

Or use ngrok for local testing: `ngrok http 3000`

## Team

**Ugo + Arno** — Solo entry. Arno is the AI assistant (Claude Code) that helped build this.

## Resources

- [Skybridge Documentation](https://docs.skybridge.tech/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Alpic Platform](https://alpic.ai/)

## License

MIT
