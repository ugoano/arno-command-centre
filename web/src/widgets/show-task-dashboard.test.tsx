import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// --- Mock skybridge/web ---
const mockSendMessage = vi.fn();
vi.mock("skybridge/web", () => ({
  mountWidget: vi.fn(),
  useDisplayMode: () => ["inline", vi.fn()] as const,
  useSendFollowUpMessage: () => mockSendMessage,
}));

// --- Mock helpers ---
const mockCallTool = vi.fn();
const mockCallToolAsync = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: "You have 3 tasks today" }],
  isError: false,
});
let mockOutput: unknown = null;

vi.mock("../helpers.js", () => ({
  useToolInfo: () => ({ output: mockOutput }),
  useCallTool: () => ({
    callTool: mockCallTool,
    callToolAsync: mockCallToolAsync,
    isPending: false,
  }),
}));

// Import AFTER mocks
import TaskDashboard from "./show-task-dashboard.js";

const sampleOutput = {
  list: "todo_today",
  tasks: [
    {
      id: "card-1",
      name: "Fix login bug",
      description: "Auth issue",
      due: "2026-02-19T09:00:00.000Z",
      labels: ["仕事"],
      url: "https://trello.com/c/1",
    },
    {
      id: "card-2",
      name: "Write tests",
      description: "",
      due: "2026-12-31T23:59:00.000Z",
      labels: [],
      url: "https://trello.com/c/2",
    },
    {
      id: "card-3",
      name: "Deploy app",
      description: "Final deploy",
      due: null,
      labels: ["仕事", "urgent"],
      url: "https://trello.com/c/3",
    },
  ],
  total: 3,
  showing: 3,
  overdue: 1,
  timestamp: "2026-02-20T10:00:00.000Z",
};

describe("TaskDashboard widget", () => {
  beforeEach(() => {
    mockOutput = null;
    mockCallTool.mockReset();
    mockCallToolAsync.mockReset();
    mockCallToolAsync.mockResolvedValue({
      content: [{ type: "text", text: "You have 3 tasks today" }],
      isError: false,
    });
    mockSendMessage.mockReset();
  });

  it("shows loading spinner when output is null", () => {
    mockOutput = null;
    render(<TaskDashboard />);
    expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
  });

  it("renders task cards when output is available", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    expect(screen.getByText("Write tests")).toBeInTheDocument();
    expect(screen.getByText("Deploy app")).toBeInTheDocument();
  });

  it("displays task count in header", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    // The stat-value showing task count
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows overdue count when > 0", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    // overdue stat
    const overdueStats = screen.getAllByText("1");
    expect(overdueStats.length).toBeGreaterThan(0);
  });

  it("renders first label for tasks", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    // Compact rows show only the first label
    const labels = screen.getAllByText("仕事");
    expect(labels.length).toBe(2); // card-1 and card-3
  });

  it("shows overdue formatting for past-due tasks", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    // The first task is overdue — should show "Xd overdue" on the card
    expect(screen.getByText(/\dd overdue/)).toBeInTheDocument();
  });

  it("calls complete-task tool when check button clicked", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    const checkButtons = screen.getAllByTitle("Mark done");
    fireEvent.click(checkButtons[0]);

    expect(mockCallTool).toHaveBeenCalledWith({
      cardId: "card-1",
      cardName: "Fix login bug",
    });
  });

  it("removes task from view after completing", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    const checkButtons = screen.getAllByTitle("Mark done");
    fireEvent.click(checkButtons[0]); // Complete "Fix login bug"

    // Task should be visually removed
    expect(screen.queryByText("Fix login bug")).not.toBeInTheDocument();
    // Others remain
    expect(screen.getByText("Write tests")).toBeInTheDocument();
  });

  it("shows done count after completing tasks", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    const checkButtons = screen.getAllByTitle("Mark done");
    fireEvent.click(checkButtons[0]);

    // Should show "done" stat
    expect(screen.getByText("done")).toBeInTheDocument();
  });

  it("shows add task form when button clicked", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    fireEvent.click(screen.getByText("+ Add"));
    expect(
      screen.getByPlaceholderText("What needs doing?")
    ).toBeInTheDocument();
  });

  it("calls speak-summary tool when summary button clicked", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    const speakBtn = screen.getByText(/Summary/);
    fireEvent.click(speakBtn);

    // Should call the speak-summary tool via callToolAsync
    expect(mockCallToolAsync).toHaveBeenCalledWith({ list: "todo_today" });
  });

  it("sends refresh message when refresh button clicked", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    fireEvent.click(screen.getByText("↻"));
    expect(mockSendMessage).toHaveBeenCalledWith("Show my tasks");
  });

  it("shows empty state when all tasks completed", () => {
    mockOutput = { ...sampleOutput, tasks: [] };
    render(<TaskDashboard />);

    expect(screen.getByText("All clear!")).toBeInTheDocument();
  });

  it("includes data-llm attribute on dashboard", () => {
    mockOutput = sampleOutput;
    const { container } = render(<TaskDashboard />);

    const dashboard = container.querySelector("[data-llm]");
    expect(dashboard).not.toBeNull();
    expect(dashboard!.getAttribute("data-llm")).toContain("tasks");
  });

  it("shows time in footer", () => {
    mockOutput = sampleOutput;
    render(<TaskDashboard />);

    // Footer shows time from timestamp (HH:MM format)
    expect(screen.getByText("10:00")).toBeInTheDocument();
  });
});
