import { describe, it, expect } from 'vitest';
import { extractAction, stripActionMarkers } from '../src/agent/action-parser.js';

describe('extractAction', () => {
  it('extracts action with correct text from valid markers', () => {
    const text = 'Let me give you something to type.\n[ACTION:typing_session]The quick brown fox.[/ACTION]';
    const result = extractAction(text);
    expect(result).toEqual({ type: 'start_typing_session', text: 'The quick brown fox.' });
  });

  it('returns null when no markers present', () => {
    expect(extractAction('Just a normal response.')).toBeNull();
  });

  it('returns null for malformed markers (missing closing tag)', () => {
    expect(extractAction('[ACTION:typing_session]some text')).toBeNull();
  });

  it('returns null for unknown action type', () => {
    expect(extractAction('[ACTION:unknown_type]some text[/ACTION]')).toBeNull();
  });

  it('returns null when text inside markers is empty', () => {
    expect(extractAction('[ACTION:typing_session]   [/ACTION]')).toBeNull();
  });

  it('trims whitespace from extracted text', () => {
    const text = '[ACTION:typing_session]  hello world  [/ACTION]';
    const result = extractAction(text);
    expect(result).toEqual({ type: 'start_typing_session', text: 'hello world' });
  });

  it('extracts only the first match when multiple markers present', () => {
    const text = '[ACTION:typing_session]first[/ACTION] some text [ACTION:typing_session]second[/ACTION]';
    const result = extractAction(text);
    expect(result).toEqual({ type: 'start_typing_session', text: 'first' });
  });

  it('handles multiline text inside markers', () => {
    const text = '[ACTION:typing_session]line one\nline two[/ACTION]';
    const result = extractAction(text);
    expect(result).toEqual({ type: 'start_typing_session', text: 'line one\nline two' });
  });
});

describe('stripActionMarkers', () => {
  it('removes action block and preserves surrounding text', () => {
    const text = 'Here is your practice text.\n[ACTION:typing_session]The quick brown fox.[/ACTION]';
    expect(stripActionMarkers(text)).toBe('Here is your practice text.');
  });

  it('returns text unchanged when no markers present', () => {
    const text = 'Just a normal response.';
    expect(stripActionMarkers(text)).toBe('Just a normal response.');
  });

  it('removes multiple action blocks', () => {
    const text = 'start [ACTION:typing_session]one[/ACTION] middle [ACTION:typing_session]two[/ACTION] end';
    expect(stripActionMarkers(text)).toBe('start  middle  end');
  });

  it('handles text with only action block', () => {
    const text = '[ACTION:typing_session]The quick brown fox.[/ACTION]';
    expect(stripActionMarkers(text)).toBe('');
  });
});
