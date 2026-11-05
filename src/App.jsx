import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { ageLabel } from './lib/useRows';
import Auth from './components/Auth';
import AddForm from './components/AddForm';
import Growth from './components/Growth';
import Health from './components/Health';
import Food from './components/Food';
import Files from './components/Files';
import Dna from './components/Dna';
import Vets from './components/Vets';

const TABS = [
  ['growth', 'Growth'], ['health', 'Health'], ['food', 'Food'],
  ['files', 'Files'], ['dna', 'DNA'], ['vets', 'Vets'],
];

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <p className="loading">Loading…</p>;
  if (!session) return <Auth />;
  return <Home user={session.user} />;
}

function Home({ user }) {
  const [pets, setPets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState('growth');
  const [error, setError] = useState(null);

  const loadPets = useCallback(async () => {
    const { data, error } = await supabase.from('pets').select('*').order('created_at');
    if (error) setError(error.message);
    setPets(data ?? []);
    setSelectedId((cur) => cur ?? data?.[0]?.id ?? null);
    if (!data?.length) setAdding(true);
  }, []);
  useEffect(() => { loadPets(); }, [loadPets]);

  const pet = pets.find((p) => p.id === selectedId);

  async function addPet(values) {
    const { data, error } = await supabase.from('pets').insert(values).select().single();
    if (error) { setError(error.message); return false; }
    setError(null);
    await loadPets();
    setSelectedId(data.id);
    setAdding(false);
    return true;
  }

  async function removePet() {
    if (!confirm(`Delete ${pet.name} and all of their records? Uploaded files stay in storage until you delete them from Files.`)) return;
    const { error } = await supabase.from('pets').delete().eq('id', pet.id);
    if (error) return setError(error.message);
    setSelectedId(null);
    setAdding(false);
    loadPets();
  }

  return (
    <div className="shell">
      <aside className="side">
        <h1 className="brand">Pawprint</h1>
        <nav aria-label="Your pets">
          {pets.map((p) => (
            <button key={p.id} className={`tag ${p.id === selectedId && !adding ? 'on' : ''}`}
              onClick={() => { setSelectedId(p.id); setAdding(false); }}>
              <span className="disc" aria-hidden="true">{p.name[0]?.toUpperCase()}</span>{p.name}
            </button>
          ))}
          <button className={`tag add ${adding ? 'on' : ''}`} onClick={() => setAdding(true)}>
            <span className="disc" aria-hidden="true">+</span>Add a pet
          </button>
        </nav>
        <div className="side-foot">
          <span className="muted small">{user.email}</span>
          <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </aside>

      <main className="main">
        {error && <p className="note err" role="alert">{error}</p>}

        {adding || !pet ? (
          <section className="panel narrow">
            <h2>Add a pet</h2>
            <AddForm submitLabel="Save pet" onSubmit={addPet} fields={[
              { name: 'name', label: 'Name', required: true },
              { name: 'species', label: 'Species', required: true, default: 'dog', options: ['dog', 'cat', 'other'] },
              { name: 'breed', label: 'Breed' },
              { name: 'sex', label: 'Sex', required: true, default: 'unknown', options: ['female', 'male', 'unknown'] },
              { name: 'birthdate', label: 'Birthday', type: 'date' },
              { name: 'microchip_id', label: 'Microchip number' },
            ]} />
          </section>
        ) : (
          <>
            <header className="passport">
              <div className="photo-disc" aria-hidden="true">{pet.name[0]}</div>
              <div>
                <h2>{pet.name}</h2>
                <p>{[pet.breed, pet.sex !== 'unknown' && pet.sex, ageLabel(pet.birthdate)].filter(Boolean).join(' · ')}</p>
                {pet.microchip_id && <p className="muted small">Microchip {pet.microchip_id}</p>}
              </div>
              <button className="link danger" onClick={removePet}>Delete pet</button>
            </header>

            <div className="tabs" role="tablist">
              {TABS.map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            {tab === 'growth' && <Growth pet={pet} />}
            {tab === 'health' && <Health pet={pet} />}
            {tab === 'food' && <Food pet={pet} />}
            {tab === 'files' && <Files pet={pet} user={user} />}
            {tab === 'dna' && <Dna pet={pet} user={user} />}
            {tab === 'vets' && <Vets />}
          </>
        )}
      </main>
    </div>
  );
}
