export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

// 403 means the host is refusing automated access. We stop; we never work around it.
export class BlockedError extends HttpError {
  constructor(url) {
    super(403, url);
    this.name = 'BlockedError';
    this.message = `Blocked (403) by ${url}. Stopping; not attempting to work around access controls.`;
  }
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createFetcher({
  userAgent,
  minIntervalMs = 200,
  hostIntervals = {},
  maxRetries = 4,
  baseBackoffMs = 1000,
  fetchImpl = globalThis.fetch,
  sleep = realSleep,
  now = Date.now,
}) {
  const nextSlot = new Map();

  // One shared limiter per host: each request reserves the next free slot,
  // so concurrent workers still send at most one request per interval.
  async function waitSlot(host) {
    const interval = hostIntervals[host] ?? minIntervalMs;
    const t = now();
    const slot = Math.max(t, nextSlot.get(host) ?? 0);
    nextSlot.set(host, slot + interval);
    if (slot > t) await sleep(slot - t);
  }

  async function fetchUrl(url, { as = 'json' } = {}) {
    const host = new URL(url).host;
    for (let attempt = 0; ; attempt++) {
      await waitSlot(host);
      const res = await fetchImpl(url, { headers: { 'User-Agent': userAgent } });
      if (res.ok) {
        if (as === 'response') return res;
        return as === 'text' ? res.text() : res.json();
      }
      if (res.status === 403) throw new BlockedError(url);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) throw new HttpError(res.status, url);
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : baseBackoffMs * 2 ** attempt);
    }
  }

  return { fetch: fetchUrl };
}
