/**
 * Test suite for engrain-tapi Worker
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import app from '../src/index';
import { createMockAnalyticsEngine, type MockAnalyticsEngine } from './helpers';

type Env = {
  ENGRAIN_TELEMETRY: MockAnalyticsEngine;
};

describe('engrain-tapi', () => {
  let mockEngrain: MockAnalyticsEngine;
  let env: Env;

  beforeEach(() => {
    mockEngrain = createMockAnalyticsEngine();
    env = { ENGRAIN_TELEMETRY: mockEngrain };
  });

  describe('GET /health', () => {
    test('returns ok status', async () => {
      const res = await app.request('/health', {}, env);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');
    });

    test('returns correct JSON body', async () => {
      const res = await app.request('/health', {}, env);
      const data = await res.json();

      expect(data).toEqual({ status: 'ok' });
    });
  });

  describe('GET /t (telemetry)', () => {
    describe('docs event', () => {
      test('writes data point with all fields', async () => {
        const res = await app.request(
          '/t?event=docs&source=https://github.com/test/repo&host=github&name=test-doc&profile=docs&sizeBytes=8192&sizeTokens=2048&fileCount=50&elapsed=2.5&v=1.1.0&ci=0&dev=1&os=macos',
          {},
          env
        );

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
        expect(mockEngrain.getDataPoints()).toHaveLength(1);

        const dp = mockEngrain.getDataPoints()[0];
        expect(dp.indexes).toEqual(['docs']);
        expect(dp.blobs).toHaveLength(9);
        expect(dp.blobs[0]).toBe('docs'); // event
        expect(dp.blobs[1]).toBe('https://github.com/test/repo'); // source
        expect(dp.blobs[2]).toBe('github'); // host
        expect(dp.blobs[3]).toBe('test-doc'); // name
        expect(dp.blobs[4]).toBe('docs'); // profile
        expect(dp.blobs[5]).toBe('1.1.0'); // version
        expect(dp.blobs[6]).toBe('0'); // ci
        expect(dp.blobs[7]).toBe('1'); // dev
        expect(['macos', 'linux', 'windows']).toContain(dp.blobs[8]); // os

        expect(dp.doubles).toHaveLength(6);
        expect(dp.doubles[0]).toBe(8192); // sizeBytes
        expect(dp.doubles[1]).toBe(2048); // sizeTokens
        expect(dp.doubles[2]).toBe(50); // fileCount
        expect(dp.doubles[3]).toBe(2.5); // elapsed
        expect(dp.doubles[4]).toBe(0); // dryRun
        expect(dp.doubles[5]).toBe(0); // existed
      });

      test('handles optional fields (dryRun, existed)', async () => {
        const res = await app.request(
          '/t?event=docs&source=https://github.com/test/repo&host=github&name=test&profile=docs&sizeBytes=1000&sizeTokens=250&fileCount=5&elapsed=1.0&dryRun=1&existed=1&v=1.1.0&ci=0&dev=0&os=linux',
          {},
          env
        );

        expect(res.status).toBe(200);
        const dp = mockEngrain.getDataPoints()[0];
        expect(dp.doubles[4]).toBe(1); // dryRun
        expect(dp.doubles[5]).toBe(1); // existed
        expect(dp.blobs[7]).toBe('0'); // dev
      });

      test('handles missing optional fields', async () => {
        const res = await app.request(
          '/t?event=docs&source=https://github.com/test/repo&host=github&name=test&profile=docs&sizeBytes=1000&sizeTokens=250&fileCount=5&elapsed=1.0&v=1.1.0',
          {},
          env
        );

        expect(res.status).toBe(200);
        const dp = mockEngrain.getDataPoints()[0];
        expect(dp.doubles[4]).toBe(0); // dryRun defaults to 0
        expect(dp.doubles[5]).toBe(0); // existed defaults to 0
        expect(dp.blobs[6]).toBe('0'); // ci defaults to 0
        expect(dp.blobs[7]).toBe('0'); // dev defaults to 0
        expect(dp.blobs[8]).toBe(''); // os defaults to empty string if not provided
      });
    });

    describe('check event', () => {
      test('writes data point with docCount and outdatedCount', async () => {
        const res = await app.request(
          '/t?event=check&docCount=5&outdatedCount=2&v=1.1.0&ci=1&dev=0&os=windows',
          {},
          env
        );

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
        expect(mockEngrain.getDataPoints()).toHaveLength(1);

        const dp = mockEngrain.getDataPoints()[0];
        expect(dp.indexes).toEqual(['check']);
        expect(dp.blobs[0]).toBe('check');
        expect(dp.blobs[5]).toBe('1.1.0'); // version
        expect(dp.blobs[6]).toBe('1'); // ci
        expect(dp.blobs[7]).toBe('0'); // dev
        expect(dp.blobs[8]).toBe('windows'); // os
        expect(dp.doubles[0]).toBe(5); // docCount
        expect(dp.doubles[1]).toBe(2); // outdatedCount
      });
    });

    describe('remove event', () => {
      test('writes data point with name', async () => {
        const res = await app.request(
          '/t?event=remove&name=test-doc&v=1.1.0&ci=0&dev=1&os=macos',
          {},
          env
        );

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
        expect(mockEngrain.getDataPoints()).toHaveLength(1);

        const dp = mockEngrain.getDataPoints()[0];
        expect(dp.indexes).toEqual(['remove']);
        expect(dp.blobs[0]).toBe('remove');
        expect(dp.blobs[3]).toBe('test-doc'); // name
        expect(dp.blobs[5]).toBe('1.1.0'); // version
        expect(dp.blobs[7]).toBe('1'); // dev
        expect(dp.blobs[8]).toBe('macos'); // os
      });
    });

    describe('clear event', () => {
      test('writes data point with docCount', async () => {
        const res = await app.request(
          '/t?event=clear&docCount=10&v=1.1.0&ci=0&dev=0&os=linux',
          {},
          env
        );

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
        expect(mockEngrain.getDataPoints()).toHaveLength(1);

        const dp = mockEngrain.getDataPoints()[0];
        expect(dp.indexes).toEqual(['clear']);
        expect(dp.blobs[0]).toBe('clear');
        expect(dp.blobs[8]).toBe('linux'); // os
        expect(dp.doubles[0]).toBe(10); // docCount
      });
    });

    describe('edge cases', () => {
      test('missing event param returns ok (no-op)', async () => {
        const res = await app.request('/t', {}, env);

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
        expect(mockEngrain.getDataPoints()).toHaveLength(0);
      });

      test('invalid event type returns ok (no-op)', async () => {
        const res = await app.request('/t?event=invalid', {}, env);

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
        expect(mockEngrain.getDataPoints()).toHaveLength(0);
      });

      test('empty query params returns ok', async () => {
        const res = await app.request('/t?', {}, env);

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
        expect(mockEngrain.getDataPoints()).toHaveLength(0);
      });

      test('handles missing numeric fields gracefully', async () => {
        const res = await app.request(
          '/t?event=docs&source=https://github.com/test/repo&host=github&name=test&profile=docs&v=1.1.0&os=macos',
          {},
          env
        );

        expect(res.status).toBe(200);
        const dp = mockEngrain.getDataPoints()[0];
        // Missing numeric fields should default to 0
        expect(dp.doubles[0]).toBe(0); // sizeBytes
        expect(dp.doubles[1]).toBe(0); // sizeTokens
        expect(dp.doubles[2]).toBe(0); // fileCount
        expect(dp.doubles[3]).toBe(0); // elapsed
        expect(dp.blobs[8]).toBe('macos'); // os
      });
    });
  });

  describe('CORS', () => {
    test('OPTIONS request returns CORS headers', async () => {
      const res = await app.request('/t', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:3000' },
      });

      // OPTIONS requests typically return 204 (No Content) or 200
      expect([200, 204]).toContain(res.status);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });

    test('GET request includes CORS headers', async () => {
      const res = await app.request('/health', {}, env);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
