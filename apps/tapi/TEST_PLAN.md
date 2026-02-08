# Test Coverage Plan — engrain-tapi

## Overview

Test coverage for the telemetry ingest Worker (`engrain-tapi`). Uses Bun's built-in test framework (consistent with CLI) and Hono's `app.request()` API for simple, fast tests.

## Test Framework

- **Runtime**: Bun (built-in `bun:test`)
- **Testing API**: Hono's `app.request()` for route testing
- **Mocking**: Manual mocks for Analytics Engine bindings
- **No external dependencies**: Uses Bun's native test runner

## Test Structure

```
apps/tapi/
├── src/
│   └── index.ts          # Worker implementation
├── tests/
│   ├── index.test.ts      # Main test suite
│   └── helpers.ts         # Test utilities (mock bindings, helpers)
├── package.json
└── wrangler.jsonc
```

## Test Cases

### 1. Health Endpoint (`GET /health`)

**Test**: Basic health check
- ✅ Returns 200 status
- ✅ Returns JSON `{ status: "ok" }`
- ✅ No environment bindings required

### 2. Telemetry Endpoint (`GET /t`)

#### 2.1 Docs Event
- ✅ Valid docs event writes to Analytics Engine
- ✅ All fields mapped correctly (source, host, name, profile, sizes, etc.)
- ✅ Version, CI, and dev flags included
- ✅ Returns "ok" response
- ✅ CORS headers present

#### 2.2 Check Event
- ✅ Valid check event writes to Analytics Engine
- ✅ docCount and outdatedCount mapped correctly
- ✅ Returns "ok" response

#### 2.3 Remove Event
- ✅ Valid remove event writes to Analytics Engine
- ✅ Name field mapped correctly
- ✅ Returns "ok" response

#### 2.4 Clear Event
- ✅ Valid clear event writes to Analytics Engine
- ✅ docCount mapped correctly
- ✅ Returns "ok" response

#### 2.5 Edge Cases
- ✅ Missing event param returns "ok" (no-op)
- ✅ Invalid event type returns "ok" (no-op)
- ✅ Missing optional fields handled gracefully
- ✅ Empty query params returns "ok"

### 3. CORS

- ✅ OPTIONS request returns CORS headers
- ✅ GET request includes CORS headers
- ✅ `Access-Control-Allow-Origin: *` present
- ✅ `Access-Control-Allow-Methods` includes GET

### 4. Analytics Engine Integration

- ✅ `writeDataPoint()` called with correct structure
- ✅ Blob array has correct length (8)
- ✅ Doubles array has correct length (6)
- ✅ Indexes array contains event type
- ✅ Unused fields are empty strings or 0

### 5. Error Handling

- ✅ Analytics Engine write failures don't crash Worker
- ✅ Invalid data handled gracefully
- ✅ Malformed query params handled gracefully

## Implementation

### Mock Analytics Engine

```typescript
// tests/helpers.ts
export function createMockAnalyticsEngine() {
  const dataPoints: Array<{
    indexes: [string];
    blobs: string[];
    doubles: number[];
  }> = [];

  return {
    writeDataPoint: (dp: {
      indexes: [string];
      blobs: string[];
      doubles: number[];
    }) => {
      dataPoints.push(dp);
    },
    getDataPoints: () => dataPoints,
    clear: () => {
      dataPoints.length = 0;
    },
  };
}
```

### Test Example

```typescript
// tests/index.test.ts
import { describe, expect, test, beforeEach } from 'bun:test';
import app from '../src/index';
import { createMockAnalyticsEngine } from './helpers';

describe('engrain-tapi', () => {
  let mockEngrain: ReturnType<typeof createMockAnalyticsEngine>;
  let env: { ENGRAIN: ReturnType<typeof createMockAnalyticsEngine> };

  beforeEach(() => {
    mockEngrain = createMockAnalyticsEngine();
    env = { ENGRAIN: mockEngrain };
  });

  test('GET /health returns ok', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ status: 'ok' });
  });

  test('GET /t with docs event writes data point', async () => {
    const res = await app.request(
      '/t?event=docs&source=https://github.com/test/repo&host=github&name=test&profile=docs&sizeBytes=1000&sizeTokens=250&fileCount=5&elapsed=1.5&v=1.1.0&ci=0&dev=1',
      {},
      env
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(mockEngrain.getDataPoints()).toHaveLength(1);

    const dp = mockEngrain.getDataPoints()[0];
    expect(dp.indexes).toEqual(['docs']);
    expect(dp.blobs[0]).toBe('docs'); // event
    expect(dp.blobs[1]).toBe('https://github.com/test/repo'); // source
    expect(dp.blobs[2]).toBe('github'); // host
    expect(dp.blobs[3]).toBe('test'); // name
    expect(dp.blobs[4]).toBe('docs'); // profile
    expect(dp.blobs[5]).toBe('1.1.0'); // version
    expect(dp.blobs[6]).toBe('0'); // ci
    expect(dp.blobs[7]).toBe('1'); // dev
    expect(dp.doubles[0]).toBe(1000); // sizeBytes
    expect(dp.doubles[1]).toBe(250); // sizeTokens
    expect(dp.doubles[2]).toBe(5); // fileCount
    expect(dp.doubles[3]).toBe(1.5); // elapsed
  });

  // ... more tests
});
```

## Test Commands

Add to `apps/tapi/package.json`:

```json
{
  "scripts": {
    "test": "bun test tests/*.test.ts",
    "test:watch": "bun test --watch tests/*.test.ts"
  }
}
```

## Coverage Goals

- **Unit tests**: 100% coverage of route handlers
- **Integration tests**: Analytics Engine binding behavior
- **Edge cases**: Invalid inputs, missing params, error handling
- **CORS**: Verify headers on all endpoints

## Running Tests

```bash
# From repo root
bun run test --filter=engrain-tapi

# From apps/tapi
cd apps/tapi
bun test

# Watch mode
bun test --watch
```

## CI Integration

Tests run automatically in GitHub Actions (via `turbo run test`). No additional setup needed.
