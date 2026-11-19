/**
 * Simple per-visitor limit, kept in the server's memory. On hosts that run
 * several copies of the server (Vercel), each copy counts separately and
 * restarts reset the count, so this stops floods from one visitor rather than
 * guaranteeing an exact number.
 */
const hits = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep memory bounded.
  if (hits.size > 10_000) hits.clear();
  return true;
}

/** The visitor's address as reported by the host's proxy. */
export function visitor(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
