import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/useRows';
import { SITE_URL } from '../lib/site';

const inviteLink = (token) => `${SITE_URL}/?invite=${token}`;

export default function Family({ family, user, onBack, onChanged, onLeft }) {
  const isOwner = family.role === 'owner';
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [name, setName] = useState(family.name);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fresh, setFresh] = useState(null); // the invite that was just created
  const [copied, setCopied] = useState(null);

  useEffect(() => { setName(family.name); setFresh(null); }, [family.id, family.name]);

  const load = useCallback(async () => {
    const { data: m, error: e1 } = await supabase.from('family_members')
      .select('user_id, role, joined_at, profiles ( display_name )')
      .eq('family_id', family.id).order('joined_at');
    if (e1) setError(e1.message);
    setMembers(m ?? []);
    if (isOwner) {
      const { data: i } = await supabase.from('family_invites').select('*')
        .eq('family_id', family.id).is('accepted_at', null)
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
      setInvites(i ?? []);
    }
  }, [family.id, isOwner]);
  useEffect(() => { load(); }, [load]);

  async function rename(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === family.name) return;
    const { error } = await supabase.from('families').update({ name: trimmed }).eq('id', family.id);
    if (error) setError(error.message); else { setError(null); onChanged(); }
  }

  async function invite(e) {
    e.preventDefault();
    setBusy(true); setError(null); setFresh(null);
    const { data, error } = await supabase.from('family_invites')
      .insert({ family_id: family.id, email: email.trim() || null }).select().single();
    if (error) { setError(error.message); setBusy(false); return; }
    // The function emails the link when email sending is set up; we show the link either way.
    const { data: res } = await supabase.functions.invoke('send-invite', { body: { invite_id: data.id } });
    setFresh({ link: res?.link ?? inviteLink(data.token), emailed: !!res?.emailed, email: data.email });
    setEmail('');
    await load();
    setBusy(false);
  }

  async function revoke(id) {
    const { error } = await supabase.from('family_invites').delete().eq('id', id);
    if (error) setError(error.message); else load();
  }

  async function copy(text, key) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); }
    catch { setError('Couldn’t copy. Select the link and copy it by hand.'); }
  }

  async function removeMember(m) {
    const self = m.user_id === user.id;
    const who = m.profiles?.display_name ?? 'this person';
    const ok = confirm(self
      ? `Leave ${family.name}? You will stop seeing its pets and files.`
      : `Remove ${who} from ${family.name}? They will stop seeing its pets and files.`);
    if (!ok) return;
    const { error, count } = await supabase.from('family_members').delete({ count: 'exact' })
      .eq('family_id', family.id).eq('user_id', m.user_id);
    if (error) return setError(error.message);
    if (!count) return setError('A family needs at least one owner, so the last owner can’t leave.');
    if (self) onLeft(); else load();
  }

  const owners = members.filter((m) => m.role === 'owner').length;

  return (
    <div className="stack-lg">
      <p><button className="link" onClick={onBack}>Back to my pets</button></p>
      <section className="panel">
        <h1 className="page-title">{family.name}</h1>
        <p className="muted">Everyone in this family can see and edit its pets, records, and files.</p>
        {isOwner && (
          <form className="inline-form" onSubmit={rename}>
            <label><span>Family name</span>
              <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
            <button className="ghost" disabled={!name.trim() || name.trim() === family.name}>Rename</button>
          </form>
        )}
        {error && <p className="note err" role="alert">{error}</p>}
      </section>

      <section className="panel">
        <h2>People</h2>
        <ul className="rows">
          {members.map((m) => (
            <li key={m.user_id}>
              <span>
                <strong>{m.profiles?.display_name ?? 'Family member'}</strong>
                {m.user_id === user.id && <span className="muted"> (you)</span>}{' '}
                <span className={`chip ${m.role}`}>{m.role}</span>
                <span className="muted small"> · joined {fmtDate(m.joined_at.slice(0, 10))}</span>
              </span>
              {m.user_id === user.id
                ? (m.role === 'owner' && owners < 2
                    ? <span className="muted small">Only owner</span>
                    : <button className="link danger" onClick={() => removeMember(m)}>Leave family</button>)
                : isOwner && <button className="link danger" onClick={() => removeMember(m)}>Remove</button>}
            </li>
          ))}
        </ul>
      </section>

      {isOwner ? (
        <section className="panel">
          <h2>Invite someone</h2>
          <p className="muted">Create a link and send it to them. It works once and expires in 14 days. They’ll sign in or create an account, then confirm they want to join.</p>
          <form className="inline-form" onSubmit={invite}>
            <label><span>Their email (optional, to send the link for you)</span>
              <input type="email" value={email} placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} /></label>
            <button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create invite link'}</button>
          </form>

          {fresh && (
            <div className="note ok" role="status">
              <p>
                {fresh.emailed ? `Invite emailed to ${fresh.email}. ` : fresh.email ? 'We couldn’t email it, so send this link yourself. ' : 'Send this link to the person you’re inviting. '}
              </p>
              <div className="linkbox">
                <input readOnly value={fresh.link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
                <button className="primary" onClick={() => copy(fresh.link, 'fresh')}>{copied === 'fresh' ? 'Copied' : 'Copy link'}</button>
              </div>
            </div>
          )}

          {invites.length > 0 && (
            <>
              <h3>Waiting to be accepted</h3>
              <ul className="rows">
                {invites.map((i) => (
                  <li key={i.id}>
                    <span>{i.email ?? 'Link only'} <span className="muted small">· expires {fmtDate(i.expires_at.slice(0, 10))}</span></span>
                    <span className="actions">
                      <button className="link" onClick={() => copy(inviteLink(i.token), i.id)}>{copied === i.id ? 'Copied' : 'Copy link'}</button>
                      <button className="link danger" onClick={() => revoke(i.id)}>Cancel</button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : (
        <p className="muted">Only owners can invite people or remove them.</p>
      )}
    </div>
  );
}
