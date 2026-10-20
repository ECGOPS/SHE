import { UuidParamMiddleware } from './uuid-param.middleware';

const UUID = '8a373095-9670-4331-bb20-2ee2e169f274';

function run(params: Record<string, string>) {
  const next = jest.fn();
  let statusCode = 0;
  let payload: Record<string, unknown> = {};
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      payload = body;
    },
  };
  new UuidParamMiddleware().use({ params, originalUrl: '/api/v1/incidents/x' } as never, res as never, next);
  return { next, statusCode, payload };
}

describe('UuidParamMiddleware', () => {
  it('rejects an id that is not a UUID', () => {
    const result = run({ id: 'not-an-id' });
    expect(result.next).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(result.payload.errors).toEqual([{ field: 'id', message: 'id must be a valid id' }]);
  });

  it('accepts a UUID and leaves unrelated params alone', () => {
    const result = run({ id: UUID, code: 'ASW' });
    expect(result.next).toHaveBeenCalled();
  });
});
