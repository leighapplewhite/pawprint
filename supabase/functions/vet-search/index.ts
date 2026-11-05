// vet-search: find veterinary clinics near a place using OpenStreetMap (no API key needed).
// POST { location?: string, lat?: number, lng?: number, radius_km?: number }
import { corsHeaders, json } from '../_shared/cors.ts';

// Nominatim's usage policy requires an identifying User-Agent. Change the contact!
const UA = 'PawprintDogfood/1.0 (contact: you@example.com)';

type Point = { lat: number; lng: number };

async function geocode(q: string): Promise<Point | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.length ? { lat: Number(rows[0].lat), lng: Number(rows[0].lon) } : null;
}

function distanceKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { location, lat, lng, radius_km = 15 } = await req.json();

    const center: Point | null =
      typeof lat === 'number' && typeof lng === 'number'
        ? { lat, lng }
        : location
          ? await geocode(String(location))
          : null;

    if (!center) return json({ error: 'Enter a city, ZIP code, or address we can find.' }, 400);

    const radiusM = Math.min(Math.max(Number(radius_km) || 15, 1), 50) * 1000;
    const query = `[out:json][timeout:20];nwr["amenity"="veterinary"](around:${radiusM},${center.lat},${center.lng});out center tags 60;`;

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return json({ error: 'The clinic directory is busy. Try again in a moment.' }, 502);

    const { elements = [] } = await res.json();

    const results = elements
      .map((el: any) => {
        const t = el.tags ?? {};
        const point = { lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon };
        if (point.lat == null || point.lng == null) return null;
        const address = [
          [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
          t['addr:city'],
          t['addr:state'],
          t['addr:postcode'],
        ].filter(Boolean).join(', ');
        return {
          osm_ref: `${el.type}/${el.id}`,
          name: t.name ?? 'Veterinary clinic',
          address: address || null,
          phone: t.phone ?? t['contact:phone'] ?? null,
          website: t.website ?? t['contact:website'] ?? null,
          opening_hours: t.opening_hours ?? null,
          lat: point.lat,
          lng: point.lng,
          distance_km: Math.round(distanceKm(center, point) * 10) / 10,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distance_km - b.distance_km)
      .slice(0, 25);

    return json({ center, results });
  } catch (err) {
    console.error(err);
    return json({ error: 'Something went wrong searching for clinics.' }, 500);
  }
});
