import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, CircleAlert, CircleCheck, History as HistoryIcon, Layers3, Plus, RefreshCw, Undo2, X } from 'lucide-react';
import { api, explain, type Habit, type Overview } from './api/client';
import { longDate } from './lib/date';
import { Today, type HabitAction } from './product/Today';
import { History } from './product/History';
import { Organize } from './product/Organize';
import { Editor, type EditorState, type Feedback } from './product/Editor';

const pages = [
  { id: 'hoje', label: 'Hoje', icon: CalendarDays, description: 'Um espaço para a sua rotina.' },
  { id: 'historico', label: 'Histórico', icon: HistoryIcon, description: 'Veja o que você fez e quando fez.' },
  { id: 'organizar', label: 'Organizar', icon: Layers3, description: 'Cuide das suas categorias, hábitos e dados.' },
] as const;
type Page = (typeof pages)[number]['id'];
function readPage(): Page {
  const hash = location.hash.slice(1);
  return pages.find(page => hash === page.id)?.id ?? 'hoje';
}

export default function App() {
  const [page, setPage] = useState(readPage);
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notification, setNotification] = useState<Feedback | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [historyHabit, setHistoryHabit] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const pendingHabits = useRef(new Set<number>());
  const undoInFlight = useRef(false);
  const downloadInFlight = useRef(false);
  const loadIndex = useRef(0);
  const opener = useRef<HTMLElement | null>(null);
  const main = useRef<HTMLElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const nextFocus = useRef<'notice' | 'editor-opener' | null>(null);
  const current = pages.find(item => item.id === page)!;

  const reload = useCallback(async (signal?: AbortSignal) => {
    const index = ++loadIndex.current;
    try {
      const next = await api.overview(signal);
      if (index !== loadIndex.current || signal?.aborted) return;
      setData(next); setLoadError(null);
    } catch (err) {
      if (index === loadIndex.current && !signal?.aborted) setLoadError(explain(err));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void reload(controller.signal); });
    const refresh = () => { if (document.visibilityState === 'visible') void reload(controller.signal); };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [reload]);

  useEffect(() => {
    const change = () => {
      const next = readPage();
      if (next === page) return;
      setPage(next); setActionError(null);
      requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, [page]);

  useEffect(() => {
    if (nextFocus.current === 'notice' && notification) {
      nextFocus.current = null;
      (notice.current?.querySelector<HTMLElement>('.undo-feedback') ?? notice.current)?.focus();
    } else if (nextFocus.current === 'editor-opener' && !editor) {
      nextFocus.current = null;
      if (opener.current?.isConnected && opener.current.getClientRects().length) opener.current.focus();
      else heading.current?.focus();
    }
  }, [notification, editor]);

  function open(next: EditorState) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditor(next); setActionError(null);
  }
  const close = () => { nextFocus.current = 'editor-opener'; setEditor(null); };
  async function changed(feedback: Feedback, moveFocus: boolean) {
    if (moveFocus) nextFocus.current = 'notice';
    setNotification(feedback); setActionError(null);
    setRevision(n => n + 1);
    await reload();
  }
  function lock(id: number) {
    if (pendingHabits.current.has(id)) return false;
    pendingHabits.current.add(id); setBusy(new Set(pendingHabits.current)); return true;
  }
  function unlock(id: number) {
    pendingHabits.current.delete(id); setBusy(new Set(pendingHabits.current));
  }
  async function record(habit: Habit) {
    if (!data || !lock(habit.id)) return;
    setActionError(null);
    try {
      const result = await api.record(habit.id, {});
      await changed(result.created ? { message: `${habit.name}: registro salvo.`, undo: { habitId: habit.id, entryId: result.entryId } } :
        { message: `${habit.name} já está registrado hoje.` }, true);
    } catch (err) { setActionError(explain(err)); }
    finally { unlock(habit.id); }
  }
  async function undo() {
    if (!notification?.undo || undoInFlight.current) return;
    const { habitId, entryId } = notification.undo;
    undoInFlight.current = true; setUndoing(true);
    try { await api.removeEntry(habitId, entryId); await changed({ message: 'Marcação desfeita.' }, true); }
    catch (err) { setActionError(explain(err)); }
    finally { undoInFlight.current = false; setUndoing(false); }
  }
  async function restore(habit: Habit) {
    if (!lock(habit.id)) return;
    try { await api.updateHabit(habit.id, { active: true }); await changed({ message: 'Hábito restaurado. Ele voltou para Hoje.' }, true); }
    catch (err) { setActionError(explain(err)); }
    finally { unlock(habit.id); }
  }
  async function download() {
    if (downloadInFlight.current) return;
    downloadInFlight.current = true; setExporting(true); setActionError(null);
    try {
      const backup = await api.backup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `habithub-backup-${data?.today ?? 'dados'}.json`;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setNotification({ message: 'Backup preparado para download.' });
    } catch (err) { setActionError(explain(err)); }
    finally { downloadInFlight.current = false; setExporting(false); }
  }
  function habitAction(habit: Habit, action: HabitAction) {
    if (action === 'edit') open({ kind: 'habit', habit });
    else if (action === 'backdate') open({ kind: 'record', habit });
    else open({ kind: 'archive', habit });
  }
  return <div className="shell">
    <a className="skip-link" href="#conteudo" onClick={event => { event.preventDefault(); main.current?.focus(); }}>Pular para o conteúdo</a>
    <aside className="sidebar">
      <a className="brand" href="#hoje"><img src="/brand.svg" width="40" height="40" alt="" /><span>Habit<span>Hub</span><small>ROTINA NO SEU RITMO</small></span></a>
      <nav aria-label="Navegação principal">{pages.map(({ id, label, icon: Icon }) => <a href={`#${id}`} key={id} aria-current={page === id ? 'page' : undefined}><Icon size={19} aria-hidden="true" /><span>{label}</span></a>)}</nav>
      <p className="sidebar-note"><span aria-hidden="true" /> Instância pessoal</p>
    </aside>
    <main id="conteudo" className="main" tabIndex={-1} ref={main}>
      <header className="page-header"><div><p className="page-kicker">{page === 'hoje' && data ? longDate(data.today) : 'HABITHUB / SUA ROTINA'}</p><h1 ref={heading} tabIndex={-1}>{current.label}</h1><p>{current.description}</p></div>
        {data && <button className="button primary new-habit" onClick={() => open({ kind: 'habit' })}><Plus size={20} aria-hidden="true" /> Novo hábito</button>}
      </header>
      <div className="live-area">
        <div className={notification ? 'feedback success' : undefined} tabIndex={-1} ref={notice}>
          <div role="status" className="status-text">{notification && <><CircleCheck size={19} aria-hidden="true" /><span>{notification.message}</span></>}</div>
          {notification?.undo && <button className="button inline undo-feedback" aria-disabled={undoing || undefined} onClick={() => void undo()}><Undo2 size={17} aria-hidden="true" /> {undoing ? 'Desfazendo…' : 'Desfazer'}</button>}
          {notification && <button className="icon-button close-feedback" aria-label="Dispensar confirmação" onClick={() => { setNotification(null); heading.current?.focus(); }}><X size={18} /></button>}
        </div>
        {actionError && <div className="feedback error" role="alert"><CircleAlert size={19} aria-hidden="true" /><span>{actionError}</span></div>}
        {loadError && <div className="feedback error" role="alert"><CircleAlert size={19} aria-hidden="true" /><span>{loadError}</span><button className="button" onClick={() => { setLoadError(null); void reload(); }}><RefreshCw size={17} /> Tentar de novo</button></div>}
      </div>
      {!data && !loadError && <p className="quiet" role="status">Carregando sua rotina…</p>}
      {data && page === 'hoje' && <Today data={data} busy={busy} onNew={() => open({ kind: 'habit' })} onRecord={habit => void record(habit)} onAction={habitAction} onHistory={habit => { setHistoryHabit(habit.id); location.hash = 'historico'; }} />}
      {data && page === 'historico' && <History data={data} habitId={historyHabit} onPick={setHistoryHabit} revision={revision} onRemove={(habit, entry) => open({ kind: 'remove', habit, entry })} />}
      {data && page === 'organizar' && <Organize data={data} onEdit={open} restoring={busy} exporting={exporting} onRestore={habit => void restore(habit)} onBackup={() => void download()} />}
    </main>
    {data && editor && <Editor state={editor} data={data} onClose={close} onSaved={feedback => { setEditor(null); void changed(feedback, true); }} />}
  </div>;
}
