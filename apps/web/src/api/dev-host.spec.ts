import { describe, expect, it } from 'vitest';
import { apiBaseUrl, isLanHost, sameMachineUrl } from './dev-host';

describe('apiBaseUrl', () => {
  it('keeps the local API when the page is on localhost', () => {
    expect(
      apiBaseUrl('http://localhost:4000/api/v1', { hostname: 'localhost', origin: 'http://localhost:5174' }),
    ).toBe('http://localhost:4000/api/v1');
  });

  it('rewrites a localhost API onto the LAN address of this computer', () => {
    expect(
      sameMachineUrl('http://localhost:4000/api/v1', '10.170.0.50'),
    ).toBe('http://10.170.0.50:4000/api/v1');
    expect(isLanHost('10.170.0.50')).toBe(true);
  });

  it('uses this same host on a deployed site so Safari can keep the CSRF cookie', () => {
    expect(
      apiBaseUrl('https://ecg-she-api.onrender.com/api/v1', {
        hostname: 'ecgshe.netlify.app',
        origin: 'https://ecgshe.netlify.app',
      }),
    ).toBe('https://ecgshe.netlify.app/api/v1');
  });
});
