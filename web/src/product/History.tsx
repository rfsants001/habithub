import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, History as HistoryIcon, Trash2 } from 'lucide-react';
import { api, explain, type Entry, type GraphResponse, type Habit, type Overview } from '../api/client';
import { dayObject, fullWeekdays, humanDate, longDate, monthLabel, moveMonth, weekdays } from '../lib/date';

type Result<T> = { key: string; data: T } | { key: string; error: string };

export function History({ data, habitId, onPick, revision, onRemove }: {
  data: Overview; habitId: number | null; onPick: (id: number) => void;
  revision: number; onRemove: (habit: Habit, entry: Entry) => void;
}) {
  const selected = data.habits.find(habit => habit.id === habitId) ?? data.habits[0];
  const currentMonth = data.today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [day, setDay] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result<Entry[]> | null>(null);
  const id = selected?.id;
  const key = `${id}/${month}/${revision}/${retry}`;
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    api.month(id, month, controller.signal).then(
      response => { if (!controller.signal.aborted) setResult({ key, data: response.entries }); },
      error => { if (!controller.signal.aborted) setResult({ key, error: explain(error) }); },
    );
    return () => controller.abort();
  }, [id, month, key]);
  const current = result?.key === key ? result : null;
  const entries = current && 'data' in current ? current.data : null;
  const grouped = new Map<string, Entry[]>();
  for (const entry of entries ?? []) grouped.set(entry.date, [...(grouped.get(entry.date) ?? []), entry]);
  const selectedEntries = day ? grouped.get(day) : undefined;
  const changeMonth = (amount: number) => { setDay(null); setMonth(moveMonth(month, amount)); };
  return <>
    {!selected ? <section className="empty card"><span className="empty-icon"><HistoryIcon size={24} /></span><h2>Seu histórico começa aqui</h2><p>Crie e marque um hábito para acompanhar os dias em que você o fez.</p></section> :
      <section className="history-card card" aria-labelledby="habit-calendar">
        <div className="panel-top"><div><span className="eyebrow"><CalendarDays size={16} /> POR HÁBITO</span><h2 id="habit-calendar">Calendário mensal</h2></div>
          <div className="field compact"><label htmlFor="history-habit">Hábito</label><select id="history-habit" value={selected.id} onChange={event => { onPick(Number(event.target.value)); setDay(null); }}>
            {data.habits.map(habit => <option key={habit.id} value={habit.id}>{habit.name}{habit.active ? '' : ' (arquivado)'}</option>)}
          </select></div>
        </div>
        <div className="calendar-nav"><button className="icon-button" aria-label="Mês anterior" disabled={month === '1900-01'} onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
          <h3>{monthLabel(month)}</h3><button className="icon-button" aria-label="Próximo mês" disabled={month >= currentMonth} onClick={() => changeMonth(1)}><ChevronRight size={20} /></button></div>
        {!current ? <p className="quiet" role="status">Carregando os registros…</p> : 'error' in current ? <div role="alert" className="feedback error"><p>{current.error}</p><button className="button" onClick={() => setRetry(n => n + 1)}>Tentar novamente</button></div> :
          <>
            <MonthTable month={month} today={data.today} grouped={grouped} selection={day} onPick={setDay} />
            <p className="quiet calendar-summary">{grouped.size === 1 ? '1 dia com registro' : `${grouped.size} dias com registro`} neste mês. {grouped.size > 0 && 'Selecione um dia marcado para ver os detalhes.'}</p>
            {selectedEntries && day && <div className="day-panel" aria-label={`Registros de ${longDate(day)}`}><h3>{longDate(day)}</h3><ul>
              {selectedEntries.map((entry, index) => <li key={entry.id}><span>{entry.message || 'Feito, sem nota'}</span><button className="icon-button" onClick={() => onRemove(selected, entry)} aria-label={`Remover registro ${index + 1} de ${humanDate(day)}`}><Trash2 size={17} /></button></li>)}
            </ul></div>}
          </>}
      </section>}
    {data.categories.length > 0 && <YearGraph data={data} revision={revision} />}
  </>;
}

