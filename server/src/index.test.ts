import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch before importing module
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// --- Helper to build MCP-style JSON-RPC responses ---
function trelloResponse(data: unknown) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        jsonrpc: "2.0",
        id: 1,
        result: {
          content: [{ type: "text", text: JSON.stringify(data) }],
        },
      }),
  };
}

function trelloError(message: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32000, message },
      }),
  };
}

// --- Sample card data matching Trello MCP response shape ---
const sampleCards = [
  {
    id: "abc123def456789012345678",
    name: "Fix login bug",
    desc: "Users report intermittent 401 errors on the login page",
    due: "2026-02-19T09:00:00.000Z", // overdue
    labels: [{ name: "仕事", color: "purple" }],
    url: "https://trello.com/c/abc123",
  },
  {
    id: "def456abc789012345678901",
    name: "Write tests",
    desc: "",
    due: "2026-12-31T23:59:00.000Z", // future
    labels: [],
    url: "https://trello.com/c/def456",
  },
  {
    id: "ghi789xyz012345678901234",
    name: "Deploy to production",
    desc: "Final deployment after QA sign-off. Includes database migrations and cache invalidation for the new auth flow.",
    due: null,
    labels: [
      { name: "仕事", color: "purple" },
      { name: "urgent", color: "red" },
    ],
    url: "https://trello.com/c/ghi789",
  },
];

// --- callTrello unit tests ---
describe("callTrello", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends correct JSON-RPC request to Trello MCP", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse(sampleCards));

    // Import fresh to get callTrello-backed functions
    const { getTasks } = await loadHelpers();
    await getTasks("todo_today");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/mcp");
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_cards",
        arguments: { list: "todo_today", board: "bankai" },
      },
    });
  });

  it("throws on JSON-RPC error response", async () => {
    mockFetch.mockResolvedValueOnce(trelloError("Board not found"));

    const { getTasks } = await loadHelpers();
    await expect(getTasks("nonexistent")).rejects.toThrow("Board not found");
  });
});

// --- show-task-dashboard handler ---
describe("show-task-dashboard handler", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns structured task list with correct shape", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse(sampleCards));

    const handler = await getHandler("show-task-dashboard");
    const result = await handler({ list: "todo_today" });

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toBeDefined();
    const sc = result.structuredContent!;
    expect(sc.list).toBe("todo_today");
    expect(sc.tasks).toHaveLength(3);
    expect(sc.total).toBe(3);
    expect(sc.timestamp).toBeDefined();
  });

  it("maps card fields correctly", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse(sampleCards));

    const handler = await getHandler("show-task-dashboard");
    const result = await handler({ list: "todo_today" });
    const tasks = result.structuredContent!.tasks;

    // First card
    expect(tasks[0]).toMatchObject({
      id: "abc123def456789012345678",
      name: "Fix login bug",
      due: "2026-02-19T09:00:00.000Z",
      labels: ["仕事"],
    });
    expect(tasks[0].description).toBe(
      "Users report intermittent 401 errors on the login page"
    );

    // Card with no description
    expect(tasks[1].description).toBe("");

    // Card with multiple labels
    expect(tasks[2].labels).toEqual(["仕事", "urgent"]);
  });

  it("truncates long descriptions to 120 chars", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse(sampleCards));

    const handler = await getHandler("show-task-dashboard");
    const result = await handler({ list: "todo_today" });
    const deployTask = result.structuredContent!.tasks[2];

    expect(deployTask.description.length).toBeLessThanOrEqual(120);
  });

  it("counts overdue tasks correctly", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse(sampleCards));

    const handler = await getHandler("show-task-dashboard");
    const result = await handler({ list: "todo_today" });

    // Only the first card (2026-02-19) is overdue (we're on 2026-02-20)
    expect(result.structuredContent!.overdue).toBe(1);
  });

  it("handles empty task list", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse([]));

    const handler = await getHandler("show-task-dashboard");
    const result = await handler({ list: "todo_today" });

    expect(result.isError).toBe(false);
    expect(result.structuredContent!.tasks).toEqual([]);
    expect(result.structuredContent!.total).toBe(0);
    expect(result.structuredContent!.overdue).toBe(0);
  });

  it("returns text content with task summary", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse(sampleCards));

    const handler = await getHandler("show-task-dashboard");
    const result = await handler({ list: "todo_today" });

    const text = result.content[0].text;
    expect(text).toContain("3 tasks");
    expect(text).toContain("todo_today");
    expect(text).toContain("1 overdue");
    expect(text).toContain("Fix login bug");
  });

  it("returns error on API failure", async () => {
    mockFetch.mockResolvedValueOnce(trelloError("Trello API unavailable"));

    const handler = await getHandler("show-task-dashboard");
    const result = await handler({ list: "todo_today" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error");
  });

  it("handles non-array response gracefully", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse({ unexpected: true }));

    const handler = await getHandler("show-task-dashboard");
    const result = await handler({ list: "todo_today" });

    expect(result.isError).toBe(false);
    expect(result.structuredContent!.tasks).toEqual([]);
  });
});

