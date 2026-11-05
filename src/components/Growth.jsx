import { useState } from 'react';
import { useRows, fmtDate } from '../lib/useRows';
import AddForm from './AddForm';

const KG_TO_LB = 2.20462;

function Chart({ points, unit }) {
  if (points.length < 2) return <p className="empty">Add at least two weigh-ins to see the growth curve.</p>;
  const W = 640, H = 220, P = { l: 44, r: 16, t: 16, b: 28 };
  const xs = points.map((p) => new Date(p.measured_on).getTime());
  const ys = points.map((p) => p.value);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const y1 = Math.max(...ys) * 1.1;
  const sx = (x) => P.l + ((x - x0) / (x1 - x0 || 1)) * (W - P.l - P.r);
  const sy = (y) => H - P.b - (y / y1) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join(' ');
  const ticks = [0, 0.5, 1].map((t) => t * y1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
      aria-label={`Weight over time, from ${ys[0].toFixed(1)} to ${ys.at(-1).toFixed(1)} ${unit}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} className="grid" />
          <text x={P.l - 8} y={sy(t) + 4} textAnchor="end" className="axis">{t.toFixed(0)}</text>
        </g>
      ))}
      <path d={path} className="line" />
      {points.map((p, i) => <circle key={p.id} cx={sx(xs[i])} cy={sy(ys[i])} r="4" className="dot"><title>{`${fmtDate(p.measured_on)}: ${p.value.toFixed(1)} ${unit}`}</title></circle>)}
      <text x={P.l} y={H - 6} className="axis">{fmtDate(points[0].measured_on)}</text>
      <text x={W - P.r} y={H - 6} textAnchor="end" className="axis">{fmtDate(points.at(-1).measured_on)}</text>
    </svg>
  );
}

export default function Growth({ pet }) {
  const { rows, loading, error, add, remove } = useRows('weight_entries', pet.id, 'measured_on', true);
  const [unit, setUnit] = useState('kg');
  const factor = unit === 'kg' ? 1 : KG_TO_LB;
  const points = rows.map((r) => ({ ...r, value: Number(r.weight_kg) * factor }));
  const latest = points.at(-1);

  return (
    <div className="stack-lg">
      <section className="panel">
        <div className="panel-head">
          <h2>Growth</h2>
          <div className="seg small">
            {['kg', 'lb'].map((u) => <button key={u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>{u}</button>)}
          </div>
        </div>
        {latest && <p className="big">{latest.value.toFixed(1)} <small>{unit} on {fmtDate(latest.measured_on)}</small></p>}
        {loading ? <p className="empty">Loading…</p> : <Chart points={points} unit={unit} />}
      </section>

      <section className="panel">
        <h3>Log a weigh-in</h3>
        <AddForm submitLabel="Save weigh-in" onSubmit={(v) => add({ ...v, weight_kg: unit === 'kg' ? v.weight_kg : (Number(v.weight_kg) / KG_TO_LB).toFixed(2) })}
          fields={[
            { name: 'measured_on', label: 'Date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
            { name: 'weight_kg', label: `Weight (${unit})`, type: 'number', step: '0.01', required: true },
            { name: 'notes', label: 'Notes', wide: true },
          ]} />
        {error && <p className="note err">{error}</p>}
      </section>

      {rows.length > 0 && (
        <section className="panel">
          <h3>History</h3>
          <ul className="rows">
            {[...rows].reverse().map((r) => (
              <li key={r.id}>
                <span><strong>{(Number(r.weight_kg) * factor).toFixed(1)} {unit}</strong> · {fmtDate(r.measured_on)}{r.notes && <em> — {r.notes}</em>}</span>
                <button className="link" onClick={() => remove(r.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
