import { useState } from "react";
import { formatDate, humanDate } from "../lib/date";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePicker({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  min: string;
  max: string;
  onChange: (date: string) => void;
}) {
  const selected = new Date(`${value}T12:00:00`);
  const [cursor, setCursor] = useState({
    year: selected.getFullYear(),
    month: selected.getMonth(),
  });

  const cells = monthMatrix(cursor.year, cursor.month);
  const firstOfMonth = formatDate(new Date(cursor.year, cursor.month, 1));
  const lastOfMonth = formatDate(new Date(cursor.year, cursor.month + 1, 0));

  function step(delta: number) {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <div className="datepicker">
      <div className="datepicker-head">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={firstOfMonth <= min}
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <strong>
          {MESES[cursor.month]} {cursor.year}
        </strong>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={lastOfMonth >= max}
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <div className="datepicker-grid" role="grid">
        {DIAS.map((dia, index) => (
          <span key={index} className="datepicker-weekday" aria-hidden>
            {dia}
          </span>
        ))}

        {cells.map((date, index) => {
          if (!date) return <span key={index} />;

          const iso = formatDate(date);
          const disabled = iso < min || iso > max;

          return (
            <button
              key={iso}
              type="button"
              className="datepicker-day"
              data-selected={iso === value ? "" : undefined}
              data-today={iso === max ? "" : undefined}
              disabled={disabled}
              aria-label={humanDate(iso)}
              aria-current={iso === value ? "date" : undefined}
              onClick={() => onChange(iso)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="datepicker-today"
        onClick={() => {
          const hoje = new Date(`${max}T12:00:00`);
          setCursor({ year: hoje.getFullYear(), month: hoje.getMonth() });
          onChange(max);
        }}
      >
        Hoje
      </button>
    </div>
  );
}
