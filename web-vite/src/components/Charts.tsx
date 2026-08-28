export interface BarDatum { label: string; value: number }

export function MiniBarChart({ data }: { data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="mini-bar-chart">
      {data.map((d) => (
        <div className="mini-bar-row" key={d.label}>
          <span>{d.label}</span>
          <div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: `${(d.value / max) * 100}%` }} /></div>
          <b>{d.value}</b>
        </div>
      ))}
    </div>
  );
}

export interface LinePoint { label: string; value: number }

// A hand-rolled SVG line chart — no charting library dependency, and the
// data passed in is always aggregated from real fetched records (never
// invented), per the "do not fake charts" requirement.
export function MiniLineChart({ data, height = 140 }: { data: LinePoint[]; height?: number }) {
  if (data.length === 0) return <p className="muted">No data yet.</p>;
  const width = Math.max(240, data.length * 40);
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = width / Math.max(1, data.length - 1 || 1);
  const points = data.map((d, i) => `${i * stepX},${height - (d.value / max) * (height - 20) - 10}`).join(" ");
  return (
    <div className="mini-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
        <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth={2} />
        {data.map((d, i) => (
          <circle key={d.label} cx={i * stepX} cy={height - (d.value / max) * (height - 20) - 10} r={3} fill="var(--primary)" />
        ))}
      </svg>
      <div className="mini-line-labels">{data.map((d) => <span key={d.label}>{d.label}</span>)}</div>
    </div>
  );
}
