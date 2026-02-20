import "@/index.css";

import { mountWidget } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

function ShowQuickStats() {
  const { output } = useToolInfo<"show-quick-stats">();

  if (!output) {
    return (
      <div className="dashboard loading">
        <div className="spinner" />
        <p>Loading stats...</p>
      </div>
    );
  }

  const { taskCount, overdueCount, meetingsToday, nextMeeting, freeTimeHours } =
    output as {
      taskCount: number;
      overdueCount: number;
      meetingsToday: number;
      nextMeeting: { name: string; time: string } | null;
      freeTimeHours: number;
    };

  return (
    <div
      className="dashboard qs-bar"
      data-llm={`Quick stats: ${taskCount} tasks, ${overdueCount} overdue, ${meetingsToday} meetings, ${freeTimeHours}h free${nextMeeting ? `. Next: ${nextMeeting.name}` : ""}`}
    >
      <div className="qs-badges">
        {/* Tasks */}
        <div className="qs-badge" data-llm={`${taskCount} tasks`}>
          <span className="qs-value">{taskCount}</span>
          <span className="qs-label">Tasks</span>
        </div>

        {/* Overdue */}
        <div
          className={`qs-badge ${overdueCount > 0 ? "qs-overdue-highlight" : ""}`}
          data-llm={`${overdueCount} overdue`}
        >
          <span className="qs-value">{overdueCount}</span>
          <span className="qs-label">Overdue</span>
        </div>

        {/* Meetings */}
        <div className="qs-badge" data-llm={`${meetingsToday} meetings today`}>
          <span className="qs-value">{meetingsToday}</span>
          <span className="qs-label">Meetings</span>
        </div>

        {/* Next Meeting */}
        <div
          className="qs-badge qs-badge-wide"
          data-llm={`Next meeting: ${nextMeeting ? nextMeeting.name : "none"}`}
        >
          <span className="qs-value qs-next-name">
            {nextMeeting ? nextMeeting.name : "None"}
          </span>
          <span className="qs-label">Next Meeting</span>
        </div>

        {/* Free Time */}
        <div className="qs-badge" data-llm={`${freeTimeHours}h free time`}>
          <span className="qs-value">{freeTimeHours}h</span>
          <span className="qs-label">Free Time</span>
        </div>
      </div>
    </div>
  );
}

export default ShowQuickStats;

mountWidget(<ShowQuickStats />);
