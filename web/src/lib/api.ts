import { useCallback, useEffect, useRef, useState } from 'react';

let token = '';
try { token = sessionStorage.getItem('t') ?? ''; } catch { /* storage unavailable */ }
export const setToken = (t: string) => { token = t; try { t ? sessionStorage.setItem('t', t) : sessionStorage.removeItem('t'); } catch { /* ignore */ } };
export const hasToken = () => !!token;
export const authHeader = () => ({ authorization: `Bearer ${token}` });

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', ...(token && authHeader()) }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new ApiError('Cannot reach the server. Check your connection and try again.', 0); }
  const text = await r.text(); let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (r.status === 401 && token && !path.startsWith('/auth/login')) { setToken(''); onUnauthorized(); }
  if (!r.ok) {
    const m = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new ApiError(m ?? (r.status >= 500 ? 'Something went wrong on our side. Please try again.' : `Request failed (${r.status})`), r.status);
  }
  return data as T;
}

/** Authenticated file/blob fetch (used for documents and exports). */
export async function fetchBlob(path: string): Promise<Blob> {
  const r = await fetch('/api' + path, { headers: authHeader() });
  if (!r.ok) throw new ApiError('Could not load the file', r.status);
  return r.blob();
}
export async function saveFile(path: string, name: string) {
  const url = URL.createObjectURL(await fetchBlob(path));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---- tiny request cache: de-duplicates in-flight calls, serves stale data instantly, refetches on invalidate ---- */
const cache = new Map<string, unknown>(); const inflight = new Map<string, Promise<unknown>>(); const listeners = new Set<() => void>();
export function invalidate(prefix = '') { for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k); listeners.forEach(l => l()); }
export const clearCache = () => { cache.clear(); inflight.clear(); };

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(path && cache.has(path) ? (cache.get(path) as T) : null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path && !cache.has(path));
  // Set true on every mount: React StrictMode (dev) runs mount → cleanup → mount, so cleanup alone must not leave this false.
  const alive = useRef(true); useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback((force = false) => {
    if (!path) { setData(null); setLoading(false); return; }
    if (!force && cache.has(path)) { setData(cache.get(path) as T); setLoading(false); return; }
    if (!inflight.has(path)) inflight.set(path, api<T>('GET', path).then(d => { cache.set(path, d); return d; }).finally(() => inflight.delete(path)));
    (inflight.get(path) as Promise<T>).then(d => { if (alive.current) { setData(d); setError(null); } }).catch(e => { if (alive.current) setError(e); }).finally(() => { if (alive.current) setLoading(false); });
  }, [path]);
  useEffect(() => { setError(null); setLoading(!!path && !cache.has(path ?? '')); load(); }, [load, path]);
  useEffect(() => { const l = () => load(true); listeners.add(l); return () => { listeners.delete(l); }; }, [load]);
  return { data, error, loading, reload: () => { if (path) cache.delete(path); load(true); } };
}
