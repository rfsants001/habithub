import { Archive, Download, Folder, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { Habit, Overview } from '../api/client';
import type { EditorState } from './Editor';

export function Organize({ data, onEdit, onRestore, onBackup, restoring, exporting }: {
  data: Overview; onEdit: (next: EditorState) => void; onRestore: (habit: Habit) => void; onBackup: () => void;
  restoring: ReadonlySet<number>; exporting: boolean;
}) {
  const archived = data.habits.filter(habit => !habit.active);
  return <div className="organize">
    <section className="card organize-card" aria-labelledby="categories-title">
      <div className="panel-top"><div><span className="eyebrow"><Folder size={16} /> SEUS GRUPOS</span><h2 id="categories-title">Categorias</h2></div><button className="button" onClick={() => onEdit({ kind: 'category' })}><Plus size={18} /> Nova categoria</button></div>
      {!data.categories.length ? <p className="quiet">As categorias ajudam a separar partes da sua rotina.</p> : <ul className="manage-list">{data.categories.map(category => {
        const used = data.habits.some(habit => habit.categoryId === category.id);
        return <li key={category.id}><span className="manage-name"><i style={{ background: category.color }} aria-hidden="true" />{category.name}</span>
          <span className="manage-actions"><button className="icon-button" onClick={() => onEdit({ kind: 'category', category })} aria-label={`Editar categoria ${category.name}`}><Pencil size={17} /></button>
            {!used && <button className="icon-button" onClick={() => onEdit({ kind: 'deleteCategory', category })} aria-label={`Excluir categoria ${category.name}`}><Trash2 size={17} /></button>}</span></li>;
      })}</ul>}
    </section>
    <section className="card organize-card" aria-labelledby="archived-title"><div className="panel-top"><div><span className="eyebrow"><Archive size={16} /> FORA DA ROTINA</span><h2 id="archived-title">Hábitos arquivados</h2></div></div>
      {!archived.length ? <p className="quiet">Nenhum hábito arquivado.</p> : <ul className="manage-list">{archived.map(habit => <li key={habit.id}><div className="manage-habit"><strong>{habit.name}</strong><span className="quiet">{habit.categoryName}</span></div><button className="button" aria-disabled={restoring.has(habit.id) || undefined} onClick={() => onRestore(habit)} aria-label={`Restaurar ${habit.name}`}><RotateCcw size={17} /> Restaurar</button></li>)}</ul>}
    </section>
    <section className="card organize-card" aria-labelledby="backup-title"><div className="panel-top"><div><span className="eyebrow">DADOS DA SUA INSTÂNCIA</span><h2 id="backup-title">Backup</h2></div></div>
      <p className="quiet">Baixe uma cópia das suas categorias, hábitos e registros. Guarde o arquivo em um local privado.</p><button className="button" aria-disabled={exporting || undefined} onClick={onBackup}><Download size={18} /> {exporting ? 'Preparando…' : 'Baixar backup'}</button>
    </section>
  </div>;
}
