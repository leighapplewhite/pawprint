import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const [mode, setMode] = useState('signin'); // signin | signup | magic
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    let error;
    if (mode === 'signin') {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    } else if (mode === 'signup') {
      let data;
      ({ data, error } = await supabase.auth.signUp({
        email, password, options: { data: { display_name: name || undefined }, emailRedirectTo: window.location.origin },
      }));
      if (!error && !data.session) setMsg({ ok: true, text: 'Check your email to confirm your account.' });
    } else {
      ({ error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }));
      if (!error) setMsg({ ok: true, text: 'Sign-in link sent. Check your email.' });
    }
    if (error) setMsg({ ok: false, text: error.message });
    setBusy(false);
  }

  return (
    <main className="auth">
      <section className="auth-card">
        <h1>Pawprint</h1>
        <p className="lede">Weights, vaccines, vet visits, food, and files for every pet, in one place.</p>

        <div className="seg" role="tablist">
          {[['signin', 'Sign in'], ['signup', 'Create account'], ['magic', 'Email link']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''}
              onClick={() => { setMode(k); setMsg(null); }}>{label}</button>
          ))}
        </div>

        <form onSubmit={submit} className="stack">
          {mode === 'signup' && (
            <label><span>Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          )}
          <label><span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          {mode !== 'magic' && (
            <label><span>Password</span>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
          )}
          <button className="primary" disabled={busy}>
            {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send sign-in link'}
          </button>
        </form>
        {msg && <p className={msg.ok ? 'note ok' : 'note err'} role="status">{msg.text}</p>}
      </section>
    </main>
  );
}
