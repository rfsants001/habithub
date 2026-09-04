import { useCallback, useEffect, useState } from "react";
import {
  api,
  fetchGraph,
  type Category,
  type CommitResponse,
  type GraphResponse,
  type Habit,
} from "./api/client";
import { CategoryForm } from "./components/CategoryForm";
import { CommitButton } from "./components/CommitButton";
import { Graph } from "./components/Graph";
import { HabitForm } from "./components/HabitForm";

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [graphs, setGraphs] = useState<Record<number, GraphResponse>>({});

  const reloadCategories = useCallback(() => {
    api.listCategories().then(setCategories).catch(console.error);
  }, []);

  const reloadHabits = useCallback(() => {
    api.listHabits().then(setHabits).catch(console.error);
  }, []);

  useEffect(() => {
    reloadCategories();
    reloadHabits();
  }, [reloadCategories, reloadHabits]);

  useEffect(() => {
    for (const category of categories) {
      fetchGraph(category.id)
        .then((graph) =>
          setGraphs((prev) => ({ ...prev, [category.id]: graph })),
        )
        .catch(console.error);
    }
  }, [categories]);

  function handleCommit(response: CommitResponse) {
    const category = categories.find((c) => c.id === response.categoryId);
    if (!category) return;

    setGraphs((prev) => ({
      ...prev,
      [response.categoryId]: {
        category: {
          id: category.id,
          name: category.name,
          colorHue: category.colorHue,
        },
        year: response.year,
        weeks: response.weeks,
      },
    }));
  }

  return (
    <div className="app">
      <header className="app-header">
        <img src="/favicon.svg" width="32" height="32" alt="" />
        <div>
          <h1>HabitHub</h1>
          <p className="tagline">Cada hábito cumprido é um commit.</p>
        </div>
      </header>

      <main>
        <section>
          <h2>Nova categoria</h2>
          <CategoryForm onCreated={reloadCategories} />
        </section>

        <section>
          <h2>Novo hábito</h2>
          <HabitForm categories={categories} onCreated={reloadHabits} />
        </section>

        <section>
          <h2>Seus grafos</h2>

          {categories.length === 0 && (
            <p className="tagline">Crie uma categoria para começar.</p>
          )}

          {categories.map((category) => {
            const graph = graphs[category.id];
            const categoryHabits = habits.filter(
              (habit) => habit.categoryId === category.id,
            );

            return (
              <article key={category.id} className="category">
                {graph ? (
                  <Graph data={graph} />
                ) : (
                  <p className="tagline">Carregando o grafo…</p>
                )}

                {categoryHabits.length === 0 ? (
                  <p className="tagline">Nenhum hábito nesta categoria ainda.</p>
                ) : (
                  <ul className="habit-list">
                    {categoryHabits.map((habit) => (
                      <li key={habit.id}>
                        <span>{habit.name}</span>
                        <CommitButton
                          habitId={habit.id}
                          onCommit={handleCommit}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
