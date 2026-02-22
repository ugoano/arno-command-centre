import "@/index.css";

import { useState, useCallback } from "react";
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
  const { callToolAsync: doSpeak } = useCallTool("speak-summary");
  const sendMessage = useSendFollowUpMessage();
  const [displayMode] = useDisplayMode();
  const [newTask, setNewTask] = useState("");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = useCallback(async () => {
    setIsSpeaking(true);
    try {
      const result = await doSpeak({ list: "todo_today" });
      const text = result?.content?.find(
        (c: { type: string }) => c.type === "text"
      );
      if (text && "text" in text) {
        // Send the summary to Claude as a follow-up so it appears in conversation
        // and the user can use Claude's native "read aloud" feature
        sendMessage(`Here is my task summary: "${text.text}" — Please read this aloud.`);
      }
    } catch {
      sendMessage("Use the speak-summary tool to summarise my tasks");
    } finally {
      setIsSpeaking(false);
    }
  }, [doSpeak, sendMessage]);

  if (!output) {
    return (
      <div className="dashboard loading">
        <div className="spinner" />
        <p>Loading tasks...</p>
      </div>
    );
  }

  const { tasks, overdue, total, showing, list, timestamp } = output;
  const isFullscreen = displayMode === "fullscreen";
  const activeTasks = tasks.filter(
    (t: Task) => !completedIds.has(t.id)
  );
  const hiddenCount = (total || tasks.length) - (showing || tasks.length);

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
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days}d`;
  }

  return (
    <div
      className={`dashboard ${isFullscreen ? "fullscreen" : "inline"}`}
      data-llm={`Task dashboard: ${activeTasks.length} shown of ${total || tasks.length} tasks in ${list}, ${overdue} overdue. ${completedIds.size} just completed.`}
    >
      {/* Compact header */}
      <div className="header">
        <div className="header-left">
          <h1 className="title">
            <span className="logo">A</span>
            rno Command Centre
          </h1>
        </div>
        <div className="header-right">
          <div className="stat">
            <span className="stat-value">{total || activeTasks.length}</span>
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

      {/* Compact actions */}
      <div className="actions-bar">
        <button
          className="btn btn-add"
          onClick={() => setShowAdd(!showAdd)}
          data-llm="Add new task button"
        >
          + Add
        </button>
        <button
          className="btn btn-speak"
          onClick={handleSpeak}
          disabled={isSpeaking}
          data-llm="Request spoken summary button"
        >
          {isSpeaking ? "🔊 ..." : "🔊 Summary"}
        </button>
        <button
          className="btn btn-refresh"
          onClick={() => sendMessage("Show my tasks")}
        >
          ↻
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
            {isAdding ? "..." : "Add"}
          </button>
        </div>
      )}

      {/* Task list — compact rows */}
      <div className="task-list">
        {activeTasks.map((task: Task) => (
          <div
            key={task.id}
            className={`task-row ${isOverdue(task.due) ? "task-overdue" : ""}`}
            data-llm={`Task: ${task.name}${task.due ? `, ${formatDue(task.due)}` : ""}`}
          >
            <button
              className="check-btn"
              onClick={() => handleComplete(task)}
              disabled={isCompleting}
              title="Mark done"
            >
              ○
            </button>
            <span className="task-name">{task.name}</span>
            {task.labels.length > 0 && (
              <span className="label">{task.labels[0]}</span>
            )}
            {task.due && (
              <span
                className={`due-badge ${isOverdue(task.due) ? "due-overdue" : ""}`}
              >
                {formatDue(task.due)}
              </span>
            )}
          </div>
        ))}
        {hiddenCount > 0 && (
          <div className="more-tasks">
            +{hiddenCount} more tasks
          </div>
        )}
        {activeTasks.length === 0 && (
          <div className="empty">All clear!</div>
        )}
      </div>

      {/* Footer */}
      <div className="footer">
        <span>
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
