import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { SiteHeader, SiteFooter, Arch } from './Site';

const TABS = [['signin', 'Sign in'], ['signup', 'Create account'], ['magic', 'Email link']];

export default function Auth({ initialMode = 'signin', onHome }) {
  const [mode, setMode] = useState(initialMode); // signin | signup | magic | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const go = (m) => { setMode(m); setMsg(null); };

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    let error;
    if (mode === 'signin') {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    } else if (mode === 'signup') {
      let data;
      ({ data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: name || undefined }, emailRedirectTo: window.location.origin },
      }));
      if (!error && !data.session) setMsg({ ok: true, text: 'Check your email to confirm your account.' });
    } else if (mode === 'magic') {
      ({ error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }));
      if (!error) setMsg({ ok: true, text: 'Sign-in link sent. Check your email.' });
    } else {
      ({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }));
      if (!error) setMsg({ ok: true, text: 'If an account exists for that email, a reset link is on its way. It can take a minute to arrive.' });
    }
    if (error) setMsg({ ok: false, text: error.message });
    setBusy(false);
  }

  const heading = mode === 'reset' ? 'Reset your password' : mode === 'signup' ? 'Create your account' : 'Welcome back';

  return (
    <div className="site">
      <SiteHeader onHome={onHome}>
        <button className="ghost" onClick={onHome}>Back to home</button>
      </SiteHeader>

      <main className="wrap auth-page">
        <section className="auth-card">
          <h1>{heading}</h1>

          {mode !== 'reset' ? (
            <div className="seg" role="tablist">
              {TABS.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => go(k)}>{label}</button>
              ))}
            </div>
          ) : (
            <p className="muted">Enter your email and we’ll send you a link to choose a new password.</p>
          )}

          <form onSubmit={submit} className="stack">
            {mode === 'signup' && (
              <label><span>Your name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            )}
            <label><span>Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            {(mode === 'signin' || mode === 'signup') && (
              <label><span>Password</span>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
            )}
            <button className="primary" disabled={busy}>
              {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'magic' ? 'Send sign-in link' : 'Send reset link'}
            </button>
          </form>

          {mode === 'signin' && <p className="auth-alt"><button className="link" onClick={() => go('reset')}>Forgot your password?</button></p>}
          {mode === 'reset' && <p className="auth-alt"><button className="link" onClick={() => go('signin')}>Back to sign in</button></p>}
          {msg && <p className={msg.ok ? 'note ok' : 'note err'} role="status">{msg.text}</p>}
        </section>

        <Arch src="/jean-grey.jpg" className="auth-arch"
          alt="Jean Grey, a gray and black puppy with an ice-blue eye and a purple heart tag" />
      </main>

      <SiteFooter />
    </div>
  );
}
