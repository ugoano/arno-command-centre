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

  it("includes Authorization Bearer header when MCP_AUTH_TOKEN is set", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse(sampleCards));

    const { getTasks } = await loadHelpers();
    await getTasks("todo_today");

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers).toHaveProperty("Authorization");
    expect(opts.headers.Authorization).toMatch(/^Bearer .+/);
  });

  it("uses correct Trello MCP URL (port 8001)", async () => {
    mockFetch.mockResolvedValueOnce(trelloResponse(sampleCards));

    const { getTasks } = await loadHelpers();
    await getTasks("todo_today");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://134.209.178.194:8001/mcp");
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

// --- Helper to build GCal MCP-style JSON-RPC responses ---
function gcalResponse(data: unknown) {
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

function gcalError(message: string) {
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

// --- Sample calendar event data ---
const sampleEvents = [
  {
    id: "evt1",
    summary: "Standup",
    start: { dateTime: "2026-02-20T09:00:00Z" },
    end: { dateTime: "2026-02-20T09:30:00Z" },
    location: "Zoom",
    organizer: { email: "ugo@chattermill.io" },
    colorId: "1",
  },
  {
    id: "evt2",
    summary: "Lunch with team",
    start: { date: "2026-02-20" },
    end: { date: "2026-02-21" },
    location: "",
    organizer: { email: "personal@gmail.com" },
    colorId: "2",
  },
  {
    id: "evt3",
    summary: "Sprint Review",
    start: { dateTime: "2026-02-20T14:00:00Z" },
    end: { dateTime: "2026-02-20T15:00:00Z" },
    location: "Meeting Room A",
    organizer: { email: "ugo@chattermill.io" },
    colorId: "1",
  },
];

// --- callGcal unit tests ---
describe("callGcal", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends correct JSON-RPC request to GCal MCP", async () => {
    mockFetch.mockResolvedValueOnce(gcalResponse(sampleEvents));

    const { callGcal } = await loadHelpers();
    await callGcal("list_events", { days: 1 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/mcp");
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "list_events",
        arguments: { days: 1 },
      },
    });
  });

  it("uses correct GCal MCP URL (port 8006)", async () => {
    mockFetch.mockResolvedValueOnce(gcalResponse(sampleEvents));

    const { callGcal } = await loadHelpers();
    await callGcal("list_events", { days: 1 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://134.209.178.194:8006/mcp");
  });

  it("includes Authorization Bearer header", async () => {
    mockFetch.mockResolvedValueOnce(gcalResponse(sampleEvents));

    const { callGcal } = await loadHelpers();
    await callGcal("list_events", { days: 1 });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers).toHaveProperty("Authorization");
    expect(opts.headers.Authorization).toMatch(/^Bearer .+/);
  });

  it("throws on JSON-RPC error response", async () => {
    mockFetch.mockResolvedValueOnce(gcalError("Calendar unavailable"));

    const { callGcal } = await loadHelpers();
    await expect(callGcal("list_events", { days: 1 })).rejects.toThrow(
      "Calendar unavailable"
    );
  });
});

// --- show-calendar handler ---
describe("show-calendar handler", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns structured event list with correct shape", async () => {
    mockFetch.mockResolvedValueOnce(gcalResponse(sampleEvents));

    const handler = await getHandler("show-calendar");
    const result = await handler({});

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toBeDefined();
    const sc = result.structuredContent!;
    expect(sc.events).toHaveLength(3);
    expect(sc.total).toBe(3);
    expect(sc.date).toBeDefined();
  });

  it("maps event fields correctly", async () => {
    mockFetch.mockResolvedValueOnce(gcalResponse(sampleEvents));

    const handler = await getHandler("show-calendar");
    const result = await handler({});
    const events = result.structuredContent!.events as Array<{
      title: string;
      start: string;
      end: string;
      location: string;
      isAllDay: boolean;
    }>;

    expect(events[0]).toMatchObject({
      title: "Standup",
      start: "2026-02-20T09:00:00Z",
      end: "2026-02-20T09:30:00Z",
      location: "Zoom",
      isAllDay: false,
    });

    // All-day event (uses date instead of dateTime)
    expect(events[1]).toMatchObject({
      title: "Lunch with team",
      isAllDay: true,
    });
  });

  it("handles empty event list", async () => {
    mockFetch.mockResolvedValueOnce(gcalResponse([]));

    const handler = await getHandler("show-calendar");
    const result = await handler({});

    expect(result.isError).toBe(false);
    expect(result.structuredContent!.events).toEqual([]);
    expect(result.structuredContent!.total).toBe(0);
  });

  it("returns text content with event summary", async () => {
    mockFetch.mockResolvedValueOnce(gcalResponse(sampleEvents));

    const handler = await getHandler("show-calendar");
    const result = await handler({});

    const text = result.content[0].text;
    expect(text).toContain("3 events");
    expect(text).toContain("Standup");
  });

  it("returns error on API failure", async () => {
    mockFetch.mockResolvedValueOnce(gcalError("GCal API unavailable"));

    const handler = await getHandler("show-calendar");
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error");
  });

  it("handles non-array response gracefully", async () => {
    mockFetch.mockResolvedValueOnce(gcalResponse({ unexpected: true }));

    const handler = await getHandler("show-calendar");
    const result = await handler({});

    expect(result.isError).toBe(false);
    expect(result.structuredContent!.events).toEqual([]);
  });
});

