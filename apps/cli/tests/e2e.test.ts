/**
 * End-to-End Tests for engrain CLI
 * Full workflow testing with real GitHub repositories
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI_PATH = join(import.meta.dir, '..', 'src', 'engrain.ts');
const BUN_BIN = process.execPath;
const TEST_REPO = 'https://github.com/anthropics/anthropic-quickstarts';

interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run CLI command and capture output
 */
async function runCLI(args: string[], cwd: string): Promise<CLIResult> {
  return new Promise((resolve) => {
    const proc = spawn(BUN_BIN, [CLI_PATH, ...args], {
      env: {
        ...process.env,
        NO_COLOR: '1',
        ENGRAIN_DEV: '1',
        ENGRAIN_DISABLE_TELEMETRY: '1', // Disable telemetry for tests
      },
      cwd,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

describe('E2E: Full Workflow Tests', () => {
  let testDir: string;
  let agentsFile: string;
  let engrainDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `engrain-e2e-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    agentsFile = join(testDir, 'AGENTS.md');
    engrainDir = join(testDir, '.engrain');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  test('E2E: docs command with dry-run', async () => {
    const { stdout, exitCode } = await runCLI(
      ['docs', TEST_REPO, '--name', 'test-quickstarts', '--dry-run'],
      testDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain('test-quickstarts');
    expect(stdout).toContain('github');
    expect(stdout).toMatch(/cloned|Cloned/i);
    expect(stdout).toMatch(/indexed|Indexed/i);
    expect(stdout).toContain('files');
    expect(stdout).toContain('KB');
    expect(stdout).toContain('tokens');
    expect(stdout).toMatch(/dry run|Dry Run/i);
    expect(stdout).toContain('done');

    // Verify AGENTS.md was NOT created (dry-run)
    try {
      await readFile(agentsFile);
      expect.unreachable('AGENTS.md should not exist after dry-run');
    } catch (error) {
      expect(error).toBeDefined();
    }
  }, 60000); // 60s timeout for git clone

  test('E2E: docs command creates AGENTS.md and tracks in lock file', async () => {
    const { stdout, exitCode } = await runCLI(
      ['docs', TEST_REPO, '--name', 'quickstarts'],
      testDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain('quickstarts');
    expect(stdout).toMatch(/engrained|created/i);
    expect(stdout).toContain('AGENTS.md');
    expect(stdout).toContain('done');

    // Verify AGENTS.md was created
    const agentsContent = await readFile(agentsFile, 'utf-8');
    expect(agentsContent).toContain('<engrain');
    expect(agentsContent).toContain('<docs name="quickstarts">');
    expect(agentsContent).toContain('[quickstarts Docs Index]');
    expect(agentsContent).toContain('root: ./.engrain/quickstarts');
    expect(agentsContent).toContain('REWIRE. What you remember');
    expect(agentsContent).toContain('</docs>');

    // Verify index is pipe-delimited format
    expect(agentsContent).toMatch(/\|[^|]+:\{[^}]+\}/);

    // Verify lock file was updated (now in project root)
    const lockPath = join(testDir, '.engrain-lock.json');
    const lockContent = await readFile(lockPath, 'utf-8');
    const lock = JSON.parse(lockContent);

    // Lock file should have docs entry
    expect(lock.docs).toBeDefined();
    expect(lock.docs).toHaveProperty('quickstarts');
    expect(lock.docs.quickstarts).toMatchObject({
      source: TEST_REPO,
      sourceType: 'github',
      ref: 'main',
    });
    expect(lock.docs.quickstarts.commitHash).toMatch(/^[0-9a-f]{40}$/);
    expect(lock.docs.quickstarts.indexHash).toMatch(/^[0-9a-f]{64}$/);
    expect(lock.docs.quickstarts.indexSizeBytes).toBeGreaterThan(0);
    expect(lock.docs.quickstarts.indexSizeTokens).toBeGreaterThan(0);
    expect(lock.docs.quickstarts.installedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(lock.docs.quickstarts.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Verify .engrain directory was created
    const engrainFiles = await readFile(
      join(engrainDir, 'quickstarts', 'README.md'),
      'utf-8'
    );
    expect(engrainFiles).toBeTruthy();
  }, 60000);

  test('E2E: docs command with --force updates existing entry', async () => {
    // First installation
    const { stdout: stdout1, exitCode: exitCode1 } = await runCLI(
      ['docs', TEST_REPO, '--name', 'quickstarts'],
      testDir
    );

    expect(exitCode1).toBe(0);
    expect(stdout1).toMatch(/engrained|created/i);

    const agentsContent1 = await readFile(agentsFile, 'utf-8');
    const docBlocks1 = (agentsContent1.match(/<docs name="quickstarts">/g) || []).length;
    expect(docBlocks1).toBe(1);

    // Second installation with --force
    const { stdout: stdout2, exitCode: exitCode2 } = await runCLI(
      ['docs', TEST_REPO, '--name', 'quickstarts', '--force'],
      testDir
    );

    expect(exitCode2).toBe(0);
    expect(stdout2).toMatch(/updated|Updated/i);
    expect(stdout2).toContain('AGENTS.md');

    // Verify still only one docs block (idempotent)
    const agentsContent2 = await readFile(agentsFile, 'utf-8');
    const docBlocks2 = (agentsContent2.match(/<docs name="quickstarts">/g) || []).length;
    expect(docBlocks2).toBe(1);

    // Verify lock file has the entry
    const lockPath = join(process.env.HOME!, '.engrain', '.engrain-lock.json');
    const lock2 = JSON.parse(await readFile(lockPath, 'utf-8'));
    const projectEntry2 = Object.entries(lock2.projects).find(([path]) =>
      path.includes('engrain-e2e')
    );
    expect(projectEntry2).toBeDefined();
    expect(projectEntry2![1].quickstarts).toBeDefined();
    expect(projectEntry2![1].quickstarts.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }, 120000);

  test('E2E: docs command rejects duplicate without --force', async () => {
    // First installation
    await runCLI(['docs', TEST_REPO, '--name', 'quickstarts'], testDir);

    // Second installation without --force should fail
    const { stdout, stderr, exitCode } = await runCLI(
      ['docs', TEST_REPO, '--name', 'quickstarts'],
      testDir
    );

    expect(exitCode).toBe(1);
    const output = stdout + stderr;
    expect(output).toMatch(/already exists|exists/i);
    expect(output).toMatch(/--force/i);
  }, 120000);

  test('E2E: multiple docs can coexist in AGENTS.md', async () => {
    // Install first doc
    await runCLI(['docs', TEST_REPO, '--name', 'doc1'], testDir);

    // Install second doc (different name)
    await runCLI(['docs', TEST_REPO, '--name', 'doc2'], testDir);

    // Verify both exist in AGENTS.md
    const agentsContent = await readFile(agentsFile, 'utf-8');
    expect(agentsContent).toContain('<docs name="doc1">');
    expect(agentsContent).toContain('<docs name="doc2">');
    expect(agentsContent).toContain('</docs>');

    const docBlocks = (agentsContent.match(/<docs name="/g) || []).length;
    expect(docBlocks).toBe(2);
  }, 120000);
});

describe('E2E: Check Command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `engrain-check-e2e-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  test('E2E: check command with no docs shows helpful message', async () => {
    const { stdout, exitCode } = await runCLI(['check'], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('no docs installed');
    expect(stdout).toContain('engrain docs');
  });

  test('E2E: check command validates installed docs', async () => {
    // Install a doc first
    await runCLI(['docs', TEST_REPO, '--name', 'test-check'], testDir);

    // Run check
    const { stdout, exitCode } = await runCLI(['check'], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('test-check');
    expect(stdout).toMatch(/up to date|outdated|checking/i);
    expect(stdout).toMatch(/doc\(s\) checked/i);
  }, 60000);

  test('E2E: check command with specific doc name', async () => {
    // Install docs
    await runCLI(['docs', TEST_REPO, '--name', 'doc1'], testDir);
    await runCLI(['docs', TEST_REPO, '--name', 'doc2'], testDir);

    // Check specific doc
    const { stdout, exitCode } = await runCLI(['check', 'doc1'], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('doc1');
    expect(stdout).toMatch(/1 doc\(s\) checked/i);
  }, 120000);

  test('E2E: check command fails on non-existent doc', async () => {
    // Install a doc first so we have docs in the project
    await runCLI(['docs', TEST_REPO, '--name', 'existing'], testDir);

    // Now try to check non-existent doc
    const { stdout, stderr, exitCode } = await runCLI(['check', 'nonexistent'], testDir);

    expect(exitCode).toBe(1);
    const output = stdout + stderr;
    expect(output).toMatch(/not found/i);
  }, 60000);
});

describe('E2E: Remove Command', () => {
  let testDir: string;
  let agentsFile: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `engrain-remove-e2e-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    agentsFile = join(testDir, 'AGENTS.md');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  test('E2E: remove command deletes doc from AGENTS.md and lock file', async () => {
    // Install doc
    await runCLI(['docs', TEST_REPO, '--name', 'to-remove'], testDir);

    // Verify it exists
    const before = await readFile(agentsFile, 'utf-8');
    expect(before).toContain('<docs name="to-remove">');

    // Remove it
    const { stdout, exitCode } = await runCLI(['remove', 'to-remove'], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/removed|deleted/i);
    expect(stdout).toContain('to-remove');

    // Verify it's gone from AGENTS.md
    const after = await readFile(agentsFile, 'utf-8');
    expect(after).not.toContain('<docs name="to-remove">');

    // Verify lock file no longer has entry
    const lockPath = join(process.env.HOME!, '.engrain', '.engrain-lock.json');
    const lock = JSON.parse(await readFile(lockPath, 'utf-8'));
    const projectEntry = Object.entries(lock.projects).find(([path]) =>
      path.includes('engrain-remove-e2e')
    );

    if (projectEntry) {
      expect(projectEntry[1]).not.toHaveProperty('to-remove');
    }
  }, 60000);

  test('E2E: remove command fails on non-existent doc', async () => {
    const { stdout, stderr, exitCode } = await runCLI(['remove', 'nonexistent'], testDir);

    expect(exitCode).toBe(1);
    const output = stdout + stderr;
    expect(output).toMatch(/not found|does not exist/i);
  });

  test('E2E: remove one doc leaves others intact', async () => {
    // Install multiple docs
    await runCLI(['docs', TEST_REPO, '--name', 'keep'], testDir);
    await runCLI(['docs', TEST_REPO, '--name', 'delete'], testDir);

    // Remove one
    await runCLI(['remove', 'delete'], testDir);

    // Verify only deleted doc is gone
    const content = await readFile(agentsFile, 'utf-8');
    expect(content).toContain('<docs name="keep">');
    expect(content).not.toContain('<docs name="delete">');
  }, 120000);
});

describe('E2E: Clear Command', () => {
  let testDir: string;
  let agentsFile: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `engrain-clear-e2e-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    agentsFile = join(testDir, 'AGENTS.md');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  test('E2E: clear command removes all docs', async () => {
    // Install multiple docs
    await runCLI(['docs', TEST_REPO, '--name', 'doc1'], testDir);
    await runCLI(['docs', TEST_REPO, '--name', 'doc2'], testDir);

    // Verify they exist
    const before = await readFile(agentsFile, 'utf-8');
    expect(before).toContain('<docs name="doc1">');
    expect(before).toContain('<docs name="doc2">');

    // Clear all (with --force to skip confirmation)
    const { stdout, exitCode } = await runCLI(['clear', '--force'], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/cleared|removed/i);

    // Verify docs are cleared (AGENTS.md may or may not exist after clear)
    try {
      const after = await readFile(agentsFile, 'utf-8');
      expect(after).not.toContain('<docs name="doc1">');
      expect(after).not.toContain('<docs name="doc2">');
    } catch (error) {
      // File may be removed if it becomes empty - that's also valid
      expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
    }
  }, 120000);

  test('E2E: clear with no docs shows message', async () => {
    const { stdout, exitCode } = await runCLI(['clear', '--force'], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/nothing to clear/i);
  });
});

describe('E2E: Integration Scenarios', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `engrain-integration-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  test('E2E: full workflow - install, check, update, remove', async () => {
    // 1. Install
    const install = await runCLI(['docs', TEST_REPO, '--name', 'workflow'], testDir);
    expect(install.exitCode).toBe(0);
    expect(install.stdout).toContain('workflow');

    // 2. Check
    const check = await runCLI(['check', 'workflow'], testDir);
    expect(check.exitCode).toBe(0);
    expect(check.stdout).toContain('workflow');

    // 3. Update with --force
    const update = await runCLI(
      ['docs', TEST_REPO, '--name', 'workflow', '--force'],
      testDir
    );
    expect(update.exitCode).toBe(0);
    expect(update.stdout).toMatch(/updated/i);

    // 4. Remove
    const remove = await runCLI(['remove', 'workflow'], testDir);
    expect(remove.exitCode).toBe(0);
    expect(remove.stdout).toMatch(/removed/i);

    // 5. Verify it's gone - check should show "no docs installed"
    const checkAfter = await runCLI(['check'], testDir);
    expect(checkAfter.exitCode).toBe(0);
    expect(checkAfter.stdout).toMatch(/no docs installed/i);
  }, 180000); // 3 minutes for full workflow
});
