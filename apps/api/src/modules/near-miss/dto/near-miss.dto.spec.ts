import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateNearMissDto } from './near-miss.dto';

async function fields(plain: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(CreateNearMissDto, plain);
  const result = await validate(dto);
  return result.map((error) => error.property);
}

const valid = {
  title: 'Loose cross-arm',
  description: 'The arm shifted during a climb.',
  category: 'UNSAFE_CONDITION',
  occurredAt: '2026-10-17T21:11:00.000Z',
};

describe('CreateNearMissDto', () => {
  it('accepts a complete report', async () => {
    expect(await fields(valid)).toEqual([]);
  });

  it('rejects a title over 200 characters and an unknown category', async () => {
    expect(await fields({ ...valid, title: 'x'.repeat(201), category: 'OTHER' })).toEqual(
      expect.arrayContaining(['title', 'category']),
    );
  });

  it('rejects an empty title', async () => {
    expect(await fields({ ...valid, title: '' })).toEqual(['title']);
  });
});
