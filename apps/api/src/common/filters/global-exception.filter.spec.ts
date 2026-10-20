import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function capture(url = '/api/v1/incidents'): { host: ArgumentsHost; body: () => Record<string, unknown>; status: () => number } {
  let statusCode = 0;
  let payload: Record<string, unknown> = {};
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      payload = body;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'GET', url }),
    }),
  } as ArgumentsHost;
  return { host, body: () => payload, status: () => statusCode };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  it('returns field errors and does not echo the rejected value', () => {
    const caught = capture();
    filter.catch(
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Some fields are not valid.',
        errors: [{ field: 'title', message: 'title must be shorter than or equal to 200 characters' }],
      }),
      caught.host,
    );
    expect(caught.status()).toBe(400);
    expect(caught.body().errors).toEqual([
      { field: 'title', message: 'title must be shorter than or equal to 200 characters' },
    ]);
    expect(JSON.stringify(caught.body())).not.toContain('secret-title');
  });

  it('hides internal exception text on a server error', () => {
    const caught = capture();
    filter.catch(new Error('SQLITE_ERROR: near syntax at secret-table'), caught.host);
    expect(caught.status()).toBe(500);
    expect(caught.body().message).toBe('Internal server error');
    expect(JSON.stringify(caught.body())).not.toContain('secret-table');
  });

  it('returns a reflected query inside JSON and does not build an HTML page', () => {
    const url = '/api/v1/near-miss?search=<script>alert(1)</script>';
    const caught = capture(url);
    filter.catch(new BadRequestException('Some fields are not valid.'), caught.host);
    const body = caught.body();
    expect(body.path).toBe(url);
    expect(body.success).toBe(false);
    expect(JSON.stringify(body).includes('<html')).toBe(false);
    expect(JSON.parse(JSON.stringify(body)).path).toBe(url);
  });
});
