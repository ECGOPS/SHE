import { describe, expect, it } from 'vitest';
import { formDraftId } from './queue';

describe('form drafts', () => {
  it('keeps one person from opening another person\'s unfinished form on a shared phone', () => {
    expect(formDraftId('user-a', 'incident-new')).not.toBe(formDraftId('user-b', 'incident-new'));
    expect(formDraftId('user-a', 'incident-new')).not.toBe(formDraftId('user-a', 'jsa-new'));
  });
});
