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

import AddTask from "./add-task.js";

describe("AddTask widget", () => {
  beforeEach(() => {
    mockOutput = null;
  });

  it("shows loading spinner when output is null", () => {
    mockOutput = null;
    render(<AddTask />);
    expect(screen.getByText("Creating task...")).toBeInTheDocument();
  });

  it("renders success confirmation with task name", () => {
    mockOutput = {
      success: true,
      cardId: "new123",
      name: "Buy groceries",
      message: "Added: Buy groceries",
    };
    render(<AddTask />);

    expect(screen.getByText("+")).toBeInTheDocument();
    expect(screen.getByText("Added: Buy groceries")).toBeInTheDocument();
  });

  it("renders failure state", () => {
    mockOutput = {
      success: false,
      error: "Rate limited",
    };
    render(<AddTask />);

    expect(screen.getByText("✗")).toBeInTheDocument();
    expect(screen.getByText("Failed to create task")).toBeInTheDocument();
  });

  it("includes data-llm attribute on success", () => {
    mockOutput = {
      success: true,
      cardId: "new123",
      name: "Buy groceries",
      message: "Added: Buy groceries",
    };
    const { container } = render(<AddTask />);
    const el = container.querySelector("[data-llm]");
    expect(el!.getAttribute("data-llm")).toContain("Task created: Buy groceries");
  });

  it("includes data-llm attribute on error", () => {
    mockOutput = {
      success: false,
      error: "Network error",
    };
    const { container } = render(<AddTask />);
    const el = container.querySelector("[data-llm]");
    expect(el!.getAttribute("data-llm")).toContain("Error: Network error");
  });

  it("uses green colour for success", () => {
    mockOutput = {
      success: true,
      cardId: "new123",
      name: "Task",
      message: "Done",
    };
    const { container } = render(<AddTask />);
    const inner = container.querySelector("[style]");
    expect(inner!.getAttribute("style")).toContain("var(--green)");
  });

  it("uses red colour for failure", () => {
    mockOutput = {
      success: false,
      error: "Nope",
    };
    const { container } = render(<AddTask />);
    const inner = container.querySelector("[style]");
    expect(inner!.getAttribute("style")).toContain("var(--red)");
  });
});
