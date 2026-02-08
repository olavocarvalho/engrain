import type { TelemetryData } from './types.js';

/** Query param keys — single source of truth for CLI and API */
export const PARAM_KEYS = {
  event: 'event',
  source: 'source',
  host: 'host',
  name: 'name',
  profile: 'profile',
  version: 'v',
  ci: 'ci',
  dev: 'dev',
  os: 'os',
  sizeBytes: 'sizeBytes',
  sizeTokens: 'sizeTokens',
  fileCount: 'fileCount',
  elapsed: 'elapsed',
  dryRun: 'dryRun',
  existed: 'existed',
  docCount: 'docCount',
  outdatedCount: 'outdatedCount',
  successCount: 'sc',
  errorCount: 'ec',
} as const;

/**
 * Encode event data to URLSearchParams for CLI fire-and-forget GET.
 * Only includes defined, non-null values.
 */
export function encodeTelemetryParams(data: TelemetryData): URLSearchParams {
  const params = new URLSearchParams();
  params.set(PARAM_KEYS.event, data.event);

  if ('source' in data && data.source != null) params.set(PARAM_KEYS.source, data.source);
  if ('host' in data && data.host != null) params.set(PARAM_KEYS.host, data.host);
  if ('name' in data && data.name != null) params.set(PARAM_KEYS.name, data.name);
  if ('profile' in data && data.profile != null) params.set(PARAM_KEYS.profile, data.profile);
  if ('sizeBytes' in data && data.sizeBytes != null)
    params.set(PARAM_KEYS.sizeBytes, data.sizeBytes);
  if ('sizeTokens' in data && data.sizeTokens != null)
    params.set(PARAM_KEYS.sizeTokens, data.sizeTokens);
  if ('fileCount' in data && data.fileCount != null)
    params.set(PARAM_KEYS.fileCount, data.fileCount);
  if ('elapsed' in data && data.elapsed != null) params.set(PARAM_KEYS.elapsed, data.elapsed);
  if ('dryRun' in data && data.dryRun != null) params.set(PARAM_KEYS.dryRun, data.dryRun);
  if ('existed' in data && data.existed != null) params.set(PARAM_KEYS.existed, data.existed);
  if ('docCount' in data && data.docCount != null) params.set(PARAM_KEYS.docCount, data.docCount);
  if ('outdatedCount' in data && data.outdatedCount != null)
    params.set(PARAM_KEYS.outdatedCount, data.outdatedCount);
  if ('successCount' in data && data.successCount != null)
    params.set(PARAM_KEYS.successCount, data.successCount);
  if ('errorCount' in data && data.errorCount != null)
    params.set(PARAM_KEYS.errorCount, data.errorCount);
  if ('dev' in data && data.dev != null) params.set(PARAM_KEYS.dev, data.dev);

  return params;
}

function getParam(params: URLSearchParams, key: string): string {
  return params.get(key) ?? '';
}

/**
 * Decode URLSearchParams (e.g. from GET /t) into typed TelemetryData.
 * Used by the Worker to build the data point.
 */
export function decodeTelemetryParams(params: URLSearchParams): TelemetryData | null {
  const event = getParam(params, PARAM_KEYS.event);
  if (!event) return null;

  switch (event) {
    case 'docs':
      return {
        event: 'docs',
        source: getParam(params, PARAM_KEYS.source),
        host: getParam(params, PARAM_KEYS.host),
        name: getParam(params, PARAM_KEYS.name),
        profile: getParam(params, PARAM_KEYS.profile),
        sizeBytes: getParam(params, PARAM_KEYS.sizeBytes),
        sizeTokens: getParam(params, PARAM_KEYS.sizeTokens),
        fileCount: getParam(params, PARAM_KEYS.fileCount),
        elapsed: getParam(params, PARAM_KEYS.elapsed),
        dryRun: params.get(PARAM_KEYS.dryRun) === '1' ? '1' : undefined,
        existed: params.get(PARAM_KEYS.existed) === '1' ? '1' : undefined,
      } as TelemetryData;
    case 'check':
      return {
        event: 'check',
        docCount: getParam(params, PARAM_KEYS.docCount),
        outdatedCount: getParam(params, PARAM_KEYS.outdatedCount),
        dev: params.get(PARAM_KEYS.dev) === '1' ? '1' : undefined,
      };
    case 'remove':
      return {
        event: 'remove',
        name: getParam(params, PARAM_KEYS.name),
        dev: params.get(PARAM_KEYS.dev) === '1' ? '1' : undefined,
      };
    case 'clear':
      return {
        event: 'clear',
        docCount: getParam(params, PARAM_KEYS.docCount),
        dev: params.get(PARAM_KEYS.dev) === '1' ? '1' : undefined,
      };
    case 'sync':
      return {
        event: 'sync',
        successCount: getParam(params, PARAM_KEYS.successCount),
        errorCount: getParam(params, PARAM_KEYS.errorCount),
        dev: params.get(PARAM_KEYS.dev) === '1' ? '1' : undefined,
      };
    default:
      return null;
  }
}

/** Build params-like record with version, ci, and dev (CLI adds these before sending). */
export function withVersionAndCi(
  params: URLSearchParams,
  version: string,
  ci: string,
  dev: string
): URLSearchParams {
  const out = new URLSearchParams(params);
  if (version) out.set(PARAM_KEYS.version, version);
  out.set(PARAM_KEYS.ci, ci);
  out.set(PARAM_KEYS.dev, dev);
  return out;
}
