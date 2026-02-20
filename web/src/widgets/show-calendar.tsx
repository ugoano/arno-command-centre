import "@/index.css";

import { mountWidget, useDisplayMode } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

type CalEvent = {
  title: string;
  start: string;
  end: string;
  location: string;
  isAllDay: boolean;
};

function formatTime(iso: string): string {
  if (!iso || !iso.includes("T")) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function getNowPercent(): number {
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60;
  // Map 8:00–18:00 (working day) to 0–100%
  return Math.max(0, Math.min(100, ((hours - 8) / 10) * 100));
}

function ShowCalendar() {
  const { output } = useToolInfo<"show-calendar">();
  const [displayMode] = useDisplayMode();

  if (!output) {
    return (
      <div className="dashboard loading">
        <div className="spinner" />
        <p>Loading calendar...</p>
      </div>
    );
  }

  const { events, date, total } = output;
  const isFullscreen = displayMode === "fullscreen";
  const allDayEvents = (events as CalEvent[]).filter((e) => e.isAllDay);
  const timedEvents = (events as CalEvent[]).filter((e) => !e.isAllDay);

  return (
    <div
      className={`dashboard cal-panel ${isFullscreen ? "fullscreen" : "inline"}`}
      data-llm={`Calendar: ${total} events on ${date}. ${(events as CalEvent[]).map((e: CalEvent) => e.title).join(", ")}`}
    >
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <h1 className="title">
            <span className="logo">A</span>
            rno Calendar
          </h1>
          <span className="subtitle">{date}</span>
        </div>
        <div className="header-right">
          <div className="stat">
            <span className="stat-value">{total}</span>
            <span className="stat-label">events</span>
          </div>
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="cal-allday-section">
          {allDayEvents.map((evt, i) => (
            <div
              key={i}
              className="cal-event cal-event-allday"
              data-llm={`All-day event: ${evt.title}`}
            >
              <span className="cal-allday-badge">All day</span>
              <span className="cal-event-title">{evt.title}</span>
              {evt.location && (
                <span className="cal-event-location">{evt.location}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="cal-timeline">
        <div
          className="now-indicator"
          style={{ top: `${getNowPercent()}%` }}
        />
        {timedEvents.length > 0 ? (
          timedEvents.map((evt, i) => (
            <div
              key={i}
              className="cal-event"
              data-llm={`Event: ${evt.title}, ${formatTime(evt.start)}–${formatTime(evt.end)}${evt.location ? `, at ${evt.location}` : ""}`}
            >
              <div className="cal-event-time">
                <span>{formatTime(evt.start)}</span>
                <span className="cal-time-sep">–</span>
                <span>{formatTime(evt.end)}</span>
              </div>
              <div className="cal-event-details">
                <span className="cal-event-title">{evt.title}</span>
                {evt.location && (
                  <span className="cal-event-location">{evt.location}</span>
                )}
              </div>
            </div>
          ))
        ) : (
          allDayEvents.length === 0 && (
            <div className="empty">No events today — enjoy the free time!</div>
          )
        )}
      </div>
    </div>
  );
}

export default ShowCalendar;

mountWidget(<ShowCalendar />);
