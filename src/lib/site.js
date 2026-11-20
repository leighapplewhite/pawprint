// The public address people should use to reach Pawprint. Links we hand out (like family
// invites) must always point here, never at whatever address the owner happens to be browsing,
// which would be localhost while testing or a private preview URL.
//
// To override: set VITE_SITE_URL in .env (and in Vercel's environment variables).
const PUBLIC_SITE = 'https://pawprintskeeper.com';

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || (isLocal ? PUBLIC_SITE : window.location.origin)
).replace(/\/$/, '');
