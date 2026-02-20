import "@/index.css";

import { useState } from "react";
import {
  mountWidget,
  useDisplayMode,
  useSendFollowUpMessage,
} from "skybridge/web";
import { useToolInfo, useCallTool } from "../helpers.js";

type Task = {
  id: string;
  name: string;
  description: string;
  due: string | null;
  labels: string[];
  url: string;
};

function TaskDashboard() {
  const { output } = useToolInfo<"show-task-dashboard">();
  const { callTool: doComplete, isPending: isCompleting } =
    useCallTool("complete-task");
  const { callTool: doAdd, isPending: isAdding } = useCallTool("add-task");
  const sendMessage = useSendFollowUpMessage();
  const [displayMode] = useDisplayMode();
  const [newTask, setNewTask] = useState("");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);

  if (!output) {
    return (
      <div className="dashboard loading">
        <div className="spinner" />
        <p>Loading tasks...</p>
      </div>
    );
  }

  const { tasks, overdue, list, timestamp } = output;
  const isFullscreen = displayMode === "fullscreen";
  const activeTasks = tasks.filter(
    (t: Task) => !completedIds.has(t.id)
  );

  function handleComplete(task: Task) {
    setCompletedIds((prev) => new Set([...prev, task.id]));
    doComplete({ cardId: task.id, cardName: task.name });
  }

  function handleAdd() {
    if (!newTask.trim()) return;
    doAdd({ name: newTask.trim() });
    setNewTask("");
    setShowAdd(false);
  }

  function isOverdue(due: string | null): boolean {
    return !!due && new Date(due) < new Date();
  }

  function formatDue(due: string | null): string {
    if (!due) return "";
    const d = new Date(due);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days}d`;
  }

  return (
    <div
      className={`dashboard ${isFullscreen ? "fullscreen" : "inline"}`}
      data-llm={`Task dashboard: ${activeTasks.length} active tasks in ${list}, ${overdue} overdue. ${completedIds.size} just completed.`}
    >
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <h1 className="title">
            <span className="logo">A</span>
            rno Command Centre
          </h1>
          <span className="subtitle">{list}</span>
        </div>
        <div className="header-right">
          <div className="stat">
            <span className="stat-value">{activeTasks.length}</span>
            <span className="stat-label">tasks</span>
          </div>
          {overdue > 0 && (
            <div className="stat overdue-stat">
              <span className="stat-value">{overdue}</span>
              <span className="stat-label">overdue</span>
            </div>
          )}
          {completedIds.size > 0 && (
            <div className="stat done-stat">
              <span className="stat-value">{completedIds.size}</span>
              <span className="stat-label">done</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="actions-bar">
        <button
          className="btn btn-add"
          onClick={() => setShowAdd(!showAdd)}
          data-llm="Add new task button"
        >
          + Add Task
        </button>
        <button
          className="btn btn-speak"
          onClick={() =>
            sendMessage(
              `Speak a brief summary of my ${activeTasks.length} tasks`
            )
          }
          data-llm="Request spoken summary button"
        >
          🔊 Speak Summary
        </button>
        <button
          className="btn btn-refresh"
          onClick={() => sendMessage("Show my tasks")}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Add task form */}
      {showAdd && (
        <div className="add-form" data-llm="Add task form visible">
          <input
            type="text"
            className="add-input"
            placeholder="What needs doing?"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            autoFocus
          />
          <button
            className="btn btn-confirm"
            onClick={handleAdd}
            disabled={!newTask.trim() || isAdding}
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
        </div>
      )}

      {/* Task list */}
      <div className="task-list">
        {activeTasks.map((task: Task) => (
          <div
            key={task.id}
            className={`task-card ${isOverdue(task.due) ? "task-overdue" : ""}`}
            data-llm={`Task: ${task.name}${task.due ? `, ${formatDue(task.due)}` : ""}${task.labels.length ? `, labels: ${task.labels.join(",")}` : ""}`}
          >
            <div className="task-main">
              <button
                className="check-btn"
                onClick={() => handleComplete(task)}
                disabled={isCompleting}
                title="Mark done"
              >
                ○
              </button>
              <div className="task-content">
                <span className="task-name">{task.name}</span>
                {task.description && (
                  <span className="task-desc">{task.description}</span>
                )}
              </div>
            </div>
            <div className="task-meta">
              {task.labels.map((label) => (
                <span key={label} className="label">
                  {label}
                </span>
              ))}
              {task.due && (
                <span
                  className={`due ${isOverdue(task.due) ? "due-overdue" : ""}`}
                >
                  {formatDue(task.due)}
                </span>
              )}
            </div>
          </div>
        ))}
        {activeTasks.length === 0 && (
          <div className="empty">
            All clear! No tasks remaining.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="footer">
        <span>
          Last updated:{" "}
          {new Date(timestamp).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

export default TaskDashboard;

mountWidget(<TaskDashboard />);
