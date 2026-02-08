/**
 * CLI telemetry — fire-and-forget GET to Worker.
 * Opt-out: ENGRAIN_DISABLE_TELEMETRY=1 or DO_NOT_TRACK=1.
 * Dev mode: ENGRAIN_DEV=1 (or auto-detected from /src/ path or NODE_ENV=development)
 */

import type { TelemetryData } from '@engrain/telemetry';
import { encodeTelemetryParams } from '@engrain/telemetry';

const TELEMETRY_URL =
  process.env.ENGRAIN_TELEMETRY_URL ?? 'https://engrain-t.engrain.workers.dev/t';

let cliVersion: string | null = null;

function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.BUILDKITE ||
    process.env.JENKINS_URL ||
    process.env.TEAMCITY_VERSION
  );
}

function isDev(): boolean {
  // Explicit env var override (highest priority)
  if (process.env.ENGRAIN_DEV === '1') return true;
  if (process.env.ENGRAIN_DEV === '0') return false;

  // Check if running from source (dev mode) vs built bundle (production)
  // In dev: bun src/engrain.ts (file path contains /src/)
  // In prod: node dist/engrain.js (file path contains /dist/)
  if (typeof import.meta.url === 'string') {
    return import.meta.url.includes('/src/');
  }
  // Fallback: check NODE_ENV
  return process.env.NODE_ENV === 'development';
}

function getOS(): string {
  const platform = process.platform;
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  if (platform === 'win32') return 'windows';
  return platform; // fallback for other platforms
}

function isEnabled(): boolean {
  return !process.env.ENGRAIN_DISABLE_TELEMETRY && !process.env.DO_NOT_TRACK;
}

export function setVersion(version: string): void {
  cliVersion = version;
}

export function track(data: TelemetryData): void {
  if (!isEnabled()) return;

  try {
    const params = encodeTelemetryParams(data);
    if (cliVersion) params.set('v', cliVersion);
    if (isCI()) params.set('ci', '1');
    if (isDev()) params.set('dev', '1');
    params.set('os', getOS());
    fetch(`${TELEMETRY_URL}?${params.toString()}`).catch(() => {});
  } catch {
    // Silently fail — telemetry should never break the CLI
  }
}