function MonthTable({ month, today, grouped, selection, onPick }: {
  month: string; today: string; grouped: Map<string, Entry[]>; selection: string | null; onPick: (date: string | null) => void;
}) {
  const first = dayObject(`${month}-01`);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return <table className="calendar"><caption className="visually-hidden">Registros de {monthLabel(month)}</caption><thead><tr>
    {weekdays.map((label, i) => <th key={label} scope="col"><span aria-hidden="true">{label}</span><span className="visually-hidden">{fullWeekdays[i]}</span></th>)}
  </tr></thead><tbody>{Array.from({ length: Math.ceil((days + offset) / 7) }, (_, week) => <tr key={week}>
    {weekdays.map((_, wd) => {
      const number = 1 + week * 7 + wd - offset;
      if (number < 1 || number > days) return <td key={wd} />;
      const date = `${month}-${String(number).padStart(2, '0')}`;
      const count = grouped.get(date)?.length ?? 0;
      const label = `${number}${date === today ? ', hoje' : ''}, ${count === 1 ? '1 registro' : count > 1 ? `${count} registros` : date > today ? 'dia futuro' : 'sem registro'}`;
      return <td key={wd} data-today={date === today || undefined} data-future={date > today || undefined}>
        {count ? <button type="button" aria-label={label} aria-pressed={date === selection} onClick={() => onPick(date === selection ? null : date)}>{number}<span aria-hidden="true" /></button> :
          <span className="calendar-day"><span aria-hidden="true">{number}</span><span className="visually-hidden">{label}</span></span>}
      </td>;
    })}
  </tr>)}</tbody></table>;
}

function YearGraph({ data, revision }: { data: Overview; revision: number }) {
  const currentYear = Number(data.today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result<GraphResponse> | null>(null);
  const category = data.categories.find(item => item.id === categoryId) ?? data.categories[0];
  const id = category.id;
  const key = `${id}/${year}/${revision}/${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    api.graph(id, year, controller.signal).then(
      graph => { if (!controller.signal.aborted) setResult({ key, data: graph }); },
      error => { if (!controller.signal.aborted) setResult({ key, error: explain(error) }); },
    );
    return () => controller.abort();
  }, [id, year, key]);
  const current = result?.key === key ? result : null;
  return <section className="history-card card" aria-labelledby="annual-history">
    <div className="panel-top"><div><span className="eyebrow">POR CATEGORIA</span><h2 id="annual-history">Mapa do ano</h2></div>
      <div className="field compact"><label htmlFor="history-category">Categoria</label><select id="history-category" value={id} onChange={event => setCategoryId(Number(event.target.value))}>{data.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
    <div className="calendar-nav"><button className="icon-button" aria-label="Ano anterior" disabled={year <= 1900} onClick={() => setYear(n => n - 1)}><ChevronLeft size={20} /></button>
      <h3>{year}</h3><button className="icon-button" aria-label="Próximo ano" disabled={year >= currentYear} onClick={() => setYear(n => n + 1)}><ChevronRight size={20} /></button></div>
    {!current ? <p className="quiet" role="status">Carregando o mapa…</p> : 'error' in current ? <div role="alert" className="feedback error"><p>{current.error}</p><button className="button" onClick={() => setRetry(n => n + 1)}>Tentar novamente</button></div> :
      <Heatmap graph={current.data} today={data.today} />}
  </section>;
}

function Heatmap({ graph, today }: { graph: GraphResponse; today: string }) {
  const recorded = graph.weeks.flat().filter(day => day && day.total > 0);
  const byMonth = new Map<string, { days: number; records: number }>();
  for (const day of recorded) {
    if (!day) continue;
    const month = day.date.slice(0, 7);
    const counts = byMonth.get(month) ?? { days: 0, records: 0 };
    byMonth.set(month, { days: counts.days + 1, records: counts.records + day.total });
  }
  const labels = graph.weeks.map(week => week.find(day => day?.date.endsWith('-01'))?.date).map(date => date?.slice(5, 7));
  const monthShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return <>
    <div className="heat-scroll" tabIndex={0} role="region" aria-label="Mapa anual rolável. Os dados também estão no resumo mensal abaixo.">
      <div className="heatmap" aria-hidden="true" style={{ '--columns': graph.weeks.length, '--heat-color': graph.category.color } as React.CSSProperties}>
        <div className="heat-labels">{labels.map((m, index) => <span key={index}>{m && monthShort[Number(m) - 1]}</span>)}</div>
        <div className="heat-grid">{graph.weeks.flat().map((day, index) => <span key={index} data-level={day && day.date <= today ? day.level : undefined} data-today={day?.date === today || undefined} />)}</div>
      </div>
    </div>
    <p className="quiet calendar-summary">{recorded.length === 1 ? '1 dia com registro' : `${recorded.length} dias com registro`} em {graph.year}. Tons mais intensos indicam mais registros.</p>
    <details className="monthly-summary"><summary>Ver números por mês</summary>
      {byMonth.size ? <table><caption className="visually-hidden">Resumo de {graph.category.name} em {graph.year}</caption><thead><tr><th scope="col">Mês</th><th scope="col">Dias</th><th scope="col">Registros</th></tr></thead><tbody>
        {[...byMonth].map(([month, counts]) => <tr key={month}><th scope="row">{monthLabel(month)}</th><td>{counts.days}</td><td>{counts.records}</td></tr>)}
      </tbody></table> : <p className="quiet">Nenhum registro neste ano.</p>}
    </details>
  </>;
}
