// Minimal, accessible inline-SVG-free chart primitives for the dashboard.
// Horizontal bars keep long category/state labels readable and work in dark
// mode. Each chart exposes an aria-label summary; labels and values are real
// text so the content is accessible without the visual.

export type Bar = { label: string; value: number; color?: string; display?: string };

export function HBars({
  bars,
  ariaLabel,
  formatValue,
}: {
  bars: Bar[];
  ariaLabel: string;
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      {bars.length === 0 && <div className="empty">No data yet.</div>}
      {bars.map((b) => (
        <div className="chart__row" key={b.label}>
          <div className="chart__label" title={b.label}>{b.label}</div>
          <div className="chart__track">
            <div
              className="chart__fill"
              style={{ width: `${Math.round((b.value / max) * 100)}%`, background: b.color ?? "var(--dg-accent)" }}
            />
          </div>
          <div className="chart__val">{b.display ?? (formatValue ? formatValue(b.value) : String(b.value))}</div>
        </div>
      ))}
    </div>
  );
}
