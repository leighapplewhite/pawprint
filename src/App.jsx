import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { ageLabel } from './lib/useRows';
import { UserContext } from './lib/user';
import Byline from './components/Byline';
import Landing from './components/Landing';
import Auth from './components/Auth';
import SetPassword from './components/SetPassword';
import JoinInvite from './components/JoinInvite';
import Family from './components/Family';
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

// localStorage can be blocked (private mode, strict settings), so never let it throw.
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export default function App() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);
  // An invite link looks like https://site/?invite=<token>. Remember it through sign-up and sign-in.
  const [inviteToken, setInviteToken] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('invite');
    if (fromUrl) {
      store.set('pawprint_invite', fromUrl);
      window.history.replaceState(null, '', window.location.pathname);
    }
    return store.get('pawprint_invite');
  });
  const [view, setView] = useState(inviteToken ? { name: 'auth', mode: 'signup' } : { name: 'landing' });

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
      ? <Auth initialMode={view.mode} invited={!!inviteToken} onHome={() => setView({ name: 'landing' })} />
      : <Landing onStart={(mode) => setView({ name: 'auth', mode })} />;
  }

  if (inviteToken) {
    const finish = (familyId) => {
      if (familyId) store.set('pawprint_family', familyId);
      store.set('pawprint_invite', null);
      setInviteToken(null);
    };
    return (
      <div className="site">
        <SiteHeader onHome={() => finish(null)} />
        <main className="wrap app"><JoinInvite token={inviteToken} onDone={finish} /></main>
        <SiteFooter />
      </div>
    );
  }

  return <Home user={session.user} />;
}

function Home({ user }) {
  const [families, setFamilies] = useState([]);
  const [familyId, setFamilyId] = useState(null);
  const [pets, setPets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState('growth');
  const [page, setPage] = useState('pets'); // pets | password | family
  const [avatar, setAvatar] = useState(null);
  const [error, setError] = useState(null);

  const loadFamilies = useCallback(async () => {
    const { data, error } = await supabase.from('family_members')
      .select('role, families ( id, name )').eq('user_id', user.id);
    if (error) setError(error.message);
    const list = (data ?? []).filter((r) => r.families)
      .map((r) => ({ id: r.families.id, name: r.families.name, role: r.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setFamilies(list);
    setFamilyId((cur) => {
      const want = cur ?? store.get('pawprint_family');
      return list.some((f) => f.id === want) ? want : list[0]?.id ?? null;
    });
  }, [user.id]);
  useEffect(() => { loadFamilies(); }, [loadFamilies]);
  useEffect(() => { if (familyId) store.set('pawprint_family', familyId); }, [familyId]);

  const loadPets = useCallback(async () => {
    if (!familyId) { setPets([]); return; }
    const { data, error } = await supabase.from('pets').select('*, author:profiles!owner_id ( display_name )')
      .eq('family_id', familyId).order('created_at');
    if (error) setError(error.message);
    const list = data ?? [];
    setPets(list);
    setSelectedId((cur) => (list.some((p) => p.id === cur) ? cur : list[0]?.id ?? null));
    setAdding(list.length === 0);
  }, [familyId]);
  useEffect(() => { loadPets(); }, [loadPets]);

  const family = families.find((f) => f.id === familyId);
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
    const { data, error } = await supabase.from('pets').insert({ ...values, family_id: familyId }).select().single();
    if (error) { setError(error.message); return false; }
    setError(null);
    await loadPets();
    setSelectedId(data.id);
    setAdding(false);
    return true;
  }

  async function removePet() {
    if (!confirm(`Delete ${pet.name} and all of their records for everyone in ${family?.name ?? 'this family'}? Uploaded files stay in storage until you delete them from Files.`)) return;
    const { error } = await supabase.from('pets').delete().eq('id', pet.id);
    if (error) return setError(error.message);
    setSelectedId(null);
    loadPets();
  }

  function switchFamily(id) {
    setFamilyId(id);
    setSelectedId(null);
    setAdding(false);
    setPage('pets');
  }

  return (
    <UserContext.Provider value={user.id}>
    <div className="site">
      <SiteHeader onHome={() => setPage('pets')}>
        <span className="muted small hide-sm">{user.email}</span>
        <button className="link" onClick={() => setPage(page === 'password' ? 'pets' : 'password')}>Change password</button>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </SiteHeader>

      <main className="wrap app">
        {error && <p className="note err" role="alert">{error}</p>}

        {page === 'password' && (
          <SetPassword title="Change your password" doneLabel="Back to my pets" onDone={() => setPage('pets')} />
        )}

        {page === 'family' && family && (
          <Family family={family} user={user} onBack={() => setPage('pets')} onChanged={loadFamilies}
            onLeft={() => { setFamilyId(null); setPage('pets'); loadFamilies(); }} />
        )}

        {page === 'pets' && (
          <>
            <div className="familybar">
              {families.length > 1 ? (
                <label className="familypick"><span>Family</span>
                  <select value={familyId ?? ''} onChange={(e) => switchFamily(e.target.value)}>
                    {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select></label>
              ) : <strong className="familyname">{family?.name}</strong>}
              <button className="link" onClick={() => setPage('family')}>Family and sharing</button>
            </div>

            <nav className="petbar" aria-label="Pets in this family">
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
                    {avatar ? <img src={avatar} alt={pet.name} /> : <span aria-hidden="true">{pet.name[0]}</span>}
                  </div>
                  <div className="passport-info">
                    <h1>{pet.name}</h1>
                    <p>{[pet.breed, pet.sex !== 'unknown' && pet.sex, ageLabel(pet.birthdate)].filter(Boolean).join(', ')}</p>
                    {pet.microchip_id && <p className="muted small">Microchip {pet.microchip_id}</p>}
                    <Byline row={pet} />
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
    </UserContext.Provider>
  );
}
