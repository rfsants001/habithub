import { ArrowUpRight, CalendarDays, Check, ChevronRight, Ellipsis, Leaf, Plus, Target } from 'lucide-react';
import type { Habit, Overview } from '../api/client';
import { addDays, fullWeekdays, humanDate, weekdays } from '../lib/date';

export type HabitAction = 'edit' | 'backdate' | 'archive';

export function Today({ data, busy, onNew, onRecord, onAction, onHistory }: {
  data: Overview; busy: ReadonlySet<number>; onNew: () => void;
  onRecord: (habit: Habit) => void; onAction: (habit: Habit, action: HabitAction) => void;
  onHistory: (habit: Habit) => void;
}) {
  const active = data.habits.filter(habit => habit.active);
  const ready = (habit: Habit) => habit.daysPerWeek === 7 ? habit.doneToday : habit.weekCount >= habit.daysPerWeek;
  const remaining = active.filter(habit => !ready(habit));
  const completed = active.filter(ready);
  const marked = active.filter(habit => habit.doneToday).length;
  const days = weekdays.map((_, i) => addDays(data.week.start, i));
  const anyDone = new Set(active.flatMap(habit => habit.weekDates));
  return <>
    <section className="daily-hero" aria-labelledby="daily-summary">
      <div className="hero-main">
        <span className="eyebrow"><Leaf size={16} /> UM DIA DE CADA VEZ</span>
        <h2 id="daily-summary">{!active.length ? 'Comece pequeno.' : marked ? 'Olha o que você fez.' : 'Faça caber no seu dia.'}</h2>
        <p>{!active.length ? 'Escolha um hábito simples. Seu primeiro registro já vira parte do seu histórico.' :
          marked ? `${marked} ${marked === 1 ? 'hábito registrado' : 'hábitos registrados'} hoje. Cada registro conta.` : 'Quando fizer um hábito, registre aqui. O resto fica no seu ritmo.'}</p>
      </div>
      <div className="week-pulse">
        <div className="week-heading"><span><CalendarDays size={16} /> Esta semana</span><span>{humanDate(data.week.start).slice(0, 5)} – {humanDate(data.week.end).slice(0, 5)}</span></div>
        <ol role="list" className="week-strip" aria-label="Dias com registros nesta semana">
          {days.map((date, i) => <li key={date} data-today={date === data.today || undefined} data-done={anyDone.has(date) || undefined}>
            <span className="visually-hidden">{fullWeekdays[i]}, {humanDate(date)}: {anyDone.has(date) ? 'com registro' : date > data.today ? 'dia futuro' : 'sem registro'}{date === data.today ? ', hoje' : ''}</span>
            <span aria-hidden="true">{weekdays[i]}</span><span aria-hidden="true" className="week-mark">{anyDone.has(date) ? <Check size={17} /> : <span />}</span>
          </li>)}
        </ol>
      </div>
    </section>
    {!active.length ? <section className="empty card">
      <span className="empty-icon"><Target size={24} /></span>
      <h2>{data.habits.length ? 'Nenhum hábito ativo' : 'Qual hábito você quer acompanhar?'}</h2>
      <p>{data.habits.length ? 'Crie um hábito ou restaure um dos arquivados em Organizar.' : 'Pode ser algo simples, como ler duas páginas ou regar as plantas.'}</p>
      <button className="button primary" onClick={onNew}><Plus size={18} /> Criar hábito</button>
    </section> : <>
      {([{ title: 'Em andamento', items: remaining, empty: 'Tudo em dia por aqui.' },
          { title: 'Em dia', items: completed, empty: 'Os hábitos concluídos aparecem aqui.' }]).map(section =>
        <section className="habit-section" key={section.title}>
          <div className="section-title"><h2>{section.title}</h2><span>{section.items.length}</span></div>
          {section.items.length ? <ul role="list" className="habit-list">{section.items.map(habit =>
            <HabitRow key={habit.id} habit={habit} busy={busy.has(habit.id)} onRecord={onRecord} onAction={onAction} onHistory={onHistory} />
          )}</ul> : <p className="quiet">{section.empty}</p>}
        </section>)}
    </>}
  </>;
}

function HabitRow({ habit, busy, onRecord, onAction, onHistory }: {
  habit: Habit; busy: boolean; onRecord: (habit: Habit) => void;
  onAction: (habit: Habit, action: HabitAction) => void; onHistory: (habit: Habit) => void;
}) {
  const daily = habit.daysPerWeek === 7;
  return <li className="habit-row card">
    <span className="habit-indicator" data-done={habit.doneToday || undefined} aria-hidden="true">
      {habit.doneToday ? <Check size={21} /> : <span style={{ backgroundColor: habit.color }} />}
    </span>
    <div className="habit-copy">
      <button type="button" className="habit-link" onClick={() => onHistory(habit)} aria-label={`Ver histórico de ${habit.name}`}>
        <span>{habit.name}</span><ArrowUpRight size={15} aria-hidden="true" />
      </button>
      <span className="habit-meta">{habit.categoryName} <span aria-hidden="true">·</span> {daily ? 'Todo dia' : `${habit.weekCount} de ${habit.daysPerWeek} dias nesta semana`}</span>
      {habit.doneToday && <span className="visually-hidden">Feito hoje</span>}
    </div>
    <div className="habit-actions">
      {habit.doneToday ? <span className="done-label"><Check size={16} aria-hidden="true" /> Feito hoje</span> :
        <button className="button mark" aria-disabled={busy || undefined} onClick={() => onRecord(habit)} aria-label={busy ? `Registrando… ${habit.name}` : `Marcar como feito: ${habit.name}, hoje`}>
          <Check size={18} aria-hidden="true" /> {busy ? 'Registrando…' : 'Marcar como feito'}
        </button>}
      <details className="row-menu">
        <summary className="icon-button" aria-label={`Opções de ${habit.name}`}><Ellipsis size={22} aria-hidden="true" /></summary>
        <div className="menu-pop">
          <button onClick={e => { const menu = e.currentTarget.closest('details'); menu?.querySelector('summary')?.focus(); menu?.removeAttribute('open'); onAction(habit, 'edit'); }}>Editar hábito <ChevronRight size={15} /></button>
          <button onClick={e => { const menu = e.currentTarget.closest('details'); menu?.querySelector('summary')?.focus(); menu?.removeAttribute('open'); onAction(habit, 'backdate'); }}>Registrar em outra data</button>
          <button onClick={e => { const menu = e.currentTarget.closest('details'); menu?.querySelector('summary')?.focus(); menu?.removeAttribute('open'); onAction(habit, 'archive'); }}>Arquivar hábito</button>
        </div>
      </details>
    </div>
  </li>;
}
