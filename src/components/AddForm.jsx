import { useState } from 'react';

const initial = (fields) => Object.fromEntries(fields.map((f) => [f.name, f.default ?? '']));

// Small generic form. fields: [{ name, label, type, options, required, step, wide, placeholder, default }]
export default function AddForm({ fields, onSubmit, submitLabel = 'Save' }) {
  const [values, setValues] = useState(() => initial(fields));
  const [busy, setBusy] = useState(false);
  const set = (name, value) => setValues((s) => ({ ...s, [name]: value }));

  async function handle(e) {
    e.preventDefault();
    setBusy(true);
    const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? null : v]));
    const ok = await onSubmit(clean);
    if (ok !== false) setValues(initial(fields));
    setBusy(false);
  }

  return (
    <form className="addform" onSubmit={handle}>
      {fields.map((f) => (
        <label key={f.name} className={f.wide ? 'wide' : ''}>
          <span>{f.label}</span>
          {f.options ? (
            <select value={values[f.name]} required={f.required} onChange={(e) => set(f.name, e.target.value)}>
              {!f.required && <option value="">—</option>}
              {f.options.map((o) => {
                const [value, label] = Array.isArray(o) ? o : [o, o];
                return <option key={value} value={value}>{label}</option>;
              })}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea rows={2} value={values[f.name]} placeholder={f.placeholder}
              onChange={(e) => set(f.name, e.target.value)} />
          ) : (
            <input type={f.type ?? 'text'} step={f.step} required={f.required} placeholder={f.placeholder}
              value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} />
          )}
        </label>
      ))}
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
    </form>
  );
}
