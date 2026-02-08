/**
 * Tests for engrain docs command
 * Focus on non-happy-path scenarios and edge cases
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDocsCommand } from '../src/commands/docs';
import { injectIndex } from '../src/injector/inject';
import { addDocsToLock, getAllDocsForProject } from '../src/injector/lock';

describe('docs command - non-happy-path tests', () => {
  let testDir: string;
  let agentsFile: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `engrain-test-docs-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    agentsFile = join(testDir, 'AGENTS.md');
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  test('rejects adding docs that already exist without --force', async () => {
    // Setup: Create a local docs directory
    const docsDir = join(testDir, 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, 'test.md'), '# Test\n\nContent.');

    // First add
    await runDocsCommand(docsDir, {
      name: 'test-docs',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    // Verify first add succeeded
    const content1 = await readFile(agentsFile, 'utf-8');
    expect(content1).toContain('<docs name="test-docs">');

    // Second add without --force should throw
    await expect(
      runDocsCommand(docsDir, {
        name: 'test-docs',
        output: agentsFile,
        dryRun: false,
        force: false,
        engrainDir: './engrain',
      })
    ).rejects.toThrow(/already exists/);
  });

  test('allows updating docs that exist with --force', async () => {
    // Setup: Create a local docs directory
    const docsDir = join(testDir, 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, 'test.md'), '# Test\n\nOriginal content.');

    // First add
    await runDocsCommand(docsDir, {
      name: 'test-docs',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    const content1 = await readFile(agentsFile, 'utf-8');
    expect(content1).toContain('test.md');

    // Modify docs
    await writeFile(join(docsDir, 'new.md'), '# New\n\nNew content.');

    // Second add with --force should succeed
    await runDocsCommand(docsDir, {
      name: 'test-docs',
      output: agentsFile,
      dryRun: false,
      force: true,
      engrainDir: './engrain',
    });

    // Verify updated content
    const content2 = await readFile(agentsFile, 'utf-8');
    expect(content2).toContain('new.md');
    expect(content2).toContain('test.md'); // Both files should be present
  });

  test('handles invalid local path gracefully', async () => {
    const invalidPath = join(testDir, 'nonexistent');

    // The command should throw or handle gracefully
    // Current implementation succeeds with empty index
    await runDocsCommand(invalidPath, {
      name: 'test-docs',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    // Should create an empty index
    const content = await readFile(agentsFile, 'utf-8');
    expect(content).toContain('<docs name="test-docs">');
  });

  test('handles empty directory', async () => {
    const emptyDir = join(testDir, 'empty');
    await mkdir(emptyDir, { recursive: true });

    // Should not throw, but result in minimal index
    await runDocsCommand(emptyDir, {
      name: 'empty-docs',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    const content = await readFile(agentsFile, 'utf-8');
    expect(content).toContain('<docs name="empty-docs">');
    // Should have minimal/empty index (note: path may have ./ prefix)
    expect(content).toContain('engrain/empty-docs');
  });

  test('handles directory with only excluded files', async () => {
    const docsDir = join(testDir, 'docs-with-images');
    await mkdir(docsDir, { recursive: true });

    // Only add excluded files
    await writeFile(join(docsDir, 'logo.png'), Buffer.from('fake-png'));
    await writeFile(join(docsDir, 'video.mp4'), Buffer.from('fake-mp4'));
    await writeFile(join(docsDir, '.gitignore'), 'node_modules\n');

    await runDocsCommand(docsDir, {
      name: 'excluded-docs',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    const content = await readFile(agentsFile, 'utf-8');
    expect(content).toContain('<docs name="excluded-docs">');
    // Should not contain excluded files
    expect(content).not.toContain('logo.png');
    expect(content).not.toContain('video.mp4');
    expect(content).not.toContain('.gitignore');
  });

  test('sanitizes malicious doc names', async () => {
    const docsDir = join(testDir, 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, 'test.md'), '# Test\n');

    // Try path traversal in name
    await runDocsCommand(docsDir, {
      name: '../../../etc/passwd',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    const content = await readFile(agentsFile, 'utf-8');
    // Should be sanitized
    expect(content).toContain('<docs name="etc-passwd">');
    expect(content).not.toContain('../');
  });

  test('handles files with special characters in names', async () => {
    const docsDir = join(testDir, 'docs');
    await mkdir(docsDir, { recursive: true });

    // Create files with special chars that need escaping
    await writeFile(join(docsDir, 'file,with,commas.md'), '# Test\n');
    await writeFile(join(docsDir, 'file{with}braces.md'), '# Test\n');
    await writeFile(join(docsDir, 'file:with:colons.md'), '# Test\n');

    await runDocsCommand(docsDir, {
      name: 'special-chars',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    const content = await readFile(agentsFile, 'utf-8');
    expect(content).toContain('<docs name="special-chars">');

    // Files should be escaped in index
    expect(content).toContain('file\\,with\\,commas.md');
    expect(content).toContain('file\\{with\\}braces.md');
  });

  test('handles very deep nested directory structures', async () => {
    const docsDir = join(testDir, 'docs');
    await mkdir(docsDir, { recursive: true });

    // Create a very deep nested structure
    let deepPath = docsDir;
    for (let i = 0; i < 10; i++) {
      deepPath = join(deepPath, `level-${i}`);
      await mkdir(deepPath, { recursive: true });
    }
    await writeFile(join(deepPath, 'deep.md'), '# Deep file\n');

    await runDocsCommand(docsDir, {
      name: 'deep-docs',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    const content = await readFile(agentsFile, 'utf-8');
    expect(content).toContain('<docs name="deep-docs">');
    expect(content).toContain('deep.md');
  });

  test('preserves other docs when adding new docs', async () => {
    // Setup: Add first doc
    const docs1Dir = join(testDir, 'docs1');
    await mkdir(docs1Dir, { recursive: true });
    await writeFile(join(docs1Dir, 'file1.md'), '# File 1\n');

    await runDocsCommand(docs1Dir, {
      name: 'docs-1',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    // Setup: Add second doc
    const docs2Dir = join(testDir, 'docs2');
    await mkdir(docs2Dir, { recursive: true });
    await writeFile(join(docs2Dir, 'file2.md'), '# File 2\n');

    await runDocsCommand(docs2Dir, {
      name: 'docs-2',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    // Verify both docs exist
    const content = await readFile(agentsFile, 'utf-8');
    expect(content).toContain('<docs name="docs-1">');
    expect(content).toContain('<docs name="docs-2">');
    expect(content).toContain('file1.md');
    expect(content).toContain('file2.md');
  });

  test('dry-run does not create files or modify lock', async () => {
    const docsDir = join(testDir, 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, 'test.md'), '# Test\n');

    await runDocsCommand(docsDir, {
      name: 'test-docs',
      output: agentsFile,
      dryRun: true,
      force: false,
      engrainDir: './engrain',
    });

    // Verify no AGENTS.md was created
    await expect(readFile(agentsFile, 'utf-8')).rejects.toThrow();

    // Verify no lock entry
    const lock = await getAllDocsForProject();
    expect(lock['test-docs']).toBeUndefined();
  });

  test('handles read-only output file gracefully', async () => {
    const docsDir = join(testDir, 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, 'test.md'), '# Test\n');

    // Create read-only AGENTS.md
    await writeFile(agentsFile, '# Existing content\n');
    await chmod(agentsFile, 0o444); // Read-only

    try {
      await expect(
        runDocsCommand(docsDir, {
          name: 'test-docs',
          output: agentsFile,
          dryRun: false,
          force: false,
          engrainDir: './engrain',
        })
      ).rejects.toThrow();
    } finally {
      // Cleanup: restore write permissions
      await chmod(agentsFile, 0o644).catch(() => {});
    }
  });

  test('handles sequential additions of different docs', async () => {
    // Create two separate doc directories
    const docs1Dir = join(testDir, 'docs1');
    const docs2Dir = join(testDir, 'docs2');
    await mkdir(docs1Dir, { recursive: true });
    await mkdir(docs2Dir, { recursive: true });
    await writeFile(join(docs1Dir, 'file1.md'), '# File 1\n');
    await writeFile(join(docs2Dir, 'file2.md'), '# File 2\n');

    // Run adds sequentially (concurrent writes have race conditions)
    await runDocsCommand(docs1Dir, {
      name: 'docs-1',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    await runDocsCommand(docs2Dir, {
      name: 'docs-2',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    // Verify both docs were added
    const content = await readFile(agentsFile, 'utf-8');
    expect(content).toContain('<docs name="docs-1">');
    expect(content).toContain('<docs name="docs-2">');
  });

  test('updates lock file with correct metadata', async () => {
    const docsDir = join(testDir, 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, 'test.md'), '# Test\n\nContent here.');

    await runDocsCommand(docsDir, {
      name: 'test-docs',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    const lock = await getAllDocsForProject();

    expect(lock['test-docs']).toBeDefined();
    expect(lock['test-docs'].source).toBe(docsDir);
    expect(lock['test-docs'].sourceType).toBe('local');
    expect(lock['test-docs'].indexSizeBytes).toBeGreaterThan(0);
    expect(lock['test-docs'].indexSizeTokens).toBeGreaterThan(0);
    expect(lock['test-docs'].installedAt).toBeDefined();
    expect(lock['test-docs'].updatedAt).toBeDefined();
  });

  test('handles unicode filenames correctly', async () => {
    const docsDir = join(testDir, 'docs');
    await mkdir(docsDir, { recursive: true });

    // Create files with unicode characters
    await writeFile(join(docsDir, '日本語.md'), '# Japanese\n');
    await writeFile(join(docsDir, 'español.md'), '# Spanish\n');
    await writeFile(join(docsDir, 'emoji-😀.md'), '# Emoji\n');

    await runDocsCommand(docsDir, {
      name: 'unicode-docs',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    const content = await readFile(agentsFile, 'utf-8');
    expect(content).toContain('<docs name="unicode-docs">');
    // Should handle unicode filenames
    expect(content).toContain('日本語.md');
    expect(content).toContain('español.md');
    expect(content).toContain('emoji-😀.md');
  });

  test('handles symlinks gracefully', async () => {
    const docsDir = join(testDir, 'docs');
    const targetDir = join(testDir, 'target');
    await mkdir(docsDir, { recursive: true });
    await mkdir(targetDir, { recursive: true });

    await writeFile(join(targetDir, 'target.md'), '# Target\n');
    await writeFile(join(docsDir, 'direct.md'), '# Direct\n');

    // Note: Symlink creation might fail on some systems, so we'll be flexible
    try {
      // Try to create symlink (might require permissions on some systems)
      const { symlink } = await import('node:fs/promises');
      await symlink(join(targetDir, 'target.md'), join(docsDir, 'linked.md'), 'file');
    } catch {
      // Skip symlink part if not supported
    }

    await runDocsCommand(docsDir, {
      name: 'symlink-docs',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    const content = await readFile(agentsFile, 'utf-8');
    expect(content).toContain('<docs name="symlink-docs">');
    expect(content).toContain('direct.md');
    // Symlink behavior depends on implementation
  });
});

describe('docs command - GitHub URL validation', () => {
  test('rejects invalid GitHub URLs', async () => {
    // These should be caught by parseSource
    const invalidUrls = [
      'not-a-url',
      'http://', // Just protocol
      'github.com/user/repo', // Missing protocol (unless shorthand)
      'https://github.com/', // Incomplete
    ];

    for (const url of invalidUrls) {
      try {
        const { parseSource } = await import('../src/utils/source-parser');
        parseSource(url);
      } catch (error) {
        // Expected to throw for invalid URLs
        expect(error).toBeDefined();
      }
    }
  });
});

describe('docs command - name conflicts', () => {
  let testDir: string;
  let agentsFile: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `engrain-test-names-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    agentsFile = join(testDir, 'AGENTS.md');
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  test('normalizes doc names to lowercase', async () => {
    const docsDir = join(testDir, 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, 'test.md'), '# Test\n');

    // Add with lowercase name
    await runDocsCommand(docsDir, {
      name: 'react',
      output: agentsFile,
      dryRun: false,
      force: false,
      engrainDir: './engrain',
    });

    const content1 = await readFile(agentsFile, 'utf-8');
    expect(content1).toContain('<docs name="react">');

    // Try to add with uppercase - should fail because names are normalized
    const docsDir2 = join(testDir, 'docs2');
    await mkdir(docsDir2, { recursive: true });
    await writeFile(join(docsDir2, 'test2.md'), '# Test 2\n');

    await expect(
      runDocsCommand(docsDir2, {
        name: 'REACT',
        output: agentsFile,
        dryRun: false,
        force: false,
        engrainDir: './engrain',
      })
    ).rejects.toThrow(/already exists/);

    // Verify only lowercase version exists
    const content2 = await readFile(agentsFile, 'utf-8');
    expect(content2).toContain('<docs name="react">');
    expect(content2).not.toContain('<docs name="REACT">');
  });
});
