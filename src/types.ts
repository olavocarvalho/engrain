/**
 * Core type definitions for engrain
 */

// ============================================================================
// Source Parsing
// ============================================================================

export type SourceType = "github" | "gitlab" | "git" | "local";

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
  ref: string;
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
  projects: Record<string, Record<string, DocsLockEntry>>;
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

export interface DocsCommandOptions {
  output: string;
  engrainDir: string;
  name?: string;
  ref: string;
  dryRun: boolean;
  force: boolean;
}

export interface CheckCommandOptions {
  docName?: string;
}

// ============================================================================
// Errors
// ============================================================================

export class GitCloneError extends Error {
  readonly url: string;
  readonly isTimeout: boolean;
  readonly isAuthError: boolean;

  constructor(message: string, url: string, isTimeout = false, isAuthError = false) {
    super(message);
    this.name = "GitCloneError";
    this.url = url;
    this.isTimeout = isTimeout;
    this.isAuthError = isAuthError;
  }
}

export class InjectionError extends Error {
  readonly filePath: string;
  readonly docId: string;

  constructor(message: string, filePath: string, docId: string) {
    super(message);
    this.name = "InjectionError";
    this.filePath = filePath;
    this.docId = docId;
  }
}

export class CommandError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CommandError";
    this.exitCode = exitCode;
  }
}
