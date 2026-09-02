import { useCallback, useEffect, useState } from "react";
import { api, type Category } from "./api/client";
import { CategoryForm } from "./components/CategoryForm";
import { HabitForm } from "./components/HabitForm";

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);

  const reloadCategories = useCallback(() => {
    api.listCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    reloadCategories();
  }, [reloadCategories]);

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
          <HabitForm categories={categories} onCreated={reloadCategories} />
        </section>

        {/* PH-1-005: falta listar as categorias e os hábitos criados. */}
      </main>
    </div>
  );
}
