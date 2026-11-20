// send-invite: builds the invite link for a family invite and, if an email address was
// given and RESEND_API_KEY is set, emails it. The link is always returned so an owner
// can also copy and send it themselves.
// POST { invite_id: string }
//
// Runs as the CALLER (their JWT), so Row Level Security guarantees only a family owner
// can read the invite. Secrets: SITE_URL (optional), RESEND_API_KEY + INVITE_FROM (optional).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in to invite people.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { invite_id } = await req.json();
  if (!invite_id) return json({ error: 'invite_id is required.' }, 400);

  const { data: invite, error } = await supabase
    .from('family_invites')
    .select('token, email, expires_at, families ( name )')
    .eq('id', invite_id)
    .single();
  if (error || !invite) return json({ error: 'Invite not found.' }, 404);

  const site = (Deno.env.get('SITE_URL') ?? 'https://pawprintskeeper.com').replace(/\/$/, '');
  const link = `${site}/?invite=${invite.token}`;

  const family = Array.isArray(invite.families) ? invite.families[0] : invite.families;
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('display_name').eq('id', auth.user?.id ?? '').maybeSingle();
  const inviter = me?.display_name ?? 'Someone';

  let emailed = false;
  const key = Deno.env.get('RESEND_API_KEY');
  if (key && invite.email) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('INVITE_FROM') ?? 'Pawprint <onboarding@resend.dev>',
        to: invite.email,
        subject: `${inviter} invited you to ${family?.name ?? 'a family'} on Pawprint`,
        text: `${inviter} invited you to share pet records on Pawprint.\n\nJoin here: ${link}\n\nCreate an account or sign in, then confirm. The link works once and expires on ${new Date(invite.expires_at).toDateString()}.`,
      }),
    });
    emailed = res.ok;
    if (!res.ok) console.error('Invite email failed', await res.text());
  }

  return json({ link, emailed });
});
