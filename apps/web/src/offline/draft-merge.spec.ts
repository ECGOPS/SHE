import { describe, expect, it } from 'vitest';
import { mergeDraftPreserve } from './draft-merge';

describe('mergeDraftPreserve', () => {
  it('keeps filled answers that the live form has not painted yet', () => {
    const previous = { form: { title: 'Pole fire', firstAidOutcome: 'GIVEN', regionId: 'r1' }, photos: [{ fileName: 'a.jpg' }] };
    const next = { form: { title: 'Pole fire', regionId: 'r1' }, photos: [] };
    expect(mergeDraftPreserve(previous, next)).toEqual({
      form: { title: 'Pole fire', firstAidOutcome: 'GIVEN', regionId: 'r1' },
      photos: [{ fileName: 'a.jpg' }],
    });
  });

  it('lets a person clear a field that is still on the form', () => {
    const previous = { form: { title: 'Pole fire', description: 'Smoke' } };
    const next = { form: { title: '', description: 'Smoke' } };
    expect(mergeDraftPreserve(previous, next)).toEqual({ form: { title: '', description: 'Smoke' } });
  });
});
