import "@/index.css";

import { mountWidget } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

function CompleteTask() {
  const { output } = useToolInfo<"complete-task">();

  if (!output) {
    return (
      <div className="dashboard loading">
        <div className="spinner" />
        <p>Completing task...</p>
      </div>
    );
  }

  return (
    <div
      className="dashboard"
      data-llm={output.success ? `Task completed: ${output.cardName}` : `Error: ${String(output.error ?? "unknown")}`}
    >
      <div
        style={{
          textAlign: "center",
          padding: "24px",
          color: output.success ? "var(--green)" : "var(--red)",
          fontSize: "14px",
        }}
      >
        {output.success ? (
          <>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>✓</div>
            <div>{String(output.message)}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>✗</div>
            <div>Failed to complete task</div>
          </>
        )}
      </div>
    </div>
  );
}

export default CompleteTask;

mountWidget(<CompleteTask />);
