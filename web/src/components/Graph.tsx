import type { GraphResponse } from "../api/client";
import { hexToHue } from "../lib/color";

export function Graph({ data }: { data: GraphResponse }) {
  const { category, weeks } = data;

  return (
    <section
      className="graph"
      style={
        {
          "--hue": hexToHue(category.color),
          "--weeks": weeks.length,
        } as React.CSSProperties
      }
    >
      <h3>{category.name}</h3>
      <div className="graph-grid">
        {weeks.map((week, weekIndex) =>
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
                title={`${day.date} - ${day.total} commit(s)`}
              />
            ),
          ),
        )}
      </div>
    </section>
  );
}
