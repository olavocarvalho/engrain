# engrain-tapi

Telemetry ingest Worker for the engrain CLI. Exposes `GET /t` (ingest) and `GET /health`.

## One-time setup

1. **Enable Analytics Engine** (required before first deploy):
   - Open: https://dash.cloudflare.com/68bef91e70127a4c1c32666736b67fd4/workers/analytics-engine
   - Enable the product for your account.

2. **Deploy** (from this directory or repo root):
   ```bash
   cd apps/tapi && npx wrangler deploy
   # or from root: bun run deploy
   ```
   After a successful deploy, Wrangler prints your Worker URL, e.g.:
   `https://engrain-t.<your-subdomain>.workers.dev`

3. **Point the CLI at your Worker** (optional if you don’t use the default):
   - Set `ENGRAIN_TELEMETRY_URL` to your Worker URL + `/t`, e.g.:
     `export ENGRAIN_TELEMETRY_URL=https://engrain-t.<subdomain>.workers.dev/t`
   - Or change the default in `apps/cli/src/telemetry.ts`.

## Commands

- `bun run dev` — local dev server (runs on http://localhost:8787)
- `bun run deploy` — deploy to Cloudflare
- `bun run check` — typecheck
- `bun run test` — run test suite
- `bun run test:watch` — run tests in watch mode

## Querying telemetry data

Cloudflare Analytics Engine uses positional columns (`blob1`–`blob20`, `double1`–`double20`).
Use aliases to make queries readable. The column schema is defined in
[`packages/telemetry/src/data-point.ts`](../../packages/telemetry/src/data-point.ts).

**All events (readable):**
```sql
SELECT
  timestamp,
  blob1  AS event,
  blob2  AS source,
  blob3  AS host,
  blob4  AS name,
  blob5  AS profile,
  blob6  AS version,
  blob7  AS ci,
  blob8  AS dev,
  blob9  AS os,
  double1, double2, double3, double4, double5, double6
FROM engrain_telemetry
ORDER BY timestamp DESC
LIMIT 50
```

**Docs events only:**
```sql
SELECT
  timestamp,
  blob2  AS source,
  blob4  AS name,
  blob5  AS profile,
  blob6  AS version,
  blob9  AS os,
  double1 AS size_bytes,
  double2 AS size_tokens,
  double3 AS file_count,
  double4 AS elapsed_s,
  double5 AS dry_run,
  double6 AS existed
FROM engrain_telemetry
WHERE index1 = 'docs'
ORDER BY timestamp DESC
LIMIT 50
```

**Daily usage counts:**
```sql
SELECT
  toDate(timestamp) AS day,
  blob1 AS event,
  count() AS total
FROM engrain_telemetry
GROUP BY day, event
ORDER BY day DESC
```

Run queries via the [Analytics Engine SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/):
```bash
curl "https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer CF_API_TOKEN" \
  -d "SELECT ..."
```

## Testing

The Worker includes comprehensive test coverage using Bun's built-in test framework:

```bash
# Run tests
bun test

# Watch mode
bun test --watch

# From repo root
bun run test --filter=engrain-tapi
```

Tests cover:
- Health endpoint (`GET /health`)
- All telemetry event types (docs, check, remove, clear)
- CORS headers
- Edge cases (missing params, invalid events)
- Analytics Engine data point structure

See [`TEST_PLAN.md`](./TEST_PLAN.md) for detailed test coverage.
