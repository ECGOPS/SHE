import { describe, expect, it } from 'vitest';
import { belongsTo } from './queue';

describe('reports saved offline', () => {
  it('are only sent while the person who saved them is signed in', () => {
    expect(belongsTo({ userId: 'ama' }, 'ama')).toBe(true);
    expect(belongsTo({ userId: 'ama' }, 'kwame')).toBe(false);
  });

  it('are never sent while nobody is signed in', () => {
    expect(belongsTo({ userId: 'ama' }, undefined)).toBe(false);
    expect(belongsTo({}, undefined)).toBe(false);
  });

  it('saved before reports remembered their owner go with whoever signs in', () => {
    expect(belongsTo({}, 'kwame')).toBe(true);
  });
});
