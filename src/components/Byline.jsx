import { useContext } from 'react';
import { UserContext } from '../lib/user';

// "Added by Sam" under an entry. Entries from before authorship was tracked show nothing,
// because we'd rather say nothing than guess.
export default function Byline({ row }) {
  const me = useContext(UserContext);
  const id = row.created_by ?? row.owner_id;
  if (!id) return null;
  const name = id === me ? 'you' : row.author?.display_name ?? 'a former family member';
  return <span className="byline">Added by {name}</span>;
}
