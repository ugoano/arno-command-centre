import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// --- Mock skybridge/web ---
vi.mock("skybridge/web", () => ({
  mountWidget: vi.fn(),
}));

// --- Mock helpers ---
let mockOutput: unknown = null;
vi.mock("../helpers.js", () => ({
  useToolInfo: () => ({ output: mockOutput }),
  useCallTool: () => ({ callTool: vi.fn(), isPending: false }),
}));

// Import AFTER mocks
import ShowQuickStats from "./show-quick-stats.js";

const sampleOutput = {
  taskCount: 5,
  overdueCount: 2,
  meetingsToday: 3,
  nextMeeting: { name: "Standup", time: "2026-02-20T09:00:00Z" },
  freeTimeHours: 5.5,
};

describe("ShowQuickStats widget", () => {
  beforeEach(() => {
    mockOutput = null;
  });

  it("shows loading spinner when output is null", () => {
    mockOutput = null;
    render(<ShowQuickStats />);
    expect(screen.getByText("Loading stats...")).toBeInTheDocument();
  });

  it("renders all stat badges when output is available", () => {
    mockOutput = sampleOutput;
    render(<ShowQuickStats />);

    expect(screen.getByText("5")).toBeInTheDocument(); // task count
    expect(screen.getByText("2")).toBeInTheDocument(); // overdue count
    expect(screen.getByText("3")).toBeInTheDocument(); // meetings
    expect(screen.getByText("5.5h")).toBeInTheDocument(); // free time
  });

  it("shows task count with label", () => {
    mockOutput = sampleOutput;
    render(<ShowQuickStats />);

    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });

  it("shows overdue count with label", () => {
    mockOutput = sampleOutput;
    render(<ShowQuickStats />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("shows meetings count with label", () => {
    mockOutput = sampleOutput;
    render(<ShowQuickStats />);

    expect(screen.getByText("Meetings")).toBeInTheDocument();
  });

  it("shows next meeting name", () => {
    mockOutput = sampleOutput;
    render(<ShowQuickStats />);

    expect(screen.getByText("Standup")).toBeInTheDocument();
  });

  it("handles no next meeting", () => {
    mockOutput = { ...sampleOutput, nextMeeting: null };
    render(<ShowQuickStats />);

    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("applies overdue-highlight class when overdue > 0", () => {
    mockOutput = sampleOutput;
    const { container } = render(<ShowQuickStats />);

    const overdueEl = container.querySelector(".qs-overdue-highlight");
    expect(overdueEl).not.toBeNull();
  });

  it("does not apply overdue-highlight when overdue is 0", () => {
    mockOutput = { ...sampleOutput, overdueCount: 0 };
    const { container } = render(<ShowQuickStats />);

    const overdueEl = container.querySelector(".qs-overdue-highlight");
    expect(overdueEl).toBeNull();
  });

  it("includes data-llm attribute on container", () => {
    mockOutput = sampleOutput;
    const { container } = render(<ShowQuickStats />);

    const el = container.querySelector("[data-llm]");
    expect(el).not.toBeNull();
    expect(el!.getAttribute("data-llm")).toContain("5 tasks");
    expect(el!.getAttribute("data-llm")).toContain("3 meetings");
  });

  it("includes data-llm on stat badges", () => {
    mockOutput = sampleOutput;
    const { container } = render(<ShowQuickStats />);

    const badges = container.querySelectorAll(".qs-badge[data-llm]");
    expect(badges.length).toBeGreaterThanOrEqual(4);
  });

  it("shows free time with label", () => {
    mockOutput = sampleOutput;
    render(<ShowQuickStats />);

    expect(screen.getByText("Free Time")).toBeInTheDocument();
  });
});
