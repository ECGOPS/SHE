import { PaginatedResult } from '@ecg-she/shared';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export function searchTerm(search?: string): string | undefined {
  const term = search?.trim();
  if (!term) return undefined;
  return `%${term.slice(0, 80).replace(/[%_]/g, '')}%`;
}

export function statusList(status?: string): string[] {
  return [...new Set((status ?? '').split(',').map((item) => item.trim()).filter(Boolean))];
}

/** Column names cannot be bind parameters. Only an allow-listed identifier is interpolated. */
export function orderColumn(alias: string, sortBy: string | undefined, allowed: readonly string[], fallback: string): string {
  const column = sortBy && allowed.includes(sortBy) && /^[A-Za-z][A-Za-z0-9]{0,31}$/.test(sortBy) ? sortBy : fallback;
  return `${alias}.${column}`;
}

export function applyStatus<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string, status?: string): void {
  const statuses = statusList(status);
  if (statuses.length === 1) qb.andWhere(`${alias}.status = :status`, { status: statuses[0] });
  else if (statuses.length > 1) qb.andWhere(`${alias}.status IN (:...statuses)`, { statuses });
}

export async function paginate<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: { page?: number; pageSize?: number },
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 25));
  const [items, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
  return { items, total, page, pageSize };
}

/** Read a date-range export in batches so a large register is not cut off at 5,000 rows. */
export async function readAll<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, ceiling = 50_000): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  const pages = Math.ceil(ceiling / size);
  for (let page = 0; page < pages; page += 1) {
    const batch = await qb.clone().skip(page * size).take(size).getMany();
    rows.push(...batch);
    if (batch.length < size) break;
  }
  return rows;
}
