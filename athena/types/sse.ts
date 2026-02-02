/**
 * SSE wire format: event: <type>\ndata: <json>\n\n
 *
 * Example:
 *   event: text\ndata: {"token":"Hello"}\n\n
 *   event: action\ndata: {"type":"start_typing_session","text":"The quick..."}\n\n
 *   event: done\ndata: {}\n\n
 *   event: error\ndata: {"message":"Timeout","code":"timeout"}\n\n
 */

export interface TextEvent { token: string }
export interface ActionEvent { type: 'start_typing_session'; text: string }
export interface DoneEvent {}
export interface ErrorEvent { message: string; code: string }

export type SSEEventMap = {
  text: TextEvent;
  action: ActionEvent;
  done: DoneEvent;
  error: ErrorEvent;
};

export type SSEEventType = keyof SSEEventMap;
