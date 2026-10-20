import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination.dto';

async function errors(plain: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(PaginationQueryDto, plain);
  const result = await validate(dto);
  return result.map((error) => error.property);
}

describe('pagination query', () => {
  it('accepts the default page and a full status list', async () => {
    expect(await errors({ page: '1', pageSize: '200', status: 'OPEN,REPORTED', sortBy: 'createdAt', sortDir: 'DESC' })).toEqual([]);
  });

  it('rejects a page below 1 and a page size above 200', async () => {
    expect(await errors({ page: '0', pageSize: '201' })).toEqual(expect.arrayContaining(['page', 'pageSize']));
  });

  it('rejects a search longer than 80 characters', async () => {
    expect(await errors({ search: 'a'.repeat(81) })).toEqual(['search']);
    expect(await errors({ search: 'a'.repeat(80) })).toEqual([]);
  });

  it('rejects a sort column that is not an identifier', async () => {
    expect(await errors({ sortBy: 'createdAt;drop' })).toEqual(['sortBy']);
  });

  it('rejects a sort direction outside ASC and DESC', async () => {
    expect(await errors({ sortDir: 'desc' })).toEqual(['sortDir']);
  });

  it('rejects a status list that is not uppercase codes', async () => {
    expect(await errors({ status: 'open' })).toEqual(['status']);
    expect(await errors({ status: 'OPEN,REPORTED' })).toEqual([]);
  });
});
