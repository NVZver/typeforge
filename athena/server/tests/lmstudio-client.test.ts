import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkHealth, streamChatCompletion } from '../src/llm/lmstudio-client.js';

function makeSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function mockFetchResponse(body: ReadableStream<Uint8Array>, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    headers: new Headers(),
    json: async () => ({}),
  } as unknown as Response;
}

describe('checkHealth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns connected with model name when models loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ data: [{ id: 'llama-3.2-1b' }] }),
    } as Response);

    const result = await checkHealth();
    expect(result).toEqual({ status: 'connected', model: 'llama-3.2-1b', error: null });
  });

  it('returns error when no models loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ data: [] }),
    } as Response);

    const result = await checkHealth();
    expect(result).toEqual({ status: 'error', model: null, error: 'No models loaded' });
  });

  it('returns error when unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await checkHealth();
    expect(result).toEqual({ status: 'error', model: null, error: 'ECONNREFUSED' });
  });
});

describe('streamChatCompletion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('yields tokens in order from SSE stream', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse(makeSSEStream([sseData]))
    );

    const tokens: string[] = [];
    for await (const token of streamChatCompletion([{ role: 'user', content: 'hi' }])) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['Hello', ' world']);
  });

  it('handles [DONE] sentinel correctly', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"Done"}}]}\n\n',
      'data: [DONE]\n\n',
      'data: {"choices":[{"delta":{"content":"ignored"}}]}\n\n',
    ].join('');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse(makeSSEStream([sseData]))
    );

    const tokens: string[] = [];
    for await (const token of streamChatCompletion([{ role: 'user', content: 'hi' }])) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['Done']);
  });

  it('retries on empty response and succeeds on 2nd attempt', async () => {
    const emptyStream = makeSSEStream(['data: [DONE]\n\n']);
    const goodStream = makeSSEStream([
      'data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n',
    ]);

    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(emptyStream))
      .mockResolvedValueOnce(mockFetchResponse(goodStream));

    const tokens: string[] = [];
    for await (const token of streamChatCompletion([{ role: 'user', content: 'hi' }])) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['OK']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws timeout error when request exceeds timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (_url, options) => {
        const signal = (options as RequestInit).signal!;
        // Immediately abort to simulate timeout
        if (!signal.aborted) {
          (signal as any).addEventListener('abort', () => {});
        }
        throw new DOMException('The operation was aborted', 'AbortError');
      }
    );

    // We need to mock it differently — simulate the abort controller firing
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => {
        throw new DOMException('The operation was aborted', 'AbortError');
      }
    );

    await expect(async () => {
      const gen = streamChatCompletion([{ role: 'user', content: 'hi' }]);
      for await (const _ of gen) { /* consume */ }
    }).rejects.toThrow();
  });

  it('handles chunked SSE data split across multiple reads', async () => {
    const chunk1 = 'data: {"choices":[{"delta":{"content":"He';
    const chunk2 = 'llo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse(makeSSEStream([chunk1, chunk2]))
    );

    const tokens: string[] = [];
    for await (const token of streamChatCompletion([{ role: 'user', content: 'hi' }])) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['Hello', ' world']);
  });

  it('skips comment lines and empty lines', async () => {
    const sseData = ': this is a comment\n\n\ndata: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse(makeSSEStream([sseData]))
    );

    const tokens: string[] = [];
    for await (const token of streamChatCompletion([{ role: 'user', content: 'hi' }])) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['OK']);
  });
});
