import { expect, it } from 'vitest';
import { cs, en, errorKeys } from './i18n';
it('has complete nonempty Czech and English coverage, including every pinned bridge error', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(cs).sort());
  for (const dictionary of [cs, en]) for (const value of Object.values(dictionary)) expect(value.trim()).not.toBe('');
  expect(Object.keys(errorKeys)).toHaveLength(10);
  for (const key of Object.values(errorKeys)) { expect(cs[key]).toBeTruthy(); expect(en[key]).toBeTruthy(); }
});