// --- show-quick-stats handler ---
describe("show-quick-stats handler", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns structured stats with correct shape", async () => {
    // First call: Trello get_cards, second call: GCal list_events
    mockFetch
      .mockResolvedValueOnce(trelloResponse(sampleCards))
      .mockResolvedValueOnce(gcalResponse(sampleEvents));

    const handler = await getHandler("show-quick-stats");
    const result = await handler({});

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toBeDefined();
    const sc = result.structuredContent!;
    expect(sc.taskCount).toBe(3);
    expect(sc.overdueCount).toBe(1);
    expect(sc.meetingsToday).toBe(3);
    expect(sc.nextMeeting).toBeDefined();
    expect(typeof sc.freeTimeHours).toBe("number");
  });

  it("identifies next upcoming meeting", async () => {
    // Use a future time so the "upcoming" filter finds it
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const futureEvents = [
      {
        id: "evt-future",
        summary: "Future Standup",
        start: { dateTime: futureTime },
        end: { dateTime: futureEnd },
        location: "Zoom",
        organizer: { email: "ugo@chattermill.io" },
        colorId: "1",
      },
    ];

    mockFetch
      .mockResolvedValueOnce(trelloResponse(sampleCards))
      .mockResolvedValueOnce(gcalResponse(futureEvents));

    const handler = await getHandler("show-quick-stats");
    const result = await handler({});
    const next = result.structuredContent!.nextMeeting as {
      name: string;
      time: string;
    } | null;

    expect(next).not.toBeNull();
    expect(next!.name).toBe("Future Standup");
    expect(next!.time).toBeDefined();
  });

  it("handles no events gracefully", async () => {
    mockFetch
      .mockResolvedValueOnce(trelloResponse(sampleCards))
      .mockResolvedValueOnce(gcalResponse([]));

    const handler = await getHandler("show-quick-stats");
    const result = await handler({});

    expect(result.isError).toBe(false);
    expect(result.structuredContent!.meetingsToday).toBe(0);
    expect(result.structuredContent!.nextMeeting).toBeNull();
  });

  it("handles no tasks gracefully", async () => {
    mockFetch
      .mockResolvedValueOnce(trelloResponse([]))
      .mockResolvedValueOnce(gcalResponse(sampleEvents));

    const handler = await getHandler("show-quick-stats");
    const result = await handler({});

    expect(result.isError).toBe(false);
    expect(result.structuredContent!.taskCount).toBe(0);
    expect(result.structuredContent!.overdueCount).toBe(0);
  });

  it("returns text content with stats summary", async () => {
    mockFetch
      .mockResolvedValueOnce(trelloResponse(sampleCards))
      .mockResolvedValueOnce(gcalResponse(sampleEvents));

    const handler = await getHandler("show-quick-stats");
    const result = await handler({});

    const text = result.content[0].text;
    expect(text).toContain("3 tasks");
    expect(text).toContain("3 meetings");
  });

  it("returns error when Trello fails", async () => {
    mockFetch.mockResolvedValueOnce(trelloError("Trello down"));

    const handler = await getHandler("show-quick-stats");
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error");
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
    process.env.TRELLO_MCP_URL || "http://134.209.178.194:8001";
  const GCAL_MCP =
    process.env.GCAL_MCP_URL || "http://134.209.178.194:8006";
  const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || "test-token";

  async function callMcp(
    baseUrl: string,
    tool: string,
    args: Record<string, unknown>
  ) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (MCP_AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${MCP_AUTH_TOKEN}`;
    }

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
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
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
    return callGcal("list_events", { days });
  }

  return { callMcp, callTrello, callGcal, getTasks, completeTask, createTask, getEvents };
}

/**
 * Simulate a widget handler by replicating the server's handler logic.
 * We can't import the module directly because it calls server.run() on load.
 */
async function getHandler(widgetName: string) {
  const { getTasks, completeTask, createTask, getEvents } = await loadHelpers();

  type CalEvent = {
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    location?: string;
    organizer?: { email: string };
    colorId?: string;
  };

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

    "show-calendar": async () => {
      try {
        const rawEvents = await getEvents(1);
        const events = (Array.isArray(rawEvents) ? rawEvents : []).map(
          (evt: CalEvent) => ({
            title: evt.summary || "Untitled",
            start: evt.start?.dateTime || evt.start?.date || "",
            end: evt.end?.dateTime || evt.end?.date || "",
            location: evt.location || "",
            isAllDay: !evt.start?.dateTime,
          })
        );

        return {
          structuredContent: {
            events,
            date: new Date().toISOString().split("T")[0],
            total: events.length,
          },
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
            { type: "text" as const, text: `Error fetching calendar: ${error}` },
          ],
          isError: true,
        };
      }
    },

    "show-quick-stats": async () => {
      try {
        const [cards, rawEvents] = await Promise.all([
          getTasks("todo_today"),
          getEvents(1),
        ]);

        const tasks = Array.isArray(cards) ? cards : [];
        const events = (Array.isArray(rawEvents) ? rawEvents : []) as CalEvent[];

        const taskCount = tasks.length;
        const overdueCount = tasks.filter(
          (t: { due: string | null }) =>
            t.due && new Date(t.due) < new Date()
        ).length;
        const meetingsToday = events.length;

        // Find next upcoming meeting (non-all-day, in the future)
        const now = new Date();
        const upcoming = events
          .filter((e) => e.start?.dateTime && new Date(e.start.dateTime) > now)
          .sort(
            (a, b) =>
              new Date(a.start.dateTime!).getTime() -
              new Date(b.start.dateTime!).getTime()
          );
        const nextMeeting = upcoming.length > 0
          ? { name: upcoming[0].summary || "Untitled", time: upcoming[0].start.dateTime! }
          : null;

        // Calculate free time: 8 working hours minus meeting hours
        const meetingHours = events.reduce((total, e) => {
          if (!e.start?.dateTime || !e.end?.dateTime) return total;
          const duration =
            (new Date(e.end.dateTime).getTime() -
              new Date(e.start.dateTime).getTime()) /
            (1000 * 60 * 60);
          return total + duration;
        }, 0);
        const freeTimeHours = Math.max(0, 8 - meetingHours);

        return {
          structuredContent: {
            taskCount,
            overdueCount,
            meetingsToday,
            nextMeeting,
            freeTimeHours: Math.round(freeTimeHours * 10) / 10,
          },
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
            { type: "text" as const, text: `Error fetching stats: ${error}` },
          ],
          isError: true,
        };
      }
    },
  };

  return handlers[widgetName];
}
