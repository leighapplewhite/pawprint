import { useRows, fmtDate } from '../lib/useRows';
import AddForm from './AddForm';

export default function Food({ pet }) {
  const { rows, loading, error, add, remove } = useRows('food_logs', pet.id, 'started_on', false);
  const current = rows.filter((r) => !r.ended_on);

  return (
    <div className="stack-lg">
      <section className="panel">
        <h2>Food</h2>
        {current.length > 0 && (
          <p className="big">Eating now: <strong>{current.map((c) => `${c.brand}${c.product ? ' ' + c.product : ''}`).join(', ')}</strong></p>
        )}
        {!loading && rows.length === 0 && <p className="empty">Track what {pet.name} eats and how it goes down.</p>}
        <ul className="rows">
          {rows.map((r) => (
            <li key={r.id}>
              <span>
                <strong>{r.brand}</strong>{r.product && ` ${r.product}`} · {fmtDate(r.started_on)} to {r.ended_on ? fmtDate(r.ended_on) : 'now'}
                {r.daily_amount_g && <> · {r.daily_amount_g} g/day</>}
                {r.rating && <> · {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</>}
                {r.reaction_notes && <em> — {r.reaction_notes}</em>}
              </span>
              <button className="link" onClick={() => remove(r.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h3>Add a food</h3>
        <AddForm submitLabel="Save food" onSubmit={add} fields={[
          { name: 'brand', label: 'Brand', required: true },
          { name: 'product', label: 'Product' },
          { name: 'started_on', label: 'Started', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
          { name: 'ended_on', label: 'Stopped', type: 'date' },
          { name: 'daily_amount_g', label: 'Grams per day', type: 'number' },
          { name: 'rating', label: 'Rating', options: [['5', '5 – loves it'], ['4', '4'], ['3', '3'], ['2', '2'], ['1', '1 – refuses it']] },
          { name: 'reaction_notes', label: 'Reactions, allergies, stool, coat…', type: 'textarea', wide: true },
        ]} />
        {error && <p className="note err">{error}</p>}
      </section>
    </div>
  );
}
