import { useRows, fmtDate } from '../lib/useRows';
import AddForm from './AddForm';

function dueState(due) {
  if (!due) return { cls: 'none', label: 'No due date' };
  const days = Math.round((new Date(due + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return { cls: 'overdue', label: `Overdue by ${-days} day${days === -1 ? '' : 's'}` };
  if (days <= 30) return { cls: 'soon', label: days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}` };
  return { cls: 'ok', label: `Due ${fmtDate(due)}` };
}

export default function Health({ pet }) {
  const vax = useRows('vaccinations', pet.id, 'administered_on', false);
  const events = useRows('medical_events', pet.id, 'event_on', false);

  return (
    <div className="stack-lg">
      <section className="panel">
        <h2>Vaccinations</h2>
        {!vax.loading && vax.rows.length === 0 && <p className="empty">No vaccines logged yet. Add the first one below.</p>}
        <div className="stamps">
          {vax.rows.map((v) => {
            const s = dueState(v.next_due_on);
            return (
              <article key={v.id} className={`stamp ${s.cls}`}>
                <h3>{v.name}</h3>
                <p>Given {fmtDate(v.administered_on)}</p>
                <p className="status">{s.label}</p>
                {v.vet_name && <p className="muted">{v.vet_name}</p>}
                <button className="link" onClick={() => vax.remove(v.id)}>Delete</button>
              </article>
            );
          })}
        </div>
        <h3>Add a vaccination</h3>
        <AddForm submitLabel="Save vaccination" onSubmit={vax.add} fields={[
          { name: 'name', label: 'Vaccine', required: true, placeholder: 'Rabies' },
          { name: 'administered_on', label: 'Given on', type: 'date', required: true },
          { name: 'next_due_on', label: 'Next due', type: 'date' },
          { name: 'vet_name', label: 'Vet or clinic' },
          { name: 'lot_number', label: 'Lot number' },
        ]} />
        {vax.error && <p className="note err">{vax.error}</p>}
      </section>

      <section className="panel">
        <h2>Surgeries, illnesses, and visits</h2>
        {!events.loading && events.rows.length === 0 && <p className="empty">Nothing recorded yet.</p>}
        <ul className="rows">
          {events.rows.map((e) => (
            <li key={e.id}>
              <span>
                <span className={`chip ${e.kind}`}>{e.kind}</span> <strong>{e.title}</strong> · {fmtDate(e.event_on)}
                {e.vet_name && <> · {e.vet_name}</>}
                {e.cost_cents != null && <> · ${(e.cost_cents / 100).toFixed(2)}</>}
                {e.notes && <em> — {e.notes}</em>}
              </span>
              <button className="link" onClick={() => events.remove(e.id)}>Delete</button>
            </li>
          ))}
        </ul>
        <h3>Add an event</h3>
        <AddForm submitLabel="Save event"
          onSubmit={(v) => events.add({ ...v, cost_cents: v.cost_dollars ? Math.round(Number(v.cost_dollars) * 100) : null, cost_dollars: undefined })}
          fields={[
            { name: 'kind', label: 'Type', required: true, default: 'checkup', options: ['checkup', 'surgery', 'illness', 'injury', 'dental', 'other'] },
            { name: 'title', label: 'What happened', required: true, placeholder: 'Annual exam' },
            { name: 'event_on', label: 'Date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
            { name: 'vet_name', label: 'Vet or clinic' },
            { name: 'cost_dollars', label: 'Cost ($)', type: 'number', step: '0.01' },
            { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
          ]} />
        {events.error && <p className="note err">{events.error}</p>}
      </section>
    </div>
  );
}
