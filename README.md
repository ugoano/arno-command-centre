# Arno Command Centre

An AI-powered command centre that renders as live interactive widgets inside Claude Web. Built with [Skybridge](https://github.com/alpic-ai/skybridge) for the [Super MCP World](https://super-mcp-world.netlify.app) hackathon (February 2026).

## What It Does

Ask your AI assistant to "show my tasks" and instead of a text list, you get an interactive task dashboard widget — right inside the conversation. Mark tasks done, add new ones, check your calendar, request a spoken summary, all without leaving the chat.

**Key Features:**
- **Task Dashboard** — Compact task list with real-time Trello integration
- **Calendar Panel** — Today's events in a timeline with all-day events separated
- **Quick Stats Bar** — At-a-glance badges: task count, overdue, meetings, free time
- **Task Completion** — Mark tasks done directly from the widget
- **Task Creation** — Add tasks via the widget or natural language
- **Speak Summary** — One-click button for a spoken audio summary of your tasks
- `data-llm` annotations keep the LLM aware of everything the user sees
- Inline and fullscreen display modes

### How Speak Summary Works

The task dashboard has a "Summary" button that uses Skybridge's `useSendFollowUpMessage` hook to send a message to Claude. Claude calls the `speak-summary` MCP tool, which fetches live task data and returns a concise natural English summary. Claude speaks this aloud through text-to-speech. This demonstrates cross-boundary communication: **widget -> Claude -> MCP tool -> Claude -> speech output**.

## Architecture

```
Claude Web  <-->  Skybridge MCP Server  <-->  Backend MCP Servers
   |                    |                         |
   |-- Widgets (React)  |-- Tools (TypeScript)    |-- Trello MCP (cards)
   |-- Follow-up msgs   |-- Resources (HTML)      |-- GCal MCP (events)
```

The server acts as an **MCP gateway**, maintaining sessions with backend Trello and Google Calendar MCP servers via streamable-http protocol. Widgets render inside Claude Web using Skybridge's resource system with proper CSP and domain hashing.

Built on top of real infrastructure used daily — 11 MCP servers, 3 months of production use.

## Quick Start

```bash
npm install
npm run dev          # DevTools at localhost:3000
npm test             # Run 91 unit tests
```

Connect to Claude Web: Settings -> Connectors -> Add custom connector -> `[your-url]/mcp`

## Project Structure

```
server/
  src/
    index.ts              # MCP server — 5 widgets + 1 tool, API helpers
    speak-summary.ts      # Pure function for generating spoken summaries
    speak-summary.test.ts # Unit tests for summary generation
    index.test.ts         # Server handler tests
web/
  src/
    widgets/
      show-task-dashboard.tsx  # Task list with complete/add/speak
      show-calendar.tsx        # Calendar timeline
      show-quick-stats.tsx     # Stats badge bar
      complete-task.tsx        # Task completion confirmation
      add-task.tsx             # Task creation form
    index.css                  # Shared dark theme styles
    helpers.ts                 # Type-safe Skybridge hook wrappers
patches/
  patch-skybridge.cjs          # Post-install hook (no-op)
deploy.mjs                     # Programmatic Alpic deployment script
vitest.config.ts               # Test configuration
```

## Tools & Widgets

| Name | Type | Description |
|------|------|-------------|
| `show-task-dashboard` | Widget | Interactive task list with complete, add, and speak summary |
| `show-calendar` | Widget | Today's events in timeline format |
| `show-quick-stats` | Widget | Badge bar with task/meeting/free-time stats |
| `complete-task` | Widget | Move a task to done |
| `add-task` | Widget | Create a new task on todo_today |
| `speak-summary` | Tool | Generate concise spoken task summary |

## Testing

91 tests across 7 files using Vitest + React Testing Library:

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode for TDD
```

- **Server tests** — Handler logic, MCP response formatting, error handling
- **Summary tests** — Pure function for spoken summary generation (edge cases, empty lists, overdue)
- **Widget tests** — Rendering, interactions, data-llm annotations, follow-up messages, error states

## Tech Stack

- **Framework:** [Skybridge](https://docs.skybridge.tech) (TypeScript, MCP + React widgets)
- **Hosting:** [Alpic](https://alpic.live) (MCP app hosting platform)
- **Backend:** Trello MCP + Google Calendar MCP (streamable-http)
- **Frontend:** React 19, Vite 7, custom dark theme
- **Testing:** Vitest 4, React Testing Library, jsdom
- **Protocol:** Model Context Protocol (MCP)

## Deploy

Deployed to Alpic at: `https://arno-command-centre-fb74490b.alpic.live`

```bash
ALPIC_API_KEY=<key> node deploy.mjs   # Programmatic deploy
npm run deploy                         # Via Alpic CLI
```

## Team

**Ugo + Arno** — Solo entry. Arno is the AI assistant (Claude Code) that built this end-to-end: server, widgets, tests, deployment, and debugging.

## Resources

- [Skybridge Documentation](https://docs.skybridge.tech/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Alpic Platform](https://alpic.ai/)

## License

MIT
