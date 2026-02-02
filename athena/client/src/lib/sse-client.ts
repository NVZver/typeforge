import type { ChatRequest, TextEvent, ActionEvent, ErrorEvent } from '@typeforge/types';

export interface SSECallbacks {
  onToken: (token: string) => void;
  onAction: (action: ActionEvent) => void;
  onDone: () => void;
  onError: (error: ErrorEvent) => void;
}

export async function sendChat(body: ChatRequest, callbacks: SSECallbacks): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    callbacks.onError({ message: 'Network error. Is the server running?', code: 'network_error' });
    return;
  }

  if (!res.ok || !res.body) {
    callbacks.onError({ message: `Server error (${res.status})`, code: 'server_error' });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let gotTerminalEvent = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      if (!block.trim()) continue;

      let event = '';
      let data = '';

      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        if (line.startsWith('data: ')) data = line.slice(6);
      }

      if (!event || !data) continue;

      try {
        const parsed = JSON.parse(data);

        switch (event) {
          case 'text':
            callbacks.onToken((parsed as TextEvent).token);
            break;
          case 'action':
            gotTerminalEvent = true;
            callbacks.onAction(parsed as ActionEvent);
            break;
          case 'done':
            gotTerminalEvent = true;
            callbacks.onDone();
            break;
          case 'error':
            gotTerminalEvent = true;
            callbacks.onError(parsed as ErrorEvent);
            break;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  // Handle premature stream end
  if (!gotTerminalEvent) {
    callbacks.onDone();
  }
}
