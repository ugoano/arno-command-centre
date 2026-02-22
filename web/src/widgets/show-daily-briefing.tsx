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
  due: string | null;
  labels: string[];
};

type CalEvent = {
  title: string;
  start: string;
  end: string;
  location: string;
  isAllDay: boolean;
};

type ForecastDay = {
  date: string;
  high: string;
  low: string;
  conditions: string;
  rain: string;
};

type WeatherData = {
  location: string;
  temperature: string;
  feelsLike: string;
  conditions: string;
  humidity: string;
  wind: string;
  forecast: ForecastDay[];
};

function weatherIcon(conditions: string): string {
  const c = conditions.toLowerCase();
  if (c.includes("rain") || c.includes("shower") || c.includes("drizzle")) return "🌧";
  if (c.includes("snow")) return "🌨";
  if (c.includes("thunder") || c.includes("storm")) return "⛈";
  if (c.includes("cloud") || c.includes("overcast")) return "☁";
  if (c.includes("fog") || c.includes("mist")) return "🌫";
  if (c.includes("clear") || c.includes("sunny")) return "☀";
  if (c.includes("partly")) return "⛅";
  return "🌤";
}

function formatTime(iso: string): string {
  if (!iso || !iso.includes("T")) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(due: string | null): boolean {
  return !!due && new Date(due) < new Date();
}

function formatDue(due: string | null): string {
  if (!due) return "";
  const diff = new Date(due).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function DailyBriefing() {
  const { output } = useToolInfo<"show-daily-briefing">();
  const { callTool: doComplete, isPending: isCompleting } =
    useCallTool("complete-task");
  const sendMessage = useSendFollowUpMessage();
  const [displayMode] = useDisplayMode();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [locationInput, setLocationInput] = useState("");
  const [showLocationForm, setShowLocationForm] = useState(false);

  if (!output) {
    return (
      <div className="dashboard loading">
        <div className="spinner" />
        <p>Loading briefing...</p>
      </div>
    );
  }

  const {
    tasks,
    totalTasks,
    showingTasks,
    overdueCount,
    events,
    totalEvents,
    weather,
    timestamp,
  } = output;

  const isFullscreen = displayMode === "fullscreen";
  const activeTasks = (tasks as Task[]).filter((t) => !completedIds.has(t.id));
  const timedEvents = (events as CalEvent[]).filter((e) => !e.isAllDay);
  const allDayEvents = (events as CalEvent[]).filter((e) => e.isAllDay);
  const w = weather as WeatherData;

  function handleComplete(task: Task) {
    setCompletedIds((prev) => new Set([...prev, task.id]));
    doComplete({ cardId: task.id, cardName: task.name });
  }

  function handleChangeLocation() {
    if (!locationInput.trim()) return;
    sendMessage(`Show my daily briefing for ${locationInput.trim()}`);
    setLocationInput("");
    setShowLocationForm(false);
  }

  return (
    <div
      className={`dashboard briefing ${isFullscreen ? "fullscreen" : "inline"}`}
      data-llm={`Daily briefing: ${totalTasks} tasks (${overdueCount} overdue), ${totalEvents} events, ${w.temperature} ${w.conditions} in ${w.location}. Tasks: ${activeTasks.map((t) => t.name).join(", ")}`}
    >
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <h1 className="title">
            <span className="logo">A</span>
            rno Daily Briefing
          </h1>
        </div>
        <div className="header-right">
          <div className="stat">
            <span className="stat-value">{totalTasks}</span>
            <span className="stat-label">tasks</span>
          </div>
          <div className="stat">
            <span className="stat-value">{totalEvents}</span>
            <span className="stat-label">events</span>
          </div>
          {overdueCount > 0 && (
            <div className="stat overdue-stat">
              <span className="stat-value">{overdueCount}</span>
              <span className="stat-label">overdue</span>
            </div>
          )}
        </div>
      </div>

      {/* Weather card */}
      <div className="bf-weather" data-llm={`Weather: ${w.temperature} ${w.conditions} in ${w.location}`}>
        <div className="bf-weather-main">
          <span className="bf-weather-icon">{weatherIcon(w.conditions)}</span>
          <div className="bf-weather-info">
            <span className="bf-weather-temp">{w.temperature}</span>
            <span className="bf-weather-cond">{w.conditions}</span>
          </div>
          <div className="bf-weather-extra">
            <span>Feels {w.feelsLike}</span>
            <span>💧 {w.humidity}</span>
            <span>💨 {w.wind}</span>
          </div>
        </div>
        <div className="bf-weather-location">
          <span>{w.location}</span>
          <button
            className="btn bf-location-btn"
            onClick={() => setShowLocationForm(!showLocationForm)}
          >
            📍
          </button>
        </div>
        {showLocationForm && (
          <div className="bf-location-form">
            <input
              type="text"
              className="add-input"
              placeholder="City name..."
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChangeLocation()}
              autoFocus
            />
            <button
              className="btn btn-confirm"
              onClick={handleChangeLocation}
              disabled={!locationInput.trim()}
            >
              Go
            </button>
          </div>
        )}
        {w.forecast.length > 0 && (
          <div className="bf-forecast">
            {w.forecast.map((f, i) => (
              <div key={i} className="bf-forecast-day">
                <span className="bf-forecast-label">{formatDay(f.date)}</span>
                <span className="bf-forecast-icon">{weatherIcon(f.conditions)}</span>
                <span className="bf-forecast-temps">
                  {f.high} / {f.low}
                </span>
                {parseInt(f.rain) > 20 && (
                  <span className="bf-forecast-rain">🌧 {f.rain}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Events section */}
      {(events as CalEvent[]).length > 0 && (
        <div className="bf-section">
          <div className="bf-section-title">Schedule</div>
          <div className="bf-events">
            {allDayEvents.map((evt, i) => (
              <div key={`ad-${i}`} className="bf-event bf-event-allday">
                <span className="bf-event-badge">All day</span>
                <span className="bf-event-name">{evt.title}</span>
              </div>
            ))}
            {timedEvents.map((evt, i) => (
              <div key={`t-${i}`} className="bf-event">
                <span className="bf-event-time">
                  {formatTime(evt.start)}
                </span>
                <span className="bf-event-name">{evt.title}</span>
                {evt.location && (
                  <span className="bf-event-loc">{evt.location}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks section */}
      <div className="bf-section">
        <div className="bf-section-title">Tasks</div>
        <div className="task-list">
          {activeTasks.map((task) => (
            <div
              key={task.id}
              className={`task-row ${isOverdue(task.due) ? "task-overdue" : ""}`}
              data-llm={`Task: ${task.name}`}
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
          {totalTasks > showingTasks && (
            <div className="more-tasks">
              +{totalTasks - showingTasks} more tasks
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <span>
          {new Date(timestamp).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <button
          className="btn bf-refresh-btn"
          onClick={() => sendMessage("Show my daily briefing")}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}

export default DailyBriefing;

mountWidget(<DailyBriefing />);
