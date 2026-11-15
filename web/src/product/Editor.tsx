import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { api, explain, type Category, type Entry, type Habit, type Overview } from '../api/client';
import { humanDate } from '../lib/date';

export type EditorState =
  | { kind: 'habit'; habit?: Habit }
  | { kind: 'category'; category?: Category }
  | { kind: 'record' | 'archive'; habit: Habit }
  | { kind: 'remove'; habit: Habit; entry: Entry }
  | { kind: 'deleteCategory'; category: Category };
export type Feedback = { message: string; undo?: { habitId: number; entryId: number } };
class FormProblem extends Error {}
const colors = [ ['#8DBB96', 'Verde'], ['#E8B45A', 'Âmbar'], ['#7FB9D4', 'Azul'], ['#B49DD9', 'Lilás'], ['#E6A18F', 'Coral'], ['#ADB4BF', 'Cinza'] ];

export function Editor({ state, data, onClose, onSaved }: {
  state: EditorState; data: Overview; onClose: () => void; onSaved: (feedback: Feedback) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryChoice, setCategoryChoice] = useState(state.kind === 'habit' ? String(state.habit?.categoryId ?? data.categories[0]?.id ?? 'new') : 'new');
  const [frequency, setFrequency] = useState(state.kind === 'habit' && state.habit?.daysPerWeek !== undefined && state.habit.daysPerWeek < 7 ? 'weekly' : 'daily');
  const [color, setColor] = useState(state.kind === 'category' && state.category ? state.category.color : colors[0][0]);
  const newCategory = useRef<Category | null>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => { element?.close(); };
  }, []);
  const title = state.kind === 'habit' ? (state.habit ? 'Editar hábito' : 'Novo hábito') :
    state.kind === 'category' ? (state.category ? 'Editar categoria' : 'Nova categoria') :
    state.kind === 'record' ? 'Registrar em outra data' : state.kind === 'archive' ? 'Arquivar hábito?' :
    state.kind === 'remove' ? 'Remover registro?' : 'Excluir categoria?';
  const confirm = state.kind === 'archive' ? 'Arquivar' : state.kind === 'remove' ? 'Remover' :
    state.kind === 'deleteCategory' ? 'Excluir' : state.kind === 'record' ? 'Salvar registro' :
    state.kind === 'habit' && !state.habit ? 'Criar hábito' : 'Salvar';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    setError(null); busy.current = true; setPending(true);
    try {
      let feedback: Feedback;
      switch (state.kind) {
        case 'habit': {
          const name = value('name');
          if (!name) throw new FormProblem('Digite um nome para o hábito.');
          let categoryId = Number(categoryChoice);
          if (categoryChoice === 'new') {
            const categoryName = value('categoryName');
            if (!categoryName) throw new FormProblem('Digite um nome para a nova categoria.');
            const existing = data.categories.find(category => category.name.toLocaleLowerCase('pt-BR') === categoryName.toLocaleLowerCase('pt-BR'));
            if (existing) categoryId = existing.id;
            else {
              if (newCategory.current?.name !== categoryName) newCategory.current = await api.createCategory({ name: categoryName, color: colors[0][0] });
              categoryId = newCategory.current.id;
            }
          }
          const input = { name, categoryId, daysPerWeek: frequency === 'daily' ? 7 : Number(value('daysPerWeek')) };
          if (state.habit) await api.updateHabit(state.habit.id, input);
          else await api.createHabit(input);
          feedback = { message: state.habit ? 'Hábito atualizado.' : 'Hábito criado. Você já pode registrar quando fizer.' };
          break;
        }
        case 'category': {
          const name = value('name');
          if (!name) throw new FormProblem('Digite um nome para a categoria.');
          if (state.category) await api.updateCategory(state.category.id, { name, color });
          else await api.createCategory({ name, color });
          feedback = { message: state.category ? 'Categoria atualizada.' : 'Categoria criada.' };
          break;
        }
        case 'record': {
          const result = await api.record(state.habit.id, { date: value('date'), message: value('message') || undefined });
          feedback = result.created ? { message: 'Registro salvo.', undo: { habitId: state.habit.id, entryId: result.entryId } } :
            { message: 'Esse hábito já tem um registro nesta data.' };
          break;
        }
        case 'archive':
          await api.updateHabit(state.habit.id, { active: false });
          feedback = { message: 'Hábito arquivado. O histórico continua disponível.' };
          break;
        case 'remove':
          await api.removeEntry(state.habit.id, state.entry.id);
          feedback = { message: 'Registro removido.' };
          break;
        case 'deleteCategory':
          await api.deleteCategory(state.category.id);
          feedback = { message: 'Categoria excluída.' };
          break;
      }
      onSaved(feedback);
    } catch (err) {
      setError(err instanceof FormProblem ? err.message : explain(err));
    } finally { setPending(false); busy.current = false; }
  }
  const destructive = state.kind === 'remove' || state.kind === 'deleteCategory';
  const formFields = state.kind === 'habit' || state.kind === 'category' || state.kind === 'record';
  return <dialog ref={dialog} className="editor" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy.current) onClose(); }}>
    <header className="editor-header"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Fechar" disabled={pending} onClick={onClose}><X size={23} /></button></header>
    <form onSubmit={submit} aria-busy={pending || undefined}>
      {state.kind === 'habit' && <>
        <label className="field">Nome do hábito<input name="name" maxLength={80} required data-initial-focus defaultValue={state.habit?.name} placeholder="Ex.: Ler duas páginas" /></label>
        {data.categories.length > 0 && <div className="field"><label htmlFor="habit-category-choice">Categoria</label><select id="habit-category-choice" value={categoryChoice} onChange={event => setCategoryChoice(event.target.value)}>
          {data.categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}<option value="new">Criar categoria…</option>
        </select></div>}
        {categoryChoice === 'new' && <label className="field">Nome da categoria<input name="categoryName" defaultValue={data.categories.length ? '' : 'Pessoal'} maxLength={60} required placeholder="Ex.: Saúde" /></label>}
        <div className="field"><label htmlFor="habit-frequency">Frequência</label><select id="habit-frequency" value={frequency} onChange={event => setFrequency(event.target.value)}><option value="daily">Todo dia</option><option value="weekly">Alguns dias por semana</option></select></div>
        {frequency === 'weekly' && <div className="field"><label htmlFor="habit-weekly-days">Dias por semana</label><select id="habit-weekly-days" aria-describedby="habit-weekly-help" name="daysPerWeek" defaultValue={state.habit && state.habit.daysPerWeek < 7 ? state.habit.daysPerWeek : 3}>
          {[1, 2, 3, 4, 5, 6].map(n => <option value={n} key={n}>{n} {n === 1 ? 'dia' : 'dias'}</option>)}
        </select><span id="habit-weekly-help" className="field-hint">Escolha os dias conforme sua rotina. A semana vai de segunda a domingo.</span></div>}
      </>}
      {state.kind === 'category' && <>
        <label className="field">Nome da categoria<input name="name" maxLength={60} required data-initial-focus defaultValue={state.category?.name} placeholder="Ex.: Criatividade" /></label>
        <fieldset className="colors"><legend>Cor</legend><div className="swatches">
          {colors.map(([hex, name]) => <label key={hex}><input type="radio" name="color" checked={color.toUpperCase() === hex} onChange={() => setColor(hex)} /><span style={{ '--swatch': hex } as React.CSSProperties} aria-hidden="true" /><span className="visually-hidden">{name}</span></label>)}
        </div><label className="custom-color"><input name="customColor" type="color" value={color} onChange={event => setColor(event.target.value)} /> Cor personalizada</label></fieldset>
      </>}
      {state.kind === 'record' && <>
        <p className="quiet">Registre um dia em que você fez <strong>{state.habit.name}</strong>.</p>
        <label className="field">Data<input name="date" type="date" min="1900-01-01" max={data.today} defaultValue={data.today} required data-initial-focus /></label>
        <label className="field">Nota (opcional)<textarea name="message" rows={3} maxLength={200} placeholder="Algo que você queira lembrar" /></label>
      </>}
      {state.kind === 'archive' && <p>“{state.habit.name}” sai da tela Hoje. Você pode restaurá-lo em Organizar e continuar consultando seu histórico.</p>}
      {state.kind === 'remove' && <p>O registro de “{state.habit.name}” em {humanDate(state.entry.date)} será removido do histórico e da contagem.</p>}
      {state.kind === 'deleteCategory' && <p>“{state.category.name}” será excluída. Para excluir, a categoria precisa estar vazia.</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}
      <footer className="editor-actions"><button type="button" className="button" disabled={pending} data-initial-focus={formFields ? undefined : ''} onClick={onClose}>Cancelar</button><button type="submit" className={`button ${destructive ? 'danger' : 'primary'}`} disabled={pending}>{pending ? 'Salvando…' : confirm}</button></footer>
    </form>
  </dialog>;
}
