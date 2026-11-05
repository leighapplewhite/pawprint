import { useState } from 'react';
import { useRows, fmtDate } from '../lib/useRows';
import { uploadPetFile } from '../lib/files';
import AddForm from './AddForm';

// "Golden Retriever 62\nLabrador 25.5%" -> [{ breed, percent }]
function parseBreakdown(text) {
  return (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^(.*?)[\s:,-]+(\d+(?:\.\d+)?)\s*%?$/);
    return m ? { breed: m[1].trim(), percent: Number(m[2]) } : null;
  }).filter(Boolean);
}

export default function Dna({ pet, user }) {
  const { rows, loading, error, add, remove } = useRows('dna_results', pet.id, 'created_at', false);
  const [file, setFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  async function save(v) {
    setUploadError(null);
    let document_id = null;
    if (file) {
      const { document, error } = await uploadPetFile({ user, pet, file, category: 'dna_result', caption: `${v.provider} DNA report` });
      if (error) { setUploadError(error); return false; }
      document_id = document.id;
    }
    const ok = await add({
      provider: v.provider, tested_on: v.tested_on, health_notes: v.health_notes,
      breed_breakdown: parseBreakdown(v.breakdown), document_id,
    });
    if (ok) setFile(null);
    return ok;
  }

  return (
    <div className="stack-lg">
      <section className="panel">
        <h2>DNA results</h2>
        {!loading && rows.length === 0 && <p className="empty">Add a breed or health test from Embark, Wisdom Panel, or another provider.</p>}
        {rows.map((r) => (
          <article key={r.id} className="dna">
            <header>
              <h3>{r.provider}{r.tested_on && <small> · tested {fmtDate(r.tested_on)}</small>}</h3>
              <button className="link" onClick={() => remove(r.id)}>Delete</button>
            </header>
            {r.breed_breakdown.map((b) => (
              <div key={b.breed} className="bar">
                <span>{b.breed}</span>
                <div className="track"><div className="fill" style={{ width: `${Math.min(b.percent, 100)}%` }} /></div>
                <span>{b.percent}%</span>
              </div>
            ))}
            {r.health_notes && <p className="muted">{r.health_notes}</p>}
            {r.document_id && <p className="muted small">Original report saved in Files.</p>}
          </article>
        ))}
      </section>

      <section className="panel">
        <h3>Add a DNA result</h3>
        <label className="filefield"><span>Report file (PDF, CSV, ZIP, or image)</span>
          <input type="file" accept=".pdf,.csv,.txt,.json,.zip,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <AddForm submitLabel="Save DNA result" onSubmit={save} fields={[
          { name: 'provider', label: 'Provider', required: true, default: 'Embark', options: ['Embark', 'Wisdom Panel', 'Basepaws', 'Other'] },
          { name: 'tested_on', label: 'Test date', type: 'date' },
          { name: 'breakdown', label: 'Breed breakdown, one per line (e.g. Labrador 42.5)', type: 'textarea', wide: true },
          { name: 'health_notes', label: 'Health findings', type: 'textarea', wide: true },
        ]} />
        {(error || uploadError) && <p className="note err">{uploadError ?? error}</p>}
      </section>
    </div>
  );
}
