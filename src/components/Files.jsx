import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRows, fmtDate } from '../lib/useRows';
import { uploadPetFile, deletePetFile, signedUrlsFor, prettySize } from '../lib/files';

const CATEGORIES = [
  ['photo', 'Photo'], ['vaccine_record', 'Vaccine record'], ['lab_result', 'Lab result'],
  ['dna_result', 'DNA result'], ['insurance', 'Insurance'], ['other', 'Other'],
];
const label = (c) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c;

export default function Files({ pet, user }) {
  const { rows, loading, reload } = useRows('documents', pet.id, 'created_at', false);
  const [urls, setUrls] = useState({});
  const [category, setCategory] = useState('photo');
  const [caption, setCaption] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [share, setShare] = useState(null);

  useEffect(() => { signedUrlsFor(rows).then(setUrls); }, [rows]);

  async function onFiles(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setError(null);
    for (const file of files) {
      const { error } = await uploadPetFile({ user, pet, file, category, caption });
      if (error) { setError(`${file.name}: ${error}`); break; }
    }
    setCaption('');
    await reload();
    setBusy(false);
  }

  async function remove(doc) {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    const { error } = await deletePetFile(doc);
    if (error) setError(error); else reload();
  }

  async function makeShareLink(doc) {
    setShare({ id: doc.id, loading: true });
    const { data, error } = await supabase.functions.invoke('share-link', { body: { document_id: doc.id, expires_in_hours: 48 } });
    if (error || data?.error) { setShare(null); setError(data?.error ?? error.message); return; }
    setShare({ id: doc.id, url: data.url, expires_at: data.expires_at });
  }

  const shown = rows.filter((r) => filter === 'all' || r.category === filter);

  return (
    <div className="stack-lg">
      <section className="panel">
        <h2>Photos and files</h2>
        <div className="uploader">
          <label><span>Type</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          <label><span>Caption</span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional" /></label>
          <label className="filebtn">
            <input type="file" multiple hidden disabled={busy}
              accept={category === 'photo' ? 'image/*' : '.pdf,.csv,.txt,.json,.zip,image/*'} onChange={onFiles} />
            <span className="primary">{busy ? 'Uploading…' : 'Choose files'}</span>
          </label>
        </div>
        <p className="muted small">Photos up to 10 MB. Other files up to 25 MB (PDF, image, CSV, TXT, JSON, ZIP). Only you can see them.</p>
        {error && <p className="note err" role="alert">{error}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{shown.length} item{shown.length === 1 ? '' : 's'}</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by type">
            <option value="all">All types</option>
            {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {!loading && shown.length === 0 && <p className="empty">Nothing here yet. Upload a photo or a vaccine certificate above.</p>}
        <div className="gallery">
          {shown.map((d) => (
            <figure key={d.id} className="file">
              {d.mime_type?.startsWith('image/') && urls[d.storage_path]
                ? <img src={urls[d.storage_path]} alt={d.caption || d.file_name} loading="lazy" />
                : <div className="docicon" aria-hidden="true">{d.file_name.split('.').pop()?.toUpperCase().slice(0, 4)}</div>}
              <figcaption>
                <strong title={d.file_name}>{d.caption || d.file_name}</strong>
                <span className="muted small">{label(d.category)} · {prettySize(d.size_bytes ?? 0)} · {fmtDate(d.created_at.slice(0, 10))}</span>
                <span className="actions">
                  {urls[d.storage_path] && <a href={urls[d.storage_path]} target="_blank" rel="noreferrer">Open</a>}
                  <button className="link" onClick={() => makeShareLink(d)}>Share link</button>
                  <button className="link danger" onClick={() => remove(d)}>Delete</button>
                </span>
                {share?.id === d.id && (
                  share.loading ? <span className="muted small">Making link…</span> : (
                    <span className="sharebox">
                      <input readOnly value={share.url} onFocus={(e) => e.target.select()} aria-label="Share link" />
                      <button className="link" onClick={() => navigator.clipboard.writeText(share.url)}>Copy</button>
                      <span className="muted small">Works until {new Date(share.expires_at).toLocaleString()}</span>
                    </span>
                  )
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
