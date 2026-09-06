import type { CommitResponse, Habit } from "../api/client";
import { humanDate } from "../lib/date";
import { CommitControl } from "./CommitControl";

export function HabitRow({
  habit,
  onCommit,
  onEdit,
  onDelete,
  onError,
}: {
  habit: Habit;
  onCommit: (response: CommitResponse) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  onError: (message: string) => void;
}) {
  return (
    <li className="habit-row">
      <span
        className="habit-check"
        data-done={habit.doneToday ? "" : undefined}
        title={habit.doneToday ? "Feito hoje" : "Ainda não feito hoje"}
      >
        {habit.doneToday ? "✓" : "○"}
      </span>

      <span className="habit-name">{habit.name}</span>

      <div className="habit-foot">
        <span className="habit-stats">
          {habit.totalCommits === 0
            ? "sem commits"
            : `${habit.totalCommits} commits · ${humanDate(habit.lastDate!)}`}
        </span>

        <span className="habit-controls">
          <CommitControl
            habitId={habit.id}
            doneToday={habit.doneToday}
            onCommit={onCommit}
            onError={onError}
          />

          <button
            type="button"
            onClick={() => onEdit(habit)}
            aria-label={`Editar ${habit.name}`}
            title="Editar"
          >
            ✎
          </button>
          <button
            type="button"
            className="danger-ghost"
            onClick={() => onDelete(habit)}
            aria-label={`Excluir ${habit.name}`}
            title="Excluir"
          >
            🗑
          </button>
        </span>
      </div>
    </li>
  );
}
