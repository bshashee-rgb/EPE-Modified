// Live FX rates (INR-based), shared shape used by both the Express server and the
// Cloudflare Worker. Plain fetch() — no API key, works identically in Node 18+ and
// in a Worker isolate. Cached in-memory to avoid hitting the upstream on every call.
// The provider returns every ISO currency it tracks (~166) — all of them are offered.
const RATES_URL = 'https://open.er-api.com/v6/latest/INR';
const TTL_MS = 30 * 60 * 1000; // 30 min

let cache = null; // { rates: {INR:1, USD:.., ...}, fetchedAt: ISOString }

async function fetchLiveRates() {
  const res = await fetch(RATES_URL);
  if (!res.ok) throw new Error(`FX provider returned ${res.status}`);
  const body = await res.json();
  if (body.result !== 'success' || !body.rates) throw new Error('FX provider returned an unexpected payload');
  return body.rates;
}

// Returns { rates: {INR:1, USD:.., ...}, fetchedAt, stale }. Throws only if there is
// no live data AND no cached fallback — callers must not silently apply a bogus rate.
export async function getFxRates() {
  const fresh = cache && (Date.now() - Date.parse(cache.fetchedAt)) < TTL_MS;
  if (fresh) return { ...cache, stale: false };
  try {
    const rates = await fetchLiveRates();
    cache = { rates, fetchedAt: new Date().toISOString() };
    return { ...cache, stale: false };
  } catch (e) {
    if (cache) return { ...cache, stale: true };
    throw e;
  }
}

// INR -> target multiplier. 1 for INR itself (no network call needed).
export async function getFxRate(target) {
  if (target === 'INR') return 1;
  const { rates } = await getFxRates();
  const rate = rates[target];
  if (rate == null) throw new Error(`No FX rate available for ${target}`);
  return rate;
}
