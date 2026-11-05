// share-link: make a temporary, signed download link for one of the caller's files
// (e.g. send a vaccine record to a boarding kennel or a new vet).
// POST { document_id: string, expires_in_hours?: number }   (max 168 = 7 days)
//
// The client is created with the CALLER's JWT, so Row Level Security and Storage
// policies decide whether they may see the file. No service role key needed.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in to share files.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { document_id, expires_in_hours = 24 } = await req.json();
  if (!document_id) return json({ error: 'document_id is required.' }, 400);

  const { data: doc, error } = await supabase
    .from('documents')
    .select('bucket, storage_path, file_name')
    .eq('id', document_id)
    .single();
  if (error || !doc) return json({ error: 'File not found.' }, 404);

  const hours = Math.min(Math.max(Number(expires_in_hours) || 24, 1), 168);
  const seconds = hours * 3600;

  const { data, error: signError } = await supabase.storage
    .from(doc.bucket)
    .createSignedUrl(doc.storage_path, seconds, { download: doc.file_name });
  if (signError || !data) return json({ error: 'Could not create a link.' }, 500);

  return json({
    url: data.signedUrl,
    expires_at: new Date(Date.now() + seconds * 1000).toISOString(),
  });
});
