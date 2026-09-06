import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  fetchGraph,
  type Category,
  type CommitResponse,
  type GraphResponse,
  type Habit,
} from "./api/client";
import { CategoryCard } from "./components/CategoryCard";
import { CategoryForm } from "./components/CategoryForm";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Fab } from "./components/Fab";
import { HabitForm } from "./components/HabitForm";
import { Modal } from "./components/Modal";
import { ToastHost } from "./components/Toast";
import { useToasts } from "./lib/useToasts";

type Target =
  | { kind: "category"; category: Category }
  | { kind: "habit"; habit: Habit };

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [graphs, setGraphs] = useState<Record<number, GraphResponse>>({});

  const [categoryModal, setCategoryModal] = useState<{
    open: boolean;
    editing: Category | null;
  }>({ open: false, editing: null });
  const [habitModal, setHabitModal] = useState<{
    open: boolean;
    editing: Habit | null;
  }>({ open: false, editing: null });

  const [target, setTarget] = useState<Target | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { toasts, notify } = useToasts();

  const doneToday = habits.filter((habit) => habit.doneToday).length;

  const reloadCategories = useCallback(
    () => api.listCategories().then(setCategories),
    [],
  );

  const reloadHabits = useCallback(() => api.listHabits().then(setHabits), []);

  const fetchAll = useCallback(
    () =>
      Promise.all([reloadCategories(), reloadHabits()])
        .then(() => setLoadError(null))
        .catch((err) =>
          setLoadError(
            err instanceof ApiError
              ? err.message
              : "Não consegui falar com a API. Ela está rodando?",
          ),
        )
        .finally(() => setLoading(false)),
    [reloadCategories, reloadHabits],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function retry() {
    setLoading(true);
    setLoadError(null);
    fetchAll();
  }

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
    setGraphs((prev) => {
      const existing = prev[response.categoryId];
      if (!existing) return prev;

      return {
        ...prev,
        [response.categoryId]: {
          ...existing,
          year: response.year,
          weeks: response.weeks,
        },
      };
    });

    reloadHabits().catch(console.error);
    notify("Commit registrado");
  }

  async function confirmDelete() {
    if (!target) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      if (target.kind === "category") {
        await api.deleteCategory(target.category.id);
        setGraphs((prev) => {
          const next = { ...prev };
          delete next[target.category.id];
          return next;
        });
        await reloadCategories();
        notify("Categoria excluída");
      } else {
        await api.deleteHabit(target.habit.id);
        await reloadHabits();
        notify("Hábito excluído");
      }
      setTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Falha de conexão",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function afterCategorySaved(message: string) {
    await reloadCategories();
    notify(message);
  }

  async function afterHabitSaved(message: string) {
    await reloadHabits();
    notify(message);
  }

  return (
    <div className="app">
      <header className="app-header">
        <img src="/favicon.svg" width="36" height="36" alt="" />
        <div className="app-title">
          <h1>HabitHub</h1>
          <p className="tagline">Cada hábito cumprido é um commit.</p>
        </div>

        <div className="header-aside">
          {categories.length > 0 && !loadError && (
            <div className="graph-legend">
              <p className="graph-legend-label">commits no dia</p>
              <p className="graph-legend-scale">
                menos
                <span className="graph-legend-cells">
                  <i data-level="0" />
                  <i data-level="1" />
                  <i data-level="2" />
                  <i data-level="3" />
                  <i data-level="4" />
                </span>
                mais
              </p>
            </div>
          )}

          {habits.length > 0 && (
            <div className="day-summary">
              <p className="day-summary-count">
                <strong>{doneToday}</strong>
                <span>de {habits.length} hoje</span>
              </p>
              <div
                className="day-bar"
                role="progressbar"
                aria-valuenow={doneToday}
                aria-valuemin={0}
                aria-valuemax={habits.length}
                aria-label="Hábitos feitos hoje"
              >
                <span
                  style={{ width: `${(doneToday / habits.length) * 100}%` }}
                />
              </div>
              <p className="day-summary-note">
                {doneToday === habits.length
                  ? "tudo feito — bom descanso"
                  : `faltam ${habits.length - doneToday}`}
              </p>
            </div>
          )}
        </div>
      </header>

      <main>
        {loadError ? (
          <div className="state-panel">
            <h2>A API não respondeu</h2>
            <p className="tagline">{loadError}</p>
            <p className="tagline">
              Suba com <code>npm run dev:api</code> e tente de novo. Seus dados
              continuam no banco.
            </p>
            <button type="button" onClick={retry}>
              Tentar de novo
            </button>
          </div>
        ) : loading ? (
          <p className="tagline">Carregando…</p>
        ) : categories.length === 0 ? (
          <div className="state-panel">
            <h2>Nenhuma categoria ainda</h2>
            <p className="tagline">
              Categoria é o agrupamento que vira um grafo — Saúde, Estudo,
              Trabalho. Cada hábito mora dentro de uma, e todo commit pinta o
              quadradinho do dia.
            </p>
            <button
              type="button"
              className="state-cta"
              onClick={() => setCategoryModal({ open: true, editing: null })}
            >
              Cadastrar a primeira categoria
            </button>
          </div>
        ) : (
          <div className="category-grid">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                graph={graphs[category.id]}
                habits={habits.filter((h) => h.categoryId === category.id)}
                onCommit={handleCommit}
                onEditCategory={(c) =>
                  setCategoryModal({ open: true, editing: c })
                }
                onDeleteCategory={(c) => {
                  setDeleteError(null);
                  setTarget({ kind: "category", category: c });
                }}
                onEditHabit={(h) => setHabitModal({ open: true, editing: h })}
                onDeleteHabit={(h) => {
                  setDeleteError(null);
                  setTarget({ kind: "habit", habit: h });
                }}
                onError={notify}
              />
            ))}
          </div>
        )}
      </main>

      <Fab
        onNewCategory={() => setCategoryModal({ open: true, editing: null })}
        onNewHabit={() => setHabitModal({ open: true, editing: null })}
      />

      <Modal
        open={categoryModal.open}
        title={
          categoryModal.editing ? "Editar categoria" : "Cadastrar categoria"
        }
        onClose={() => setCategoryModal({ open: false, editing: null })}
      >
        <CategoryForm
          key={categoryModal.editing?.id ?? "new"}
          editing={categoryModal.editing}
          onSaved={afterCategorySaved}
          onClose={() => setCategoryModal({ open: false, editing: null })}
        />
      </Modal>

      <Modal
        open={habitModal.open}
        title={habitModal.editing ? "Editar hábito" : "Cadastrar hábito"}
        onClose={() => setHabitModal({ open: false, editing: null })}
      >
        <HabitForm
          key={habitModal.editing?.id ?? "new"}
          categories={categories}
          editing={habitModal.editing}
          onSaved={afterHabitSaved}
          onClose={() => setHabitModal({ open: false, editing: null })}
        />
      </Modal>

      <ConfirmDialog
        open={target !== null}
        title={
          target?.kind === "category" ? "Excluir categoria" : "Excluir hábito"
        }
        message={
          target === null
            ? ""
            : target.kind === "category"
              ? `Excluir a categoria "${target.category.name}"?`
              : `Excluir o hábito "${target.habit.name}"?`
        }
        error={deleteError}
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => {
          setTarget(null);
          setDeleteError(null);
        }}
      />

      <ToastHost toasts={toasts} />
    </div>
  );
}
