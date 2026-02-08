import { decodeTelemetryParams, PARAM_KEYS, toDataPoint } from '@engrain/telemetry';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Env = {
  ENGRAIN_TELEMETRY: AnalyticsEngineDataset;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*' }));

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.get('/t', (c) => {
  const params = c.req.query();
  const searchParams = new URLSearchParams(params);
  const event = decodeTelemetryParams(searchParams);
  if (!event) {
    return c.text('ok');
  }
  const version = searchParams.get(PARAM_KEYS.version) ?? '';
  const ci = searchParams.get(PARAM_KEYS.ci) ?? '0';
  const dev = searchParams.get(PARAM_KEYS.dev) ?? '0';
  const os = searchParams.get(PARAM_KEYS.os) ?? '';
  const dp = toDataPoint(event, { version, ci, dev, os });
  c.env.ENGRAIN_TELEMETRY.writeDataPoint(dp);
  return c.text('ok');
});

export default app;
