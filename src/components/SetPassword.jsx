import { useState } from 'react';
import { supabase } from '../lib/supabase';

// Used for both "I followed a reset link" and "Change password" while signed in.
export default function SetPassword({ onDone, title = 'Choose a new password', doneLabel = 'Continue' }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [saved, setSaved] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) return setMsg({ ok: false, text: 'The two passwords don’t match.' });
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setSaved(true);
    setMsg({ ok: true, text: 'Your password is updated.' });
  }

  return (
    <section className="panel narrow">
      <h2>{title}</h2>
      {!saved && (
        <form onSubmit={submit} className="stack">
          <label><span>New password</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} /></label>
          <label><span>Confirm new password</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} /></label>
          <p className="muted small">Use at least 8 characters.</p>
          <div className="cta-row">
            <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
            <button type="button" className="ghost" onClick={onDone}>Cancel</button>
          </div>
        </form>
      )}
      {msg && <p className={msg.ok ? 'note ok' : 'note err'} role="status">{msg.text}</p>}
      {saved && <p><button className="primary" onClick={onDone}>{doneLabel}</button></p>}
    </section>
  );
}
