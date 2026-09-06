import { useState } from "react";
import type {
  Category,
  CommitResponse,
  GraphResponse,
  Habit,
} from "../api/client";
import { Graph } from "./Graph";
import { HabitRow } from "./HabitRow";

const COMPACT_WEEKS = 18;

export function CategoryCard({
  category,
  graph,
  habits,
  onCommit,
  onEditCategory,
  onDeleteCategory,
  onEditHabit,
  onDeleteHabit,
  onError,
}: {
  category: Category;
  graph?: GraphResponse;
  habits: Habit[];
  onCommit: (response: CommitResponse) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
  onEditHabit: (habit: Habit) => void;
  onDeleteHabit: (habit: Habit) => void;
  onError: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={expanded ? "card card-expanded" : "card"}
      style={{ "--category": category.color } as React.CSSProperties}
    >
      <header className="card-header">
        <h2>{category.name}</h2>

        <span className="card-actions">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? "Recolher" : "Ano inteiro"}
          </button>
          <button
            type="button"
            onClick={() => onEditCategory(category)}
            aria-label="Editar categoria"
          >
            ✎
          </button>
          <button
            type="button"
            className="danger-ghost"
            onClick={() => onDeleteCategory(category)}
            aria-label={`Excluir categoria ${category.name}`}
          >
            🗑
          </button>
        </span>
      </header>

      <div className="card-body">
        {graph ? (
          <div className="graph-scroll">
            <Graph
              data={graph}
              weeks={expanded ? undefined : COMPACT_WEEKS}
              showTitle={false}
            />
          </div>
        ) : (
          <p className="tagline">Carregando o grafo…</p>
        )}

        <div className="card-habits">
          {habits.length === 0 ? (
            <p className="tagline">Nenhum hábito nesta categoria ainda.</p>
          ) : (
            <ul className="habit-list">
              {habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  onCommit={onCommit}
                  onEdit={onEditHabit}
                  onDelete={onDeleteHabit}
                  onError={onError}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
