import type { ConversationTurn } from '@openmathtutor/shared';

export interface ChatMessage { id: string; role: 'student' | 'tutor'; text: string; at: number }

/** One thread per board, so a lesson keeps its own conversation. Stored apart from the boards. */
const KEY = 'openmathtutor.chat.v1';
export const MAX_PER_BOARD = 40;
export const MAX_BOARDS = 30;
const MAX_TEXT = 4000;

export type ChatStore = Record<string, ChatMessage[]>;

const isMessage = (m: unknown): m is ChatMessage => typeof m === 'object' && m !== null
  && typeof (m as ChatMessage).id === 'string' && ['student', 'tutor'].includes((m as ChatMessage).role)
  && typeof (m as ChatMessage).text === 'string' && Number.isFinite((m as ChatMessage).at);

export function loadChats(): ChatStore {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const store: ChatStore = {};
    for (const [boardId, list] of Object.entries(raw)) {
      if (Array.isArray(list)) store[boardId] = list.filter(isMessage).slice(-MAX_PER_BOARD);
    }
    return store;
  } catch { return {}; }
}
export function saveChats(store: ChatStore, keepBoardIds?: readonly string[]): void {
  try {
    const entries = Object.entries(store).filter(([id, list]) => list.length && (!keepBoardIds || keepBoardIds.includes(id)));
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_BOARDS))));
  } catch { /* Full or blocked storage: the conversation just is not remembered. */ }
}
/** Appends one message; the same id (a re-rendered bubble) is never added twice. */
export function appendMessage(store: ChatStore, boardId: string, message: Omit<ChatMessage, 'at'> & { at?: number }): ChatStore {
  const list = store[boardId] ?? [];
  const text = message.text.trim().slice(0, MAX_TEXT);
  if (!text || list.some(m => m.id === message.id)) return store;
  return { ...store, [boardId]: [...list, { ...message, text, at: message.at ?? Date.now() }].slice(-MAX_PER_BOARD) };
}
export function clearThread(store: ChatStore, boardId: string): ChatStore {
  if (!store[boardId]) return store;
  return Object.fromEntries(Object.entries(store).filter(([id]) => id !== boardId));
}
/** The short tail of a thread that goes to the AI as context: bounded count and length, oldest first. */
export function conversationTail(thread: readonly ChatMessage[], count = 6, chars = 400): ConversationTurn[] {
  return thread.slice(-count).map(m => ({ role: m.role, text: m.text.slice(0, chars) }));
}
