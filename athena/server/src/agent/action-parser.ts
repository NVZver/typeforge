const ACTION_REGEX = /\[ACTION:typing_session\]([\s\S]*?)\[\/ACTION\]/;
const ACTION_BLOCK_REGEX = /\[ACTION:\w+\][\s\S]*?\[\/ACTION\]/g;

export function extractAction(
  text: string
): { type: 'start_typing_session'; text: string } | null {
  const match = text.match(ACTION_REGEX);
  if (!match) return null;

  const extracted = match[1].trim();
  if (!extracted) return null;

  return { type: 'start_typing_session', text: extracted };
}

export function stripActionMarkers(text: string): string {
  return text.replace(ACTION_BLOCK_REGEX, '').trim();
}
