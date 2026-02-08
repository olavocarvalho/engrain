/**
 * Core type definitions for engrain
 */

// ============================================================================
// Source Parsing
// ============================================================================

export type SourceType = 'github' | 'gitlab' | 'git' | 'local';

export interface ParsedSource {
  type: SourceType;
  url: string;
  ref?: string;
  subpath?: string;
  owner?: string;
  repo?: string;
  localPath?: string;
}

// ============================================================================
// Lock File
// ============================================================================

export interface DocsLockEntry {
  source: string;
  /**
   * Normalized, cloneable URL used for remote operations (e.g. staleness checks).
   * Optional for backwards-compatibility with older lock files.
   */
  sourceUrl?: string;
  sourceType: SourceType;
  /**
   * Git ref (branch or tag). If undefined, the repository's default branch was used.
   */
  ref?: string;
  subpath?: string;
  commitHash: string;
  indexHash: string;
  indexSizeBytes: number;
  indexSizeTokens: number;
  installedAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface DocsLockFile {
  version: number;
  docs: Record<string, DocsLockEntry>;
}

// ============================================================================
// Index Generation
// ============================================================================

export interface IndexResult {
  content: string;
  sizeBytes: number;
  sizeTokens: number;
  fileCount: number;
  indexHash: string;
}

export interface FileEntry {
  path: string;
  relativePath: string;
}

export interface DirectoryGroup {
  directory: string;
  files: string[];
}

// ============================================================================
// Injection
// ============================================================================

export interface InjectionResult {
  filePath: string;
  docId: string;
  existed: boolean;
  sizeBytes: number;
  sizeTokens: number;
}

// ============================================================================
// Commands
// ============================================================================

export type DocsProfile = 'docs' | 'repo';

export interface DocsCommandOptions {
  output: string;
  engrainDir: string;
  name?: string;
  /**
   * Git ref (branch or tag). If undefined, the repository's default branch will be used.
   */
  ref?: string;
  /**
   * How to select what gets indexed when a URL has no explicit subpath.
   * - "docs" (default): auto-pick docs roots (docs/, doc/, documentation/) + root README*
   * - "repo": index the full repository contents
   */
  profile: DocsProfile;
  dryRun: boolean;
  force: boolean;
}

export interface CheckCommandOptions {
  docName?: string;
}

export interface RemoveCommandOptions {
  output: string;
}

export interface ClearCommandOptions {
  output: string;
  force: boolean;
}

export interface SyncCommandOptions {
  output: string;
  engrainDir: string;
}

// ============================================================================
// Errors
// ============================================================================

export class GitCloneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitCloneError';
  }
}

export class InjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InjectionError';
  }
}

export class CommandError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'CommandError';
    this.exitCode = exitCode;
  }
}
