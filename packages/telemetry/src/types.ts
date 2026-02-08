/** Documentation installed — fired after successful `engrain docs <url>` */
export interface DocsTelemetry {
  event: 'docs';
  source: string;
  host: string;
  name: string;
  profile: string;
  sizeBytes: string;
  sizeTokens: string;
  fileCount: string;
  elapsed: string;
  dryRun?: '1';
  existed?: '1';
}

/** Staleness check — fired after `engrain check` */
export interface CheckTelemetry {
  event: 'check';
  docCount: string;
  outdatedCount: string;
  dev?: '1';
}

/** Documentation removed — fired after `engrain remove <name>` */
export interface RemoveTelemetry {
  event: 'remove';
  name: string;
  dev?: '1';
}

/** All docs cleared — fired after `engrain clear` */
export interface ClearTelemetry {
  event: 'clear';
  docCount: string;
  dev?: '1';
}

/** Docs synchronized from lock file — fired after `engrain sync` */
export interface SyncTelemetry {
  event: 'sync';
  successCount: string; // Number of docs synced successfully
  errorCount: string; // Number of docs that failed to sync
  dev?: '1';
}

export type TelemetryData =
  | DocsTelemetry
  | CheckTelemetry
  | RemoveTelemetry
  | ClearTelemetry
  | SyncTelemetry;

export type TelemetryEventType = TelemetryData['event'];
