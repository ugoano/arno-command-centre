type TaskCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  labels: Array<{ name: string; color: string }> | string[];
  url: string;
};

export function generateSpeakSummary(tasks: TaskCard[]): string {
  const total = tasks.length;

  if (total === 0) {
    return "Your task list is clear. No tasks for today.";
  }

  const now = new Date();
  const overdueCount = tasks.filter(
    (t) => t.due && new Date(t.due) < now
  ).length;

  const top3 = tasks.slice(0, 3).map((t) => t.name);

  const overdueText =
    overdueCount > 0 ? `${overdueCount} overdue` : "none overdue";

  const taskWord = total === 1 ? "task" : "tasks";

  if (total <= 3) {
    return `You have ${total} ${taskWord} today, ${overdueText}. ${top3.join(", ")}.`;
  }

  return `You have ${total} ${taskWord} today, ${overdueText}. Top priorities: ${top3.join(", ")}.`;
}
