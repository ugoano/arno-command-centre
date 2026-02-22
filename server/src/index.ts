import { McpServer } from "skybridge/server";
import { z } from "zod";

// --- MCP API helpers ---
const TRELLO_MCP = process.env.TRELLO_MCP_URL || "http://134.209.178.194:8001";
const GCAL_MCP = process.env.GCAL_MCP_URL || "http://134.209.178.194:8006";
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || "5s1Z7_D-3bysrG8-8em6JX_VWAKpcKFrAU-9U8w5llM";

// Session cache for backend MCP servers (streamable-http requires session IDs)
const mcpSessions = new Map<string, string>();

function baseHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (MCP_AUTH_TOKEN) h["Authorization"] = `Bearer ${MCP_AUTH_TOKEN}`;
  return h;
}

function parseSSE(raw: string) {
  const dataLine = raw.split("\n").find((l: string) => l.startsWith("data:"));
  if (!dataLine) throw new Error("No data in SSE response");
  return JSON.parse(dataLine.slice(5).trim());
}

async function parseResponse(res: Response) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("text/event-stream") ? parseSSE(await res.text()) : await res.json();
}

async function getMcpSession(baseUrl: string): Promise<string> {
  const cached = mcpSessions.get(baseUrl);
  if (cached) return cached;

  // Initialize session
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0", id: 0, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "arno-command-centre", version: "0.1.0" } },
    }),
  });

  const sessionId = res.headers.get("mcp-session-id") || "";
  if (!sessionId) throw new Error(`No session ID from ${baseUrl}`);

  // Send initialized notification
  await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { ...baseHeaders(), "Mcp-Session-Id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });

  mcpSessions.set(baseUrl, sessionId);
  return sessionId;
}

async function callMcp(
  baseUrl: string,
  tool: string,
  args: Record<string, unknown>
) {
  const sessionId = await getMcpSession(baseUrl);
  const headers = { ...baseHeaders(), "Mcp-Session-Id": sessionId };

  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });

  // If session expired, retry with a fresh one
  if (res.status === 400 || res.status === 404) {
    mcpSessions.delete(baseUrl);
    const newSessionId = await getMcpSession(baseUrl);
    const retry = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { ...baseHeaders(), "Mcp-Session-Id": newSessionId },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: tool, arguments: args },
      }),
    });
    const data = await parseResponse(retry);
    if (data.error) throw new Error(data.error.message);
    const tc = data.result?.content?.find((c: { type: string }) => c.type === "text");
    return tc ? JSON.parse(tc.text) : data.result;
  }

  const data = await parseResponse(res);
  if (data.error) throw new Error(data.error.message);
  // MCP tool results come as content array with text items
  const textContent = data.result?.content?.find(
    (c: { type: string }) => c.type === "text"
  );
  return textContent ? JSON.parse(textContent.text) : data.result;
}

async function callTrello(tool: string, args: Record<string, unknown>) {
  return callMcp(TRELLO_MCP, tool, args);
}

async function callGcal(tool: string, args: Record<string, unknown>) {
  return callMcp(GCAL_MCP, tool, args);
}

async function getTasks(list: string = "todo_today") {
  return callTrello("get_cards", { list, board: "bankai" });
}

async function completeTask(cardId: string) {
  return callTrello("move_card", {
    card_id: cardId,
    list: "done",
    board: "bankai",
  });
}

async function createTask(name: string, description?: string) {
  return callTrello("create_card", {
    name,
    description: description || "",
    list: "todo_today",
    board: "bankai",
  });
}

async function getEvents(days: number = 1) {
  // GCal MCP accepts timeMin/timeMax (ISO strings), not "days"
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  const result = await callGcal("list_events", {
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    maxResults: 25,
  });
  // GCal MCP returns {events: [...], count: N} — extract the array
  return result?.events || (Array.isArray(result) ? result : []);
}

