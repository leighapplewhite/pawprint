import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// Loads rows for one pet from a table, with add/remove helpers.
// Each row also carries `author` (the profile of whoever made it) for the "Added by" label.
export function useRows(table, petId, orderBy = 'created_at', ascending = false) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Files record their uploader in owner_id; every other record uses created_by.
  const authorColumn = table === 'documents' ? 'owner_id' : 'created_by';
  const columns = `*, author:profiles!${authorColumn} ( display_name )`;

  const load = useCallback(async () => {
    if (!petId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from(table).select(columns).eq('pet_id', petId).order(orderBy, { ascending });
    setRows(data ?? []);
    setError(error?.message ?? null);
    setLoading(false);
  }, [table, columns, petId, orderBy, ascending]);

  useEffect(() => { load(); }, [load]);

  // The database stamps the author from the signed-in user, so we never send one.
  const add = async (values) => {
    const { error } = await supabase.from(table).insert({ ...values, pet_id: petId });
    if (error) { setError(error.message); return false; }
    setError(null);
    await load();
    return true;
  };

  const remove = async (id) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) setError(error.message); else await load();
  };

  return { rows, loading, error, add, remove, reload: load };
}

export const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';

export function ageLabel(birthdate) {
  if (!birthdate) return '';
  const b = new Date(birthdate + 'T00:00:00');
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months--;
  if (months < 1) return 'under a month old';
  if (months < 24) return `${months} months old`;
  return `${Math.floor(months / 12)} years old`;
}
