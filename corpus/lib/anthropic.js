const URL = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

export class ApiError extends Error {
  constructor(status, message) {
    super(`Anthropic API error ${status}: ${message}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

// 401/403: the key is missing, wrong or not allowed. Never retried; the run stops.
export class AuthError extends ApiError {
  constructor(status, message) {
    super(status, message);
    this.name = 'AuthError';
  }
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createClient({
  apiKey,
  model,
  fetchImpl = globalThis.fetch,
  sleep = realSleep,
  maxRetries = 4,
  baseBackoffMs = 1000,
}) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  async function complete({ system, user, maxTokens = 8192 }) {
    const body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(URL, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': VERSION, 'content-type': 'application/json' },
        body,
      });
      if (res.ok) {
        const data = await res.json();
        const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
        return {
          text,
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
          stopReason: data.stop_reason,
        };
      }
      let message = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        message = err?.error?.message ?? message;
      } catch {
        // keep the HTTP status message
      }
      if (res.status === 401 || res.status === 403) throw new AuthError(res.status, message);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) throw new ApiError(res.status, message);
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : baseBackoffMs * 2 ** attempt);
    }
  }

  return { model, complete };
}
