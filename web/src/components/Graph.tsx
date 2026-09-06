import { useEffect, useRef, useState } from "react";
import type { Day, GraphResponse } from "../api/client";
import { hexToHue } from "../lib/color";
import { humanDate, today } from "../lib/date";

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function sliceUntilToday(weeks: (Day | null)[][], count?: number) {
  if (!count || count >= weeks.length) return weeks;

  const hoje = today();
  const columnOfToday = weeks.findIndex((week) =>
    week.some((day) => day?.date === hoje),
  );

  const end = columnOfToday === -1 ? weeks.length : columnOfToday + 1;
  return weeks.slice(Math.max(0, end - count), end);
}

function monthLabels(weeks: (Day | null)[][]) {
  let previous = -1;

  return weeks.map((week, index) => {
    const first = week.find((day) => day);
    if (!first) return null;

    const month = Number(first.date.slice(5, 7)) - 1;
    if (month === previous) return null;

    previous = month;
    return index > weeks.length - 3 ? null : MESES[month];
  });
}

type Hovered = { day: Day; x: number; y: number };

export function Graph({
  data,
  weeks: visibleWeeks,
  showTitle = true,
}: {
  data: GraphResponse;
  weeks?: number;
  showTitle?: boolean;
}) {
  const { category, weeks } = data;
  const shown = sliceUntilToday(weeks, visibleWeeks);
  const months = monthLabels(shown);

  const [hovered, setHovered] = useState<Hovered | null>(null);
  const previous = useRef<Map<string, number>>(new Map());
  const [painted, setPainted] = useState<string | null>(null);

  useEffect(() => {
    const current = new Map<string, number>();
    let changed: string | null = null;

    for (const day of weeks.flat()) {
      if (!day) continue;
      current.set(day.date, day.total);

      const before = previous.current.get(day.date);
      if (before !== undefined && day.total > before) changed = day.date;
    }

    const isFirstLoad = previous.current.size === 0;
    previous.current = current;

    if (isFirstLoad || !changed) return;

    setPainted(changed);
    const timer = setTimeout(() => setPainted(null), 600);
    return () => clearTimeout(timer);
  }, [weeks]);

  function show(day: Day, element: HTMLElement) {
    const box = element.getBoundingClientRect();
    setHovered({ day, x: box.left + box.width / 2, y: box.top });
  }

  return (
    <section
      className="graph"
      data-compact={visibleWeeks ? "" : undefined}
      style={
        {
          "--hue": hexToHue(category.color),
          "--weeks": shown.length,
        } as React.CSSProperties
      }
    >
      {showTitle && <h3>{category.name}</h3>}

      <div className="graph-months" aria-hidden>
        {months.map((month, index) => (
          <span key={index}>{month}</span>
        ))}
      </div>

      <div className="graph-grid" onMouseLeave={() => setHovered(null)}>
        {shown.map((week, weekIndex) =>
          week.map((day, dayIndex) =>
            day === null ? (
              <span
                key={`${weekIndex}-${dayIndex}`}
                className="graph-empty"
                aria-hidden
              />
            ) : (
              <span
                key={day.date}
                className="graph-day"
                data-level={day.level}
                data-painted={day.date === painted ? "" : undefined}
                role="img"
                aria-label={`${humanDate(day.date)}: ${day.total} commits`}
                onMouseEnter={(event) => show(day, event.currentTarget)}
              />
            ),
          ),
        )}
      </div>

      {hovered && (
        <div
          className="graph-tip"
          role="tooltip"
          style={{ left: hovered.x, top: hovered.y }}
        >
          <strong>{humanDate(hovered.day.date)}</strong>
          <span>
            {hovered.day.total === 0
              ? "nenhum commit"
              : `${hovered.day.total} commit(s)`}
          </span>
          {hovered.day.messages.map((message, index) => (
            <em key={index}>{message}</em>
          ))}
        </div>
      )}
    </section>
  );
}
