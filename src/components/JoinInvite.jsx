import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Shown after someone opens an invite link and signs in.
export default function JoinInvite({ token, onDone }) {
  const [state, setState] = useState({ status: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    supabase.rpc('preview_family_invite', { invite_token: token }).then(({ data, error }) => {
      if (!live) return;
      if (error || !data?.length) setState({ status: 'invalid' });
      else setState({ status: 'ready', family: data[0].family_name, inviter: data[0].inviter_name });
    });
    return () => { live = false; };
  }, [token]);

  async function join() {
    setBusy(true);
    const { data, error } = await supabase.rpc('accept_family_invite', { invite_token: token });
    setBusy(false);
    if (error) setState({ status: 'invalid', message: error.message });
    else onDone(data);
  }

  if (state.status === 'loading') return <p className="loading">Checking your invite…</p>;

  if (state.status === 'invalid') {
    return (
      <section className="panel narrow">
        <h2>This invite can’t be used</h2>
        <p>{state.message ?? 'The link has expired or was already used.'} Ask the family owner to send you a new one.</p>
        <button className="primary" onClick={() => onDone(null)}>Continue to my pets</button>
      </section>
    );
  }

  return (
    <section className="panel narrow">
      <h2>Join {state.family}?</h2>
      <p>
        {state.inviter ?? 'Someone'} invited you to share pet records. If you join, you’ll be able to see
        and edit this family’s pets, health records, and files. You’ll keep your own family too.
      </p>
      <div className="cta-row">
        <button className="primary" onClick={join} disabled={busy}>{busy ? 'Joining…' : 'Join family'}</button>
        <button className="ghost" onClick={() => onDone(null)} disabled={busy}>Not now</button>
      </div>
    </section>
  );
}
