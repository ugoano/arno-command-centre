import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// --- Mock skybridge/web ---
vi.mock("skybridge/web", () => ({
  mountWidget: vi.fn(),
  useDisplayMode: () => ["inline", vi.fn()] as const,
  useSendFollowUpMessage: () => vi.fn(),
}));

// --- Mock helpers ---
let mockOutput: unknown = null;
vi.mock("../helpers.js", () => ({
  useToolInfo: () => ({ output: mockOutput }),
  useCallTool: () => ({ callTool: vi.fn(), isPending: false }),
}));

// Import AFTER mocks
import ShowCalendar from "./show-calendar.js";

const sampleOutput = {
  events: [
    {
      title: "Standup",
      start: "2026-02-20T09:00:00Z",
      end: "2026-02-20T09:30:00Z",
      location: "Zoom",
      isAllDay: false,
    },
    {
      title: "Lunch with team",
      start: "2026-02-20",
      end: "2026-02-21",
      location: "",
      isAllDay: true,
    },
    {
      title: "Sprint Review",
      start: "2026-02-20T14:00:00Z",
      end: "2026-02-20T15:00:00Z",
      location: "Meeting Room A",
      isAllDay: false,
    },
  ],
  date: "2026-02-20",
  total: 3,
};

describe("ShowCalendar widget", () => {
  beforeEach(() => {
    mockOutput = null;
  });

  it("shows loading spinner when output is null", () => {
    mockOutput = null;
    render(<ShowCalendar />);
    expect(screen.getByText("Loading calendar...")).toBeInTheDocument();
  });

  it("renders event list when output is available", () => {
    mockOutput = sampleOutput;
    render(<ShowCalendar />);

    expect(screen.getByText("Standup")).toBeInTheDocument();
    expect(screen.getByText("Lunch with team")).toBeInTheDocument();
    expect(screen.getByText("Sprint Review")).toBeInTheDocument();
  });

  it("displays event count", () => {
    mockOutput = sampleOutput;
    render(<ShowCalendar />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows location for events with location", () => {
    mockOutput = sampleOutput;
    render(<ShowCalendar />);

    expect(screen.getByText("Zoom")).toBeInTheDocument();
    expect(screen.getByText("Meeting Room A")).toBeInTheDocument();
  });

  it("marks all-day events", () => {
    mockOutput = sampleOutput;
    render(<ShowCalendar />);

    expect(screen.getByText("All day")).toBeInTheDocument();
  });

  it("shows empty state when no events", () => {
    mockOutput = { events: [], date: "2026-02-20", total: 0 };
    render(<ShowCalendar />);

    expect(screen.getByText(/no events/i)).toBeInTheDocument();
  });

  it("includes data-llm attribute on calendar container", () => {
    mockOutput = sampleOutput;
    const { container } = render(<ShowCalendar />);

    const el = container.querySelector("[data-llm]");
    expect(el).not.toBeNull();
    expect(el!.getAttribute("data-llm")).toContain("3 events");
  });

  it("includes data-llm on individual events", () => {
    mockOutput = sampleOutput;
    const { container } = render(<ShowCalendar />);

    const eventEls = container.querySelectorAll(".cal-event[data-llm]");
    expect(eventEls.length).toBe(3);
  });

  it("renders now indicator line", () => {
    mockOutput = sampleOutput;
    const { container } = render(<ShowCalendar />);

    const nowLine = container.querySelector(".now-indicator");
    expect(nowLine).not.toBeNull();
  });

  it("displays the date in header", () => {
    mockOutput = sampleOutput;
    render(<ShowCalendar />);

    expect(screen.getByText(/2026-02-20/)).toBeInTheDocument();
  });
});
