const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234/v1';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

export interface HealthResult {
  status: 'connected' | 'error';
  model: string | null;
  error: string | null;
}

export async function checkHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${LMSTUDIO_URL}/models`);
    const body = await res.json() as { data?: Array<{ id: string }> };
    if (body.data && body.data.length > 0) {
      return { status: 'connected', model: body.data[0].id, error: null };
    }
    return { status: 'error', model: null, error: 'No models loaded' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { status: 'error', model: null, error: message };
  }
}

interface ChatMessage {
  role: string;
  content: string;
}

export async function* streamChatCompletion(
  messages: ChatMessage[]
): AsyncGenerator<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${LMSTUDIO_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          stream: true,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`LMStudio returned ${res.status}`);
      }

      if (!res.body) {
        throw new Error('Response body is null');
      }

      let gotContent = false;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (!trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6);
          if (payload === '[DONE]') {
            clearTimeout(timer);
            if (!gotContent) {
              // Empty response — break inner loop to trigger retry
              throw new EmptyResponseError();
            }
            return;
          }

          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              gotContent = true;
              yield token;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      clearTimeout(timer);

      if (!gotContent) {
        throw new EmptyResponseError();
      }

      return;
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof EmptyResponseError && attempt < MAX_RETRIES) {
        lastError = err;
        continue;
      }

      if (controller.signal.aborted) {
        throw new Error('LMStudio request timed out');
      }

      throw err;
    }
  }

  throw lastError ?? new Error('Empty response after retries');
}

class EmptyResponseError extends Error {
  constructor() {
    super('Empty response from LMStudio');
    this.name = 'EmptyResponseError';
  }
}
