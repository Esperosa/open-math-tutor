import { useCallback, useEffect, useRef, useState } from 'react';
import { appendMessage, clearThread, loadChats, saveChats, type ChatMessage, type ChatStore } from './chatStore';

const NONE: readonly ChatMessage[] = [];

/** Conversation threads, one per board, remembered on this device. */
export function useChat(boardId: string, boardIds: readonly string[]) {
  const [store, setStore] = useState<ChatStore>(loadChats);
  const live = useRef(boardIds); live.current = boardIds;
  useEffect(() => { saveChats(store, live.current); }, [store]);
  const add = useCallback((board: string, role: ChatMessage['role'], text: string, id: string = crypto.randomUUID()) => {
    setStore(prev => appendMessage(prev, board, { id, role, text }));
  }, []);
  const clear = useCallback((board: string) => setStore(prev => clearThread(prev, board)), []);
  const wipe = useCallback(() => setStore({}), []);
  return { thread: store[boardId] ?? NONE, add, clear, wipe };
}
