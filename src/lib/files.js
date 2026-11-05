import { supabase } from './supabase';

export const bucketFor = (category) => (category === 'photo' ? 'pet-photos' : 'pet-documents');

// Uploads to Storage, then records metadata in public.documents.
// Path convention matches the storage RLS policy: {user_id}/{pet_id}/{timestamp}-{filename}
export async function uploadPetFile({ user, pet, file, category, caption }) {
  const bucket = bucketFor(category);
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${user.id}/${pet.id}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: upErr.message };

  const { data, error: dbErr } = await supabase.from('documents').insert({
    pet_id: pet.id, category, bucket, storage_path: path,
    file_name: file.name, mime_type: file.type || null, size_bytes: file.size, caption: caption || null,
  }).select().single();

  if (dbErr) {
    await supabase.storage.from(bucket).remove([path]); // don't leave orphans
    return { error: dbErr.message };
  }
  return { document: data };
}

export async function deletePetFile(doc) {
  const { error: stErr } = await supabase.storage.from(doc.bucket).remove([doc.storage_path]);
  if (stErr) return { error: stErr.message };
  const { error } = await supabase.from('documents').delete().eq('id', doc.id);
  return { error: error?.message };
}

// Returns { [storage_path]: signedUrl } for a list of documents.
export async function signedUrlsFor(docs, seconds = 3600) {
  const out = {};
  for (const bucket of ['pet-photos', 'pet-documents']) {
    const paths = docs.filter((d) => d.bucket === bucket).map((d) => d.storage_path);
    if (!paths.length) continue;
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, seconds);
    (data ?? []).forEach((r) => { if (r.signedUrl) out[r.path] = r.signedUrl; });
  }
  return out;
}

export const prettySize = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
