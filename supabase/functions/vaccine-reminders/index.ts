// vaccine-reminders: emails every member of a family about vaccinations due within 14 days
// (or overdue). Triggered daily by pg_cron (see supabase/snippets/schedule-reminders.sql).
// Protected by a shared secret header because it uses the service role key.
//
// Secrets: CRON_SECRET (required), RESEND_API_KEY + REMINDER_FROM (optional; without them we just log)
import { createClient } from 'npm:@supabase/supabase-js@2';

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const horizon = iso(new Date(Date.now() + 14 * DAY));

  const { data: due, error } = await admin
    .from('vaccinations')
    .select('id, name, next_due_on, pets ( name, family_id )')
    .not('next_due_on', 'is', null)
    .lte('next_due_on', horizon);
  if (error) return new Response(error.message, { status: 500 });

  const { data: already } = await admin
    .from('reminder_log')
    .select('vaccination_id, due_on')
    .in('vaccination_id', (due ?? []).map((v) => v.id));
  const sent = new Set((already ?? []).map((r) => `${r.vaccination_id}:${r.due_on}`));

  const pending = (due ?? []).flatMap((v) => {
    if (sent.has(`${v.id}:${v.next_due_on}`)) return [];
    const pet = Array.isArray(v.pets) ? v.pets[0] : v.pets;
    return pet ? [{ ...v, pet_name: pet.name, family_id: pet.family_id }] : [];
  });

  // Everyone in each affected family gets one email listing their family's vaccinations.
  const familyIds = [...new Set(pending.map((v) => v.family_id))];
  const { data: members } = await admin
    .from('family_members').select('family_id, user_id').in('family_id', familyIds);

  const byUser = new Map<string, any[]>();
  for (const m of members ?? []) {
    const items = pending.filter((v) => v.family_id === m.family_id);
    if (items.length) byUser.set(m.user_id, [...(byUser.get(m.user_id) ?? []), ...items]);
  }

  const delivered = new Set<string>(); // vaccination ids that reached at least one person
  let emails = 0;
  for (const [userId, items] of byUser) {
    const { data: userRes } = await admin.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (!email) continue;

    const lines = items.map((v) => `• ${v.pet_name}: ${v.name} (due ${v.next_due_on})`).join('\n');
    const text = `Hi! These vaccinations are coming up or overdue:\n\n${lines}\n\nBook a visit and update Pawprint afterwards.`;

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: Deno.env.get('REMINDER_FROM') ?? 'Pawprint <onboarding@resend.dev>',
          to: email,
          subject: 'Vaccination reminder from Pawprint',
          text,
        }),
      });
      if (!res.ok) { console.error('Email failed', await res.text()); continue; }
    } else {
      console.log(`[dry run] would email ${email}:\n${text}`);
    }
    items.forEach((v) => delivered.add(v.id));
    emails++;
  }

  if (delivered.size) {
    await admin.from('reminder_log').upsert(
      pending.filter((v) => delivered.has(v.id)).map((v) => ({ vaccination_id: v.id, due_on: v.next_due_on })),
      { onConflict: 'vaccination_id,due_on', ignoreDuplicates: true },
    );
  }

  return Response.json({ checked: due?.length ?? 0, emails });
});
