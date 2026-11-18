import { describe, expect, it } from 'vitest';

import enUS from '../../client/locales/en-US.js';
import zhCN from '../../client/locales/zh-CN.js';

/** The copy added for the banana-scenario labor linkage, in both languages. */
const keys = [
  'bananaScenarioLabel',
  'laborScenarioNote',
  'laborUnchangedNote',
] as const;

describe('banana scenario labor copy', () => {
  it.each(keys)('translates %s in both locales', (key) => {
    const english = enUS.resourcePlanning[key];
    const chinese = zhCN.resourcePlanning[key];
    expect(typeof english).toBe('string');
    expect(typeof chinese).toBe('string');
    expect((english as string).trim()).not.toBe('');
    expect((chinese as string).trim()).not.toBe('');
    // Both are real translations, not an untranslated copy of one another.
    expect(chinese).not.toBe(english);
  });
});
