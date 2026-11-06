import type { Locale } from '@openmathtutor/shared';

/** Strings of the conversation with the tutor, kept apart from the big UI dictionary. */
const cs = {
  chatOpen: 'Povídat si s učitelem', chatClose: 'Sbalit rozhovor', chatTitle: 'Rozhovor s učitelem', chatEmpty: 'Zatím jsme si nic neřekli. Zeptej se, nebo klepni na některou odpověď.',
  chatLog: 'Historie rozhovoru', chatYou: 'Ty', chatTeacher: 'Učitel', chatBigger: 'Zvětšit okno rozhovoru', chatSmaller: 'Zmenšit okno rozhovoru',
  chatClear: 'Smazat rozhovor', chatClearConfirm: 'Smazat rozhovor u této tabule?',
  composeOpen: 'Napsat zprávu', composeClose: 'Schovat psaní', composePlaceholder: 'Napiš, co ti není jasné…', composeSend: 'Odeslat',
  composeLabel: 'Zpráva učiteli', micHold: 'Mluvit', micStop: 'Poslouchám, klepni pro odeslání', micUnavailable: 'Mikrofon tvůj prohlížeč nepodporuje.',
  cancelRequest: 'Zrušit', stillThinking: 'Pořád přemýšlím, nejspíš to potrvá. Můžeš to zrušit.', thinkingStart: 'Přemýšlím',
  requestTimedOut: 'Učitel neodpověděl včas. Zkus to znovu, nebo si řekni o místní nápovědu.',
  chipExplain: 'Vysvětli jinak', chipNextStep: 'Ukaž další krok', chipUnderstand: 'Chápu', chipLost: 'Nechápu', chipExample: 'Příklad', chipHint: 'Nápověda',
  chipNextProblem: 'Další příklad', chipWhyWrong: 'Proč je to špatně?', chipFaqMarks: 'Co znamená ✓ a ✗?', chipFaqModes: 'Jak přepnu hlídání?', chipFaqDelete: 'Jak smažu řádek?',
  askExample: 'Ukaž mi prosím podobný vzorový příklad s řešením.', askWhyWrong: 'Proč je můj poslední řádek špatně?', askLost: 'Nechápu to, vysvětli mi to jinak a jednoduše.',
  understandReply: 'Super! Pokračuj dalším řádkem, nebo si řekni o další příklad.',
  lostNoAi: 'To nevadí. AI teď není připojená, ale můžu ti dát místní nápovědu k poslednímu řádku. Klepni na „Nápověda“.',
  noAi: 'AI učitel teď není připojený, takže na volnou otázku neodpovím. Počítání na tabuli ti hlídám dál i bez něj. Tady je to, s čím ti umím pomoct hned:',
  noAiHow: 'Připojení: spusť lokální bridge a v Nastavení vyber poskytovatele.',
  noHintYet: 'Nejdřív napiš nějaký řádek na tabuli, pak ti umím poradit.',
  faqFallback: 'Na tohle zatím neumím odpovědět sám. Zkus se zeptat jinak, nebo klepni na jednu z rychlých otázek níže.',
} as const;

export type ChatMessageKey = keyof typeof cs;

const en: Record<ChatMessageKey, string> = {
  chatOpen: 'Chat with the teacher', chatClose: 'Collapse conversation', chatTitle: 'Conversation with the teacher', chatEmpty: 'We have not said anything yet. Ask something, or tap one of the quick replies.',
  chatLog: 'Conversation history', chatYou: 'You', chatTeacher: 'Teacher', chatBigger: 'Enlarge the chat window', chatSmaller: 'Shrink the chat window',
  chatClear: 'Clear conversation', chatClearConfirm: 'Clear the conversation for this board?',
  composeOpen: 'Write a message', composeClose: 'Hide typing', composePlaceholder: 'Write what is unclear…', composeSend: 'Send',
  composeLabel: 'Message to the teacher', micHold: 'Speak', micStop: 'Listening, tap to send', micUnavailable: 'Your browser has no speech recognition.',
  cancelRequest: 'Cancel', stillThinking: 'Still thinking, this may take a while. You can cancel.', thinkingStart: 'Thinking',
  requestTimedOut: 'The teacher did not answer in time. Try again, or ask for the local hint.',
  chipExplain: 'Explain differently', chipNextStep: 'Show the next step', chipUnderstand: 'Got it', chipLost: 'I do not get it', chipExample: 'Example', chipHint: 'Hint',
  chipNextProblem: 'Next problem', chipWhyWrong: 'Why is it wrong?', chipFaqMarks: 'What do ✓ and ✗ mean?', chipFaqModes: 'How do I switch checking?', chipFaqDelete: 'How do I delete a line?',
  askExample: 'Please show me a similar worked example with the solution.', askWhyWrong: 'Why is my last line wrong?', askLost: 'I do not get it, explain it to me differently and simply.',
  understandReply: 'Great! Carry on with the next line, or ask for another problem.',
  lostNoAi: 'No problem. The AI is not connected right now, but I can give you a local hint for the last line. Tap "Hint".',
  noAi: 'The AI teacher is not connected right now, so I cannot answer open questions. I keep checking your work on the board without it. Here is what I can help with right away:',
  noAiHow: 'To connect: start the local bridge and pick a provider in Settings.',
  noHintYet: 'Write a line on the board first, then I can give advice.',
  faqFallback: 'I cannot answer that on my own yet. Try asking differently, or tap one of the quick questions below.',
};

export const chatMessages: Record<Locale, Record<ChatMessageKey, string>> = { cs, en };