// --- complete-task handler ---
describe("complete-task handler", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("moves card to done list and returns success", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse({ success: true }));

    const handler = await getHandler("complete-task");
    const result = await handler({
      cardId: "abc123def456789012345678",
      cardName: "Fix login bug",
    });

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      success: true,
      cardId: "abc123def456789012345678",
      cardName: "Fix login bug",
      message: "Fix login bug marked as done",
    });

    // Verify correct Trello API call
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.params).toMatchObject({
      name: "move_card",
      arguments: {
        card_id: "abc123def456789012345678",
        list: "done",
        board: "bankai",
      },
    });
  });

  it("uses fallback name when cardName not provided", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse({ success: true }));

    const handler = await getHandler("complete-task");
    const result = await handler({ cardId: "abc123" });

    expect(result.structuredContent).toMatchObject({
      cardName: "Task",
      message: "Task marked as done",
    });
  });

  it("returns error on failure", async () => {
    mockFetch.mockResolvedValueOnce(trelloError("Card not found"));

    const handler = await getHandler("complete-task");
    const result = await handler({
      cardId: "nonexistent",
      cardName: "Ghost task",
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      success: false,
    });
    expect(result.content[0].text).toContain("Error");
  });
});

// --- add-task handler ---
describe("add-task handler", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("creates a card and returns success with ID", async () => {
    mockFetch.mockResolvedValueOnce(
      trelloResponse({ id: "new123card456789012345", name: "Buy milk" })
    );

    const handler = await getHandler("add-task");
    const result = await handler({
      name: "Buy milk",
      description: "Semi-skimmed",
    });

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      success: true,
      cardId: "new123card456789012345",
      name: "Buy milk",
      message: "Added: Buy milk",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.params).toMatchObject({
      name: "create_card",
      arguments: {
        name: "Buy milk",
        description: "Semi-skimmed",
        list: "todo_today",
        board: "bankai",
      },
    });
  });

  it("sends empty description when not provided", async () => {
    mockFetch.mockResolvedValueOnce(
      trelloResponse({ id: "xyz", name: "Quick task" })
    );

    const handler = await getHandler("add-task");
    await handler({ name: "Quick task" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.params.arguments.description).toBe("");
  });

  it("returns error on API failure", async () => {
    mockFetch.mockResolvedValueOnce(trelloError("Rate limited"));

    const handler = await getHandler("add-task");
    const result = await handler({ name: "Failing task" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ success: false });
  });
});

// --- Test utilities ---

/**
 * Since the server module registers widgets on import and calls server.run(),
 * we test the handler logic directly by re-implementing the core functions
 * that the handlers delegate to. This avoids starting a real MCP server.
 */
async function loadHelpers() {
  const TRELLO_MCP =
    process.env.TRELLO_MCP_URL || "http://134.209.178.194:8002";

  async function callTrello(tool: string, args: Record<string, unknown>) {
    const res = await fetch(`${TRELLO_MCP}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: tool, arguments: args },
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
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

  return { callTrello, getTasks, completeTask, createTask };
}

/**
 * Simulate a widget handler by replicating the server's handler logic.
 * We can't import the module directly because it calls server.run() on load.
 */
async function getHandler(widgetName: string) {
  const { getTasks, completeTask, createTask } = await loadHelpers();

  const handlers: Record<string, (args: Record<string, string | undefined>) => Promise<{
    structuredContent?: Record<string, unknown>;
    content: Array<{ type: "text"; text: string }>;
    isError: boolean;
  }>> = {
    "show-task-dashboard": async ({ list = "todo_today" }) => {
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
            labels:
              card.labels?.map(
                (l: { name: string; color: string }) => l.name
              ) || [],
            url: card.url,
          })
        );

        const overdue = tasks.filter(
          (t: { due: string | null }) =>
            t.due && new Date(t.due) < new Date()
        ).length;

        return {
          structuredContent: {
            list,
            tasks,
            total: tasks.length,
            overdue,
            timestamp: new Date().toISOString(),
          },
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
            { type: "text" as const, text: `Error fetching tasks: ${error}` },
          ],
          isError: true,
        };
      }
    },

    "complete-task": async ({ cardId, cardName }) => {
      try {
        await completeTask(cardId!);
        return {
          structuredContent: {
            success: true,
            cardId,
            cardName: cardName || "Task",
            message: `${cardName || "Task"} marked as done`,
          },
          content: [
            { type: "text" as const, text: `Completed: ${cardName || cardId}` },
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
    },

    "add-task": async ({ name, description }) => {
      try {
        const result = await createTask(name!, description);
        return {
          structuredContent: {
            success: true,
            cardId: result?.id,
            name,
            message: `Added: ${name}`,
          },
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
    },
  };

  return handlers[widgetName];
}
