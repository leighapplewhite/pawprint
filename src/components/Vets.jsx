import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Vets() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [saved, setSaved] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadSaved = useCallback(async () => {
    const { data } = await supabase.from('saved_vets').select('*').order('created_at', { ascending: false });
    setSaved(data ?? []);
  }, []);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  async function search(body) {
    setBusy(true); setError(null);
    const { data, error } = await supabase.functions.invoke('vet-search', { body });
    if (error || data?.error) setError(data?.error ?? 'Search failed. Try again.');
    else setResults(data.results);
    setBusy(false);
  }

  const useMyLocation = () =>
    navigator.geolocation.getCurrentPosition(
      (p) => search({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError('Location access was blocked. Type a city or ZIP code instead.'),
    );

  async function save(v) {
    const { error } = await supabase.from('saved_vets').upsert(
      { name: v.name, address: v.address, phone: v.phone, website: v.website, osm_ref: v.osm_ref, lat: v.lat, lng: v.lng },
      { onConflict: 'owner_id,osm_ref', ignoreDuplicates: true },
    );
    if (error) setError(error.message); else loadSaved();
  }

  async function unsave(id) {
    await supabase.from('saved_vets').delete().eq('id', id);
    loadSaved();
  }

  const savedRefs = new Set(saved.map((s) => s.osm_ref));

  return (
    <div className="stack-lg">
      <section className="panel">
        <h2>Find a vet</h2>
        <form className="searchbar" onSubmit={(e) => { e.preventDefault(); query.trim() && search({ location: query }); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="City, ZIP code, or address" aria-label="Location" />
          <button className="primary" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
          <button type="button" className="ghost" onClick={useMyLocation} disabled={busy}>Use my location</button>
        </form>
        {error && <p className="note err" role="alert">{error}</p>}
        {results && results.length === 0 && <p className="empty">No clinics found in that area. Try a wider search or a nearby city.</p>}
        <ul className="rows">
          {(results ?? []).map((v) => (
            <li key={v.osm_ref}>
              <span>
                <strong>{v.name}</strong> · {v.distance_km} km
                {v.address && <><br /><span className="muted">{v.address}</span></>}
                {v.phone && <><br /><a href={`tel:${v.phone}`}>{v.phone}</a></>}
                {v.website && <> · <a href={v.website} target="_blank" rel="noreferrer">Website</a></>}
                {v.opening_hours && <><br /><span className="muted small">{v.opening_hours}</span></>}
              </span>
              <button className="ghost" disabled={savedRefs.has(v.osm_ref)} onClick={() => save(v)}>
                {savedRefs.has(v.osm_ref) ? 'Saved' : 'Save'}
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">Clinic data comes from OpenStreetMap contributors, so call ahead to confirm hours.</p>
      </section>

      <section className="panel">
        <h3>Your vets</h3>
        {saved.length === 0 && <p className="empty">Save clinics from the search results to keep them handy.</p>}
        <ul className="rows">
          {saved.map((v) => (
            <li key={v.id}>
              <span><strong>{v.name}</strong>{v.address && <><br /><span className="muted">{v.address}</span></>}{v.phone && <><br /><a href={`tel:${v.phone}`}>{v.phone}</a></>}</span>
              <button className="link" onClick={() => unsave(v.id)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
