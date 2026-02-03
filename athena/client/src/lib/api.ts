import type {
  MessagesResponse,
  HealthResponse,
  SessionDetailResponse,
  SessionRequest,
  SessionResponse,
} from '@typeforge/types';

export async function fetchMessages(params?: {
  before?: number;
  limit?: number;
}): Promise<MessagesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.before !== undefined) searchParams.set('before', String(params.before));
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));

  const url = `/api/messages${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch messages: ${res.status}`);
  }

  return res.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');

  if (!res.ok) {
    return { status: 'error', model: null, error: `HTTP ${res.status}` };
  }

  return res.json();
}

export async function fetchSessionDetail(id: number): Promise<SessionDetailResponse | null> {
  const res = await fetch(`/api/session/${id}`);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch session: ${res.status}`);
  }

  return res.json();
}

/**
 * Save a typing session with metrics and timing data.
 * Returns the session ID for linking to coaching feedback.
 */
export async function saveSession(data: SessionRequest): Promise<SessionResponse> {
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Failed to save session: ${res.status}`);
  }

  return res.json();
}
