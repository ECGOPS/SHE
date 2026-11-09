import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInspectionDto } from './inspection.dto';

async function fields(plain: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(CreateInspectionDto, plain);
  const result = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return result.map((error) => error.property);
}

const valid = {
  type: 'SUBSTATION',
  assetOrLocation: 'Makola primary substation',
  inspectedAt: '2026-11-09T08:30:00.000Z',
  items: [],
};

describe('CreateInspectionDto', () => {
  it('accepts an inspection saved on a phone offline and synced later', async () => {
    expect(await fields({ ...valid, offlineClientId: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d' })).toEqual([]);
  });

  it('rejects an offline id that is not a UUID', async () => {
    expect(await fields({ ...valid, offlineClientId: 'not-a-uuid' })).toEqual(['offlineClientId']);
  });
});
