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
let mockOutput: unknown = null;

vi.mock("../helpers.js", () => ({
  useToolInfo: () => ({ output: mockOutput }),
  useCallTool: () => ({
    callTool: mockCallTool,
    isPending: false,
  }),
}));

import DailyBriefing from "./show-daily-briefing.js";

const sampleOutput = {
  tasks: [
    { id: "1", name: "Fix login bug", due: "2026-02-19T09:00:00Z", labels: ["仕事"] },
    { id: "2", name: "Write tests", due: "2026-12-31T23:59:00Z", labels: [] },
    { id: "3", name: "Deploy app", due: null, labels: ["urgent"] },
  ],
  totalTasks: 12,
  showingTasks: 3,
  overdueCount: 1,
  events: [
    { title: "Standup", start: "2026-02-22T10:00:00Z", end: "2026-02-22T10:30:00Z", location: "", isAllDay: false },
    { title: "Hackathon Day", start: "2026-02-22", end: "2026-02-22", location: "", isAllDay: true },
  ],
  totalEvents: 2,
  weather: {
    location: "London, England",
    temperature: "11.8°C",
    feelsLike: "8.6°C",
    conditions: "Overcast",
    humidity: "71%",
    wind: "15.9 km/h",
    forecast: [
      { date: "2026-02-22", high: "14.5°C", low: "9.8°C", conditions: "Slight rain", rain: "60%" },
      { date: "2026-02-23", high: "12.2°C", low: "8.8°C", conditions: "Overcast", rain: "10%" },
      { date: "2026-02-24", high: "13.3°C", low: "9.5°C", conditions: "Clear", rain: "3%" },
    ],
  },
  timestamp: "2026-02-22T18:00:00.000Z",
};

describe("DailyBriefing widget", () => {
  beforeEach(() => {
    mockOutput = null;
    mockCallTool.mockReset();
    mockSendMessage.mockReset();
  });

  it("shows loading state when output is null", () => {
    render(<DailyBriefing />);
    expect(screen.getByText("Loading briefing...")).toBeInTheDocument();
  });

  it("renders weather data", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    expect(screen.getByText("11.8°C")).toBeInTheDocument();
    expect(screen.getByText("Overcast")).toBeInTheDocument();
    expect(screen.getByText(/London/)).toBeInTheDocument();
  });

  it("renders forecast days", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    expect(screen.getByText("Sun")).toBeInTheDocument(); // Feb 22
    expect(screen.getByText("Mon")).toBeInTheDocument(); // Feb 23
    expect(screen.getByText("Tue")).toBeInTheDocument(); // Feb 24
  });

  it("renders tasks with complete button", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    expect(screen.getByText("Write tests")).toBeInTheDocument();
    expect(screen.getByText("Deploy app")).toBeInTheDocument();

    const checkBtns = screen.getAllByTitle("Mark done");
    expect(checkBtns.length).toBe(3);
  });

  it("completes a task when check button clicked", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    const checkBtns = screen.getAllByTitle("Mark done");
    fireEvent.click(checkBtns[0]);

    expect(mockCallTool).toHaveBeenCalledWith({
      cardId: "1",
      cardName: "Fix login bug",
    });
    expect(screen.queryByText("Fix login bug")).not.toBeInTheDocument();
  });

  it("renders calendar events", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    expect(screen.getByText("Standup")).toBeInTheDocument();
    expect(screen.getByText("Hackathon Day")).toBeInTheDocument();
    expect(screen.getByText("All day")).toBeInTheDocument();
  });

  it("shows total task and event counts in header", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    expect(screen.getByText("12")).toBeInTheDocument(); // total tasks
    expect(screen.getByText("2")).toBeInTheDocument(); // total events
  });

  it("shows overdue count when present", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    expect(screen.getByText("overdue")).toBeInTheDocument();
  });

  it("shows +N more tasks when truncated", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    expect(screen.getByText("+9 more tasks")).toBeInTheDocument();
  });

  it("shows location change form when pin button clicked", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    fireEvent.click(screen.getByText("📍"));
    expect(screen.getByPlaceholderText("City name...")).toBeInTheDocument();
  });

  it("sends follow-up message to change location", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    fireEvent.click(screen.getByText("📍"));
    const input = screen.getByPlaceholderText("City name...");
    fireEvent.change(input, { target: { value: "Tokyo" } });
    fireEvent.click(screen.getByText("Go"));

    expect(mockSendMessage).toHaveBeenCalledWith(
      "Show my daily briefing for Tokyo"
    );
  });

  it("sends refresh message when refresh clicked", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    fireEvent.click(screen.getByText(/Refresh/));
    expect(mockSendMessage).toHaveBeenCalledWith("Show my daily briefing");
  });

  it("has data-llm attribute with summary", () => {
    mockOutput = sampleOutput;
    const { container } = render(<DailyBriefing />);

    const el = container.querySelector("[data-llm]");
    expect(el).not.toBeNull();
    expect(el!.getAttribute("data-llm")).toContain("12 tasks");
    expect(el!.getAttribute("data-llm")).toContain("11.8°C");
  });

  it("shows rain indicator for high-chance forecast days", () => {
    mockOutput = sampleOutput;
    render(<DailyBriefing />);

    // First forecast day has 60% rain
    expect(screen.getByText("🌧 60%")).toBeInTheDocument();
  });
});
