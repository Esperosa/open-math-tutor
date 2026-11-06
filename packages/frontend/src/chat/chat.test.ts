import { beforeEach, expect, it } from 'vitest';
import { answerFaq, faqById } from './faq';
import { chatMessages } from './messages';
import { CHIP_LABEL, quickReplies, type ReplyContext } from './replies';
import { MAX_PER_BOARD, appendMessage, clearThread, conversationTail, loadChats, saveChats } from './chatStore';

beforeEach(() => localStorage.clear());

it('has every chat string in both languages', () => {
  expect(Object.keys(chatMessages.en).sort()).toEqual(Object.keys(chatMessages.cs).sort());
  for (const locale of ['cs', 'en'] as const) for (const value of Object.values(chatMessages[locale])) expect(value.trim()).not.toBe('');
});

it.each([
  ['Co znamená ✓ a ✗?', 'marks'], ['co znamena ta cervena znacka', 'marks'], ['jak přepnu hlídání na až na konec', 'modes'],
  ['Jak smažu řádek?', 'delete'], ['jak se tu píše perem', 'write'], ['kde je kalkulačka', 'calculator'], ['zapni hlas', 'voice'],
  ['jak posunu tabuli', 'move'], ['kolik procent mám splněno', 'plan'], ['kde stáhnu zápisky', 'notes'], ['díky', 'thanks'], ['ahoj', 'hello'],
  ['what do the check marks mean', 'marks'], ['how do I delete a line', 'delete'],
] as const)('answers "%s" locally as %s', (question, id) => {
  expect(answerFaq(question, 'cs')?.id).toBe(id);
});

it('leaves real math questions to the AI, including long ones that merely contain a keyword', () => {
  expect(answerFaq('Proč se mění znaménko, když převádím na druhou stranu?', 'cs')).toBeNull();
  expect(answerFaq('Vysvětli mi, jak se počítá zlomek 3/4 plus 1/2 a proč se hledá společný jmenovatel u kurzu', 'cs')).toBeNull();
  expect(answerFaq('co je derivace', 'cs')).toBeNull();
  expect(answerFaq('', 'cs')).toBeNull();
  expect(answerFaq('x'.repeat(300), 'cs')).toBeNull();
});

it('answers in the language of the interface', () => {
  expect(answerFaq('Co znamená ✓?', 'en')?.text).toMatch(/Each line gets/);
  expect(faqById('marks', 'cs').text).toMatch(/řádku vidíš/);
});

const ctx = (over: Partial<ReplyContext> = {}): ReplyContext => ({ kind: 'info', canRequest: true, lessonActive: false, answeredByAi: false, hasLines: true, ...over });
it('offers context-matched, bounded chips and only local help without an AI', () => {
  expect(quickReplies(ctx({ kind: 'wrong' }))).toEqual(['hint', 'explain', 'next_step', 'understand', 'lost']);
  expect(quickReplies(ctx({ answeredByAi: true }))).toEqual(['understand', 'lost', 'explain', 'example', 'next_step']);
  expect(quickReplies(ctx({ kind: 'solved', lessonActive: true }))).toContain('next_problem');
  expect(quickReplies(ctx({ kind: 'thinking' }))).toEqual([]);
  for (const kind of ['wrong', 'check_in', 'solved', 'unclear', 'info', 'error', null] as const) {
    const offline = quickReplies(ctx({ kind, canRequest: false }));
    expect(offline.length).toBeLessThanOrEqual(5);
    expect(offline.every(id => ['hint', 'understand', 'next_problem', 'faq_marks', 'faq_modes', 'faq_delete'].includes(id))).toBe(true);
    expect(quickReplies(ctx({ kind })).length).toBeLessThanOrEqual(5);
  }
  expect(Object.keys(CHIP_LABEL).every(id => chatMessages.cs[CHIP_LABEL[id as keyof typeof CHIP_LABEL]])).toBe(true);
});

it('keeps one thread per board, bounded, deduplicated and persisted', () => {
  let store = appendMessage({}, 'a', { id: '1', role: 'tutor', text: 'Ahoj' });
  store = appendMessage(store, 'a', { id: '1', role: 'tutor', text: 'Ahoj' });
  store = appendMessage(store, 'a', { id: '2', role: 'student', text: '  ' });
  store = appendMessage(store, 'b', { id: '3', role: 'student', text: 'Jiná tabule' });
  expect(store.a).toHaveLength(1); expect(store.b).toHaveLength(1);
  for (let i = 0; i < MAX_PER_BOARD + 10; i++) store = appendMessage(store, 'a', { id: `m${i}`, role: 'tutor', text: `zpráva ${i}` });
  expect(store.a).toHaveLength(MAX_PER_BOARD);
  expect(store.a!.at(-1)!.text).toBe(`zpráva ${MAX_PER_BOARD + 9}`);
  saveChats(store, ['a']);
  expect(Object.keys(loadChats())).toEqual(['a']); // deleted boards do not linger
  expect(clearThread(store, 'a').a).toBeUndefined();
  expect(clearThread(store, 'zzz')).toBe(store);
});

it('survives damaged storage', () => {
  localStorage.setItem('openmathtutor.chat.v1', '{not json');
  expect(loadChats()).toEqual({});
  localStorage.setItem('openmathtutor.chat.v1', JSON.stringify({ a: [{ id: 1 }, { id: 'ok', role: 'tutor', text: 'x', at: 1 }, null], b: 'nope' }));
  expect(loadChats()).toEqual({ a: [{ id: 'ok', role: 'tutor', text: 'x', at: 1 }] });
});

it('sends the AI only a short, bounded tail of the conversation', () => {
  const thread = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, role: (i % 2 ? 'student' : 'tutor') as 'student' | 'tutor', text: 'x'.repeat(900), at: i }));
  const tail = conversationTail(thread);
  expect(tail).toHaveLength(6);
  expect(tail.every(turn => turn.text.length === 400)).toBe(true);
  expect(tail.map(t => t.role)).toEqual(thread.slice(-6).map(m => m.role));
});
