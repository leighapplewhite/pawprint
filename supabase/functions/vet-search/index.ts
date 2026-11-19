// vet-search: find veterinary clinics near a place using OpenStreetMap (no API key needed).
// POST { location?: string, lat?: number, lng?: number, radius_km?: number }
import { corsHeaders, json } from '../_shared/cors.ts';

// Nominatim's usage policy requires an identifying User-Agent. It blocks the
// example.com placeholder, so add a real contact here for production use.
const UA = 'PawprintDogfood/1.0';

type Point = { lat: number; lng: number };

async function geocode(q: string): Promise<Point | null> {
  // Nominatim first; fall back to Photon (also OSM-based) if it rejects us.
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': UA } },
    );
    if (res.ok) {
      const rows = await res.json();
      if (rows.length) return { lat: Number(rows[0].lat), lng: Number(rows[0].lon) };
    }
  } catch (err) {
    console.error('nominatim failed', err);
  }
  try {
    const res = await fetch(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': UA },
    });
    if (res.ok) {
      const { features = [] } = await res.json();
      const c = features[0]?.geometry?.coordinates;
      if (c) return { lat: Number(c[1]), lng: Number(c[0]) };
    }
  } catch (err) {
    console.error('photon failed', err);
  }
  return null;
}

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function overpass(query: string): Promise<any | null> {
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) return await res.json();
      console.error('overpass', url, res.status);
    } catch (err) {
      console.error('overpass failed', url, err);
    }
  }
  return null;
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

    const data = await overpass(query);
    if (!data) return json({ error: 'The clinic directory is busy. Try again in a moment.' }, 502);

    const { elements = [] } = data;

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
