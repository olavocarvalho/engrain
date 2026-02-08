import type { TelemetryData } from './types.js';

/**
 * Analytics Engine column schema
 *
 * Cloudflare Analytics Engine uses positional columns (blob1–20, double1–20).
 * This mapping is the single source of truth for what each slot means.
 *
 * Blobs (strings):
 *   blob1  = event       (docs | check | remove | clear | sync)
 *   blob2  = source      (repo URL, docs only)
 *   blob3  = host        (github | gitlab | git | local, docs only)
 *   blob4  = name        (doc name, docs + remove)
 *   blob5  = profile     (docs | repo, docs only)
 *   blob6  = version     (CLI version, e.g. "1.1.0")
 *   blob7  = ci          ("0" | "1")
 *   blob8  = dev         ("0" | "1")
 *   blob9  = os          (macos | linux | windows)
 *
 * Doubles (numbers):
 *   double1 = sizeBytes / docCount / successCount  (docs: index size; check/clear: doc count; sync: success count)
 *   double2 = sizeTokens / outdatedCount / errorCount  (docs: token count; check: outdated count; sync: error count)
 *   double3 = fileCount              (docs only)
 *   double4 = elapsed                (docs only, seconds)
 *   double5 = dryRun                 (docs only, 0 | 1)
 *   double6 = existed                (docs only, 0 | 1)
 *
 * Query with aliases:
 *   SELECT timestamp, blob1 AS event, blob2 AS source, blob3 AS host,
 *          blob4 AS name, blob5 AS profile, blob6 AS version,
 *          blob7 AS ci, blob8 AS dev, blob9 AS os,
 *          double1, double2, double3, double4, double5, double6
 *   FROM engrain_telemetry
 *   ORDER BY timestamp DESC LIMIT 50
 */

const BLOB_COUNT = 9;
const DOUBLE_COUNT = 6;

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Map decoded event to Analytics Engine writeDataPoint payload.
 * Unused slots are "" (blobs) or 0 (doubles).
 * See column schema above for slot assignments.
 */
export function toDataPoint(
  event: TelemetryData,
  meta: { version: string; ci: string; dev: string; os: string }
): { indexes: [string]; blobs: string[]; doubles: number[] } {
  const blobs: string[] = [event.event, '', '', '', '', meta.version, meta.ci, meta.dev, meta.os];
  const doubles: number[] = [0, 0, 0, 0, 0, 0];

  switch (event.event) {
    case 'docs':
      blobs[1] = event.source;
      blobs[2] = event.host;
      blobs[3] = event.name;
      blobs[4] = event.profile;
      doubles[0] = num(event.sizeBytes);
      doubles[1] = num(event.sizeTokens);
      doubles[2] = num(event.fileCount);
      doubles[3] = num(event.elapsed);
      doubles[4] = event.dryRun === '1' ? 1 : 0;
      doubles[5] = event.existed === '1' ? 1 : 0;
      break;
    case 'check':
      doubles[0] = num(event.docCount);
      doubles[1] = num(event.outdatedCount);
      break;
    case 'remove':
      blobs[3] = event.name;
      break;
    case 'clear':
      doubles[0] = num(event.docCount);
      break;
    case 'sync':
      doubles[0] = num(event.successCount);
      doubles[1] = num(event.errorCount);
      break;
  }

  return {
    indexes: [event.event],
    blobs: blobs.slice(0, BLOB_COUNT),
    doubles: doubles.slice(0, DOUBLE_COUNT),
  };
}
