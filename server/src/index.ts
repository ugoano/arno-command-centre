import { McpServer } from "skybridge/server";
import { z } from "zod";

// --- Trello API helpers ---
const TRELLO_MCP = process.env.TRELLO_MCP_URL || "http://134.209.178.194:8001";
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || "";

async function callTrello(tool: string, args: Record<string, unknown>) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (MCP_AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${MCP_AUTH_TOKEN}`;
  }

  const res = await fetch(`${TRELLO_MCP}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  // MCP tool results come as content array with text items
  const textContent = data.result?.content?.find(
    (c: { type: string }) => c.type === "text"
  );
  return textContent ? JSON.parse(textContent.text) : data.result;
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
  );

server.run();

export type AppType = typeof server;
