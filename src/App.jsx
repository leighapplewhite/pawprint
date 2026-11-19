import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { ageLabel } from './lib/useRows';
import Landing from './components/Landing';
import Auth from './components/Auth';
import SetPassword from './components/SetPassword';
import { SiteHeader, SiteFooter } from './components/Site';
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
  const [recovery, setRecovery] = useState(false);
  const [view, setView] = useState({ name: 'landing' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { setRecovery(false); setView({ name: 'landing' }); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <p className="loading">Loading…</p>;

  // Arrived from a "reset password" email.
  if (session && recovery) {
    return (
      <div className="site">
        <SiteHeader onHome={() => setRecovery(false)} />
        <main className="wrap app"><SetPassword onDone={() => setRecovery(false)} /></main>
        <SiteFooter />
      </div>
    );
  }

  if (!session) {
    return view.name === 'auth'
      ? <Auth initialMode={view.mode} onHome={() => setView({ name: 'landing' })} />
      : <Landing onStart={(mode) => setView({ name: 'auth', mode })} />;
  }

  return <Home user={session.user} />;
}

function Home({ user }) {
  const [pets, setPets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState('growth');
  const [page, setPage] = useState('pets'); // pets | password
  const [avatar, setAvatar] = useState(null);
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

  // The most recent photo uploaded for this pet becomes their portrait.
  useEffect(() => {
    if (!pet) { setAvatar(null); return; }
    let live = true;
    (async () => {
      const { data } = await supabase.from('documents').select('bucket, storage_path')
        .eq('pet_id', pet.id).eq('category', 'photo').order('created_at', { ascending: false }).limit(1);
      if (!data?.length) { if (live) setAvatar(null); return; }
      const { data: signed } = await supabase.storage.from(data[0].bucket).createSignedUrl(data[0].storage_path, 3600);
      if (live) setAvatar(signed?.signedUrl ?? null);
    })();
    return () => { live = false; };
  }, [pet?.id, tab]);

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
    <div className="site">
      <SiteHeader onHome={() => setPage('pets')}>
        <span className="muted small hide-sm">{user.email}</span>
        <button className="link" onClick={() => setPage(page === 'password' ? 'pets' : 'password')}>Change password</button>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </SiteHeader>

      <main className="wrap app">
        {error && <p className="note err" role="alert">{error}</p>}

        {page === 'password' ? (
          <SetPassword title="Change your password" doneLabel="Back to my pets" onDone={() => setPage('pets')} />
        ) : (
          <>
            <nav className="petbar" aria-label="Your pets">
              {pets.map((p) => (
                <button key={p.id} className={`pill ${p.id === selectedId && !adding ? 'on' : ''}`}
                  onClick={() => { setSelectedId(p.id); setAdding(false); }}>{p.name}</button>
              ))}
              <button className={`pill add ${adding ? 'on' : ''}`} onClick={() => setAdding(true)}>+ Add a pet</button>
            </nav>

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
                  <div className="arch avatar">
                    {avatar ? <img src={avatar} alt={`${pet.name}`} /> : <span aria-hidden="true">{pet.name[0]}</span>}
                  </div>
                  <div className="passport-info">
                    <h1>{pet.name}</h1>
                    <p>{[pet.breed, pet.sex !== 'unknown' && pet.sex, ageLabel(pet.birthdate)].filter(Boolean).join(', ')}</p>
                    {pet.microchip_id && <p className="muted small">Microchip {pet.microchip_id}</p>}
                    {!avatar && <p className="muted small">Upload a photo on the Files tab and it will show up here.</p>}
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
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
