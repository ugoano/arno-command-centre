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

import CompleteTask from "./complete-task.js";

describe("CompleteTask widget", () => {
  beforeEach(() => {
    mockOutput = null;
  });

  it("shows loading spinner when output is null", () => {
    mockOutput = null;
    render(<CompleteTask />);
    expect(screen.getByText("Completing task...")).toBeInTheDocument();
  });

  it("renders success confirmation", () => {
    mockOutput = {
      success: true,
      cardId: "abc123",
      cardName: "Fix login bug",
      message: "Fix login bug marked as done",
    };
    render(<CompleteTask />);

    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(
      screen.getByText("Fix login bug marked as done")
    ).toBeInTheDocument();
  });

  it("renders failure state", () => {
    mockOutput = {
      success: false,
      error: "Card not found",
    };
    render(<CompleteTask />);

    expect(screen.getByText("✗")).toBeInTheDocument();
    expect(screen.getByText("Failed to complete task")).toBeInTheDocument();
  });

  it("includes data-llm attribute on success", () => {
    mockOutput = {
      success: true,
      cardId: "abc123",
      cardName: "Fix login bug",
      message: "Fix login bug marked as done",
    };
    const { container } = render(<CompleteTask />);
    const el = container.querySelector("[data-llm]");
    expect(el!.getAttribute("data-llm")).toContain("Task completed");
  });

  it("includes data-llm attribute on error", () => {
    mockOutput = {
      success: false,
      error: "Something went wrong",
    };
    const { container } = render(<CompleteTask />);
    const el = container.querySelector("[data-llm]");
    expect(el!.getAttribute("data-llm")).toContain("Error");
  });

  it("uses green colour for success", () => {
    mockOutput = {
      success: true,
      cardId: "abc123",
      cardName: "Task",
      message: "Done",
    };
    const { container } = render(<CompleteTask />);
    const inner = container.querySelector("[style]");
    expect(inner!.getAttribute("style")).toContain("var(--green)");
  });

  it("uses red colour for failure", () => {
    mockOutput = {
      success: false,
      error: "Nope",
    };
    const { container } = render(<CompleteTask />);
    const inner = container.querySelector("[style]");
    expect(inner!.getAttribute("style")).toContain("var(--red)");
  });
});