// GCal MCP returns flat start/end strings, not nested objects
type CalEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  htmlLink?: string;
};

// --- Server ---
const server = new McpServer(
  {
    name: "arno-command-centre",
    version: "0.1.0",
  },
  { capabilities: {} },
)
  // --- Widget: Task Dashboard ---
  .registerWidget(
    "show-task-dashboard",
    {
      description: "Arno Command Centre — Task Dashboard",
    },
    {
      description:
        "Display the user's task dashboard showing their todo list with interactive task management. Call this when the user wants to see their tasks, check their todo list, or manage their daily work.",
      inputSchema: {
        list: z
          .string()
          .optional()
          .default("todo_today")
          .describe("Trello list to show (default: todo_today)"),
      },
      _meta: {
        "openai/widgetAccessible": true,
      },
    },
    async ({ list }) => {
      try {
        const cards = await getTasks(list);
        const tasks = (Array.isArray(cards) ? cards : []).map(
          (card: {
            id: string;
            name: string;
            desc: string;
            due: string | null;
            labels: Array<{ name: string; color: string }>;
            url: string;
          }) => ({
            id: card.id,
            name: card.name,
            description: card.desc?.slice(0, 120) || "",
            due: card.due,
            labels: card.labels?.map(
              (l: { name: string; color: string }) => l.name
            ) || [],
            url: card.url,
          })
        );

        const overdue = tasks.filter(
          (t: { due: string | null }) =>
            t.due && new Date(t.due) < new Date()
        ).length;

        const structuredContent = {
          list,
          tasks,
          total: tasks.length,
          overdue,
          timestamp: new Date().toISOString(),
        };

        return {
          structuredContent,
          content: [
            {
              type: "text" as const,
              text: `Task dashboard: ${tasks.length} tasks in ${list}, ${overdue} overdue. Tasks: ${tasks.map((t: { name: string }) => t.name).join(", ")}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching tasks: ${error}`,
            },
          ],
          isError: true,
        };
      }
    }
  )

  // --- Tool: Complete Task ---
  .registerWidget(
    "complete-task",
    {
      description: "Mark a task as complete",
    },
    {
      description:
        "Mark a task as done by moving it to the done list. Use when the user completes a task from the dashboard.",
      inputSchema: {
        cardId: z.string().describe("The Trello card ID to mark as done"),
        cardName: z.string().optional().describe("The task name for confirmation"),
      },
      _meta: {
        "openai/widgetAccessible": true,
      },
    },
    async ({ cardId, cardName }) => {
      try {
        await completeTask(cardId);
        const structuredContent = {
          success: true,
          cardId,
          cardName: cardName || "Task",
          message: `${cardName || "Task"} marked as done`,
        };
        return {
          structuredContent,
          content: [
            {
              type: "text" as const,
              text: `Completed: ${cardName || cardId}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          structuredContent: { success: false, error: String(error) },
          content: [
            { type: "text" as const, text: `Error completing task: ${error}` },
          ],
          isError: true,
        };
      }
    }
  )

  // --- Tool: Add Task ---
  .registerWidget(
    "add-task",
    {
      description: "Add a new task",
    },
    {
      description:
        "Create a new task on the todo list. Use when the user wants to add a task from the dashboard or via chat.",
      inputSchema: {
        name: z.string().describe("The task name/title"),
        description: z.string().optional().describe("Optional task description"),
      },
      _meta: {
        "openai/widgetAccessible": true,
      },
    },
    async ({ name, description }) => {
      try {
        const result = await createTask(name, description);
        const structuredContent = {
          success: true,
          cardId: result?.id,
          name,
          message: `Added: ${name}`,
        };
        return {
          structuredContent,
          content: [
            { type: "text" as const, text: `Created task: ${name}` },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          structuredContent: { success: false, error: String(error) },
          content: [
            { type: "text" as const, text: `Error creating task: ${error}` },
          ],
          isError: true,
        };
      }
    }
  )

  // --- Widget: Calendar Panel ---
  .registerWidget(
    "show-calendar",
    {
      description: "Arno Command Centre — Calendar Panel",
    },
    {
      description:
        "Display today's calendar events in a timeline view. Call this when the user wants to see their schedule, check meetings, or view their calendar.",
      inputSchema: {
        days: z
          .number()
          .optional()
          .default(1)
          .describe("Number of days to show (default: 1)"),
      },
      _meta: {
        "openai/widgetAccessible": true,
      },
    },
    async ({ days }) => {
      try {
        const rawEvents = await getEvents(days);
        // getEvents() already extracts the events array
        const events = (Array.isArray(rawEvents) ? rawEvents : []).map(
          (evt: CalEvent) => ({
            title: evt.summary || "Untitled",
            start: evt.start || "",
            end: evt.end || "",
            location: evt.location || "",
            isAllDay: typeof evt.start === "string" && !evt.start.includes("T"),
          })
        );

        const structuredContent = {
          events,
          date: new Date().toISOString().split("T")[0],
          total: events.length,
        };

        return {
          structuredContent,
          content: [
            {
              type: "text" as const,
              text: `Calendar: ${events.length} events today. ${events.map((e: { title: string }) => e.title).join(", ")}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching calendar: ${error}`,
            },
          ],
          isError: true,
        };
      }
    }
  )

  // --- Widget: Quick Stats Bar ---
  .registerWidget(
    "show-quick-stats",
    {
      description: "Arno Command Centre — Quick Stats",
    },
    {
      description:
        "Display a compact stats bar with task count, overdue count, meetings today, next meeting, and free time. Call this for a quick daily overview.",
      inputSchema: {},
      _meta: {
        "openai/widgetAccessible": true,
      },
    },
    async () => {
      try {
        // getEvents() already extracts the events array
        const [cards, rawEvents] = await Promise.all([
          getTasks("todo_today"),
          getEvents(1),
        ]);

        const tasks = Array.isArray(cards) ? cards : [];
        const events = (
          Array.isArray(rawEvents) ? rawEvents : []
        ) as CalEvent[];

        const taskCount = tasks.length;
        const overdueCount = tasks.filter(
          (t: { due: string | null }) =>
            t.due && new Date(t.due) < new Date()
        ).length;
        const meetingsToday = events.length;

        // Find next upcoming meeting (non-all-day, in the future)
        // GCal MCP returns flat start/end strings
        const now = new Date();
        const upcoming = events
          .filter(
            (e) => e.start?.includes("T") && new Date(e.start) > now
          )
          .sort(
            (a, b) =>
              new Date(a.start).getTime() -
              new Date(b.start).getTime()
          );
        const nextMeeting =
          upcoming.length > 0
            ? {
                name: upcoming[0].summary || "Untitled",
                time: upcoming[0].start,
              }
            : null;

        // Calculate free time: 8 working hours minus meeting hours
        const meetingHours = events.reduce((total, e) => {
          if (!e.start?.includes("T") || !e.end?.includes("T")) return total;
          const duration =
            (new Date(e.end).getTime() -
              new Date(e.start).getTime()) /
            (1000 * 60 * 60);
          return total + duration;
        }, 0);
        const freeTimeHours = Math.max(0, 8 - meetingHours);

        const structuredContent = {
          taskCount,
          overdueCount,
          meetingsToday,
          nextMeeting,
          freeTimeHours: Math.round(freeTimeHours * 10) / 10,
        };

        return {
          structuredContent,
          content: [
            {
              type: "text" as const,
              text: `Quick stats: ${taskCount} tasks (${overdueCount} overdue), ${meetingsToday} meetings, ${freeTimeHours.toFixed(1)}h free time${nextMeeting ? `. Next: ${nextMeeting.name}` : ""}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching stats: ${error}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

server.run();

export type AppType = typeof server;
