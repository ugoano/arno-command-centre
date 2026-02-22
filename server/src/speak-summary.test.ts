import { describe, it, expect } from "vitest";
import { generateSpeakSummary } from "./speak-summary.js";

describe("generateSpeakSummary", () => {
  it("should produce a summary with total count, overdue count, and top 3 task names", () => {
    const tasks = [
      { id: "1", name: "Risk Ledger reassessment", desc: "", due: "2025-01-01T00:00:00Z", labels: [], url: "" },
      { id: "2", name: "Uber Bliss coverage gaps", desc: "", due: "2025-01-01T00:00:00Z", labels: [], url: "" },
      { id: "3", name: "PostHog billing review", desc: "", due: null, labels: [], url: "" },
      { id: "4", name: "Write unit tests", desc: "", due: null, labels: [], url: "" },
      { id: "5", name: "Deploy MCP server", desc: "", due: null, labels: [], url: "" },
    ];

    const summary = generateSpeakSummary(tasks);

    expect(summary).toContain("5");
    expect(summary).toContain("2");
    expect(summary).toContain("Risk Ledger reassessment");
    expect(summary).toContain("Uber Bliss coverage gaps");
    expect(summary).toContain("PostHog billing review");
    // Should not include 4th and 5th tasks
    expect(summary).not.toContain("Write unit tests");
    expect(summary).not.toContain("Deploy MCP server");
  });

  it("should handle zero overdue tasks", () => {
    const tasks = [
      { id: "1", name: "Future task", desc: "", due: "2099-12-31T00:00:00Z", labels: [], url: "" },
      { id: "2", name: "No due date", desc: "", due: null, labels: [], url: "" },
    ];

    const summary = generateSpeakSummary(tasks);

    expect(summary).toContain("2");
    expect(summary).toContain("none overdue");
    expect(summary).toContain("Future task");
    expect(summary).toContain("No due date");
  });

  it("should handle empty task list", () => {
    const summary = generateSpeakSummary([]);

    expect(summary).toMatch(/no tasks|0 tasks|clear/i);
  });

  it("should handle a single task", () => {
    const tasks = [
      { id: "1", name: "Only task", desc: "", due: null, labels: [], url: "" },
    ];

    const summary = generateSpeakSummary(tasks);

    expect(summary).toContain("1");
    expect(summary).toContain("Only task");
  });

  it("should produce a concise summary (max 3 sentences)", () => {
    const tasks = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      name: `Task ${i}`,
      desc: "",
      due: i < 5 ? "2025-01-01T00:00:00Z" : null,
      labels: [],
      url: "",
    }));

    const summary = generateSpeakSummary(tasks);

    // Should be reasonably short — under 300 chars
    expect(summary.length).toBeLessThan(300);
    // Should mention total and overdue
    expect(summary).toContain("20");
    expect(summary).toContain("5");
  });

  it("should handle exactly 3 tasks (no 'top priorities' needed)", () => {
    const tasks = [
      { id: "1", name: "Alpha", desc: "", due: null, labels: [], url: "" },
      { id: "2", name: "Beta", desc: "", due: null, labels: [], url: "" },
      { id: "3", name: "Gamma", desc: "", due: null, labels: [], url: "" },
    ];

    const summary = generateSpeakSummary(tasks);

    expect(summary).toContain("3");
    expect(summary).toContain("Alpha");
    expect(summary).toContain("Beta");
    expect(summary).toContain("Gamma");
  });
});
