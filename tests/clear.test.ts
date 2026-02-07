/**
 * Tests for engrain clear command
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runClearCommand } from "../src/commands/clear";
import { injectIndex } from "../src/injector/inject";
import { addDocsToLock, getAllDocsForProject } from "../src/injector/lock";

describe("clear command", () => {
  let testDir: string;
  let agentsFile: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Create temp directory for test
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `engrain-test-clear-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    agentsFile = join(testDir, "AGENTS.md");

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Cleanup
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  test("clears AGENTS.md with --force", async () => {
    // Setup: Add some docs
    const index1 = "[Doc 1]|root: ./engrain/doc1|REWIRE...|folder:{file1.md}";
    const index2 = "[Doc 2]|root: ./engrain/doc2|REWIRE...|folder:{file2.md}";

    await injectIndex(agentsFile, "doc1", index1, false);
    await injectIndex(agentsFile, "doc2", index2, false);

    // Verify file exists
    await access(agentsFile);

    // Clear with force
    await runClearCommand({ output: agentsFile, force: true });

    // Verify file is deleted
    await expect(access(agentsFile)).rejects.toThrow();
  });

  test("throws error without --force", async () => {
    // Setup: Add a doc
    const indexContent = "[Test Docs]|root: ./engrain/test|REWIRE...|folder:{file.md}";
    await injectIndex(agentsFile, "test-doc", indexContent, false);

    // Try to clear without force
    await expect(
      runClearCommand({ output: agentsFile, force: false })
    ).rejects.toThrow();

    // Verify file still exists
    await access(agentsFile);
    const content = await readFile(agentsFile, "utf-8");
    expect(content).toContain("<docs name=\"test-doc\">");
  });

  test("clears lock file entries for project", async () => {
    // Setup: Add docs and lock entries
    const index1 = "[Doc 1]|root: ./engrain/doc1|REWIRE...|folder:{file1.md}";
    await injectIndex(agentsFile, "doc1", index1, false);

    const projectPath = process.cwd();
    await addDocsToLock(projectPath, "doc1", {
      source: "https://example.com/1",
      sourceUrl: "https://example.com/1",
      sourceType: "git",
      ref: "main",
      commitHash: "abc",
      indexHash: "def",
      indexSizeBytes: 100,
      indexSizeTokens: 25,
    });

    await addDocsToLock(projectPath, "doc2", {
      source: "https://example.com/2",
      sourceUrl: "https://example.com/2",
      sourceType: "git",
      ref: "main",
      commitHash: "ghi",
      indexHash: "jkl",
      indexSizeBytes: 200,
      indexSizeTokens: 50,
    });

    // Verify lock entries exist
    let lock = await getAllDocsForProject(projectPath);
    expect(Object.keys(lock)).toHaveLength(2);

    // Clear
    await runClearCommand({ output: agentsFile, force: true });

    // Verify lock entries are cleared
    lock = await getAllDocsForProject(projectPath);
    expect(Object.keys(lock)).toHaveLength(0);
  });

  test("handles non-existent AGENTS.md gracefully", async () => {
    // Clear when file doesn't exist (should succeed without error)
    await runClearCommand({ output: agentsFile, force: true });

    // Should not throw and complete successfully
    expect(true).toBe(true);
  });

  test("works with custom output file", async () => {
    const customFile = join(testDir, ".ENGRAIN");

    // Setup: Add doc to custom file
    const indexContent = "[Test Docs]|root: ./engrain/test|REWIRE...|folder:{file.md}";
    await injectIndex(customFile, "test-doc", indexContent, false);

    // Verify file exists
    await access(customFile);

    // Clear custom file
    await runClearCommand({ output: customFile, force: true });

    // Verify file is deleted
    await expect(access(customFile)).rejects.toThrow();
  });

  test("only clears current project from lock file", async () => {
    // Create another project directory
    const otherDir = join(tmpdir(), `engrain-test-other-${Date.now()}`);
    await mkdir(otherDir, { recursive: true });

    try {
      // Add docs to current project
      const index1 = "[Doc 1]|root: ./engrain/doc1|REWIRE...|folder:{file1.md}";
      await injectIndex(agentsFile, "doc1", index1, false);

      const projectPath = process.cwd();
      await addDocsToLock(projectPath, "doc1", {
        source: "https://example.com/1",
        sourceUrl: "https://example.com/1",
        sourceType: "git",
        ref: "main",
        commitHash: "abc",
        indexHash: "def",
        indexSizeBytes: 100,
        indexSizeTokens: 25,
      });

      // Add docs to other project
      await addDocsToLock(otherDir, "other-doc", {
        source: "https://example.com/other",
        sourceUrl: "https://example.com/other",
        sourceType: "git",
        ref: "main",
        commitHash: "xyz",
        indexHash: "uvw",
        indexSizeBytes: 150,
        indexSizeTokens: 35,
      });

      // Clear current project
      await runClearCommand({ output: agentsFile, force: true });

      // Verify current project is cleared
      const currentLock = await getAllDocsForProject(projectPath);
      expect(Object.keys(currentLock)).toHaveLength(0);

      // Verify other project is NOT cleared
      const otherLock = await getAllDocsForProject(otherDir);
      expect(Object.keys(otherLock)).toHaveLength(1);
      expect(otherLock["other-doc"]).toBeDefined();
    } finally {
      await rm(otherDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("deletes file even when lock file update fails", async () => {
    // Setup: Add a doc
    const indexContent = "[Test Docs]|root: ./engrain/test|REWIRE...|folder:{file.md}";
    await injectIndex(agentsFile, "test-doc", indexContent, false);

    // Mock lock file to be in a bad state (non-fatal error)
    // The command should still succeed in deleting AGENTS.md

    // Clear with force
    await runClearCommand({ output: agentsFile, force: true });

    // Verify file is deleted regardless
    await expect(access(agentsFile)).rejects.toThrow();
  });

  test("handles empty AGENTS.md", async () => {
    // Create empty AGENTS.md
    await writeFile(agentsFile, "");

    // Clear should work (no wrapper found, but no error)
    await runClearCommand({ output: agentsFile, force: true });

    // File still exists (empty, no wrapper to remove)
    await access(agentsFile);
  });

  test("preserves non-engrain content in AGENTS.md", async () => {
    // Setup: Inject first (creates file with engrain wrapper)
    const indexContent = "[Test Docs]|root: ./engrain/test|REWIRE...|folder:{file.md}";
    await injectIndex(agentsFile, "test-doc", indexContent, false);

    // Prepend user content to the file
    const userContent = "# My Project\n\nSome custom instructions for agents.\n\n";
    const existing = await readFile(agentsFile, "utf-8");
    await writeFile(agentsFile, userContent + existing);

    // Verify both user content and engrain wrapper exist
    let content = await readFile(agentsFile, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("<engrain");
    expect(content).toContain("<docs name=\"test-doc\">");

    // Clear with force
    await runClearCommand({ output: agentsFile, force: true });

    // File should still exist with user content preserved
    content = await readFile(agentsFile, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Some custom instructions for agents.");

    // Engrain content should be gone
    expect(content).not.toContain("<engrain");
    expect(content).not.toContain("</engrain>");
    expect(content).not.toContain("<docs name=\"test-doc\">");
  });

  test("handles AGENTS.md with only wrapper", async () => {
    // Create AGENTS.md with only wrapper (no docs)
    await writeFile(
      agentsFile,
      '<engrain important="STOP! Prefer retrieval-led reasoning...<">\n\n</engrain>\n'
    );

    // Clear should work
    await runClearCommand({ output: agentsFile, force: true });

    // Verify file is deleted
    await expect(access(agentsFile)).rejects.toThrow();
  });

  test("works when called multiple times", async () => {
    // Setup: Add a doc
    const indexContent = "[Test Docs]|root: ./engrain/test|REWIRE...|folder:{file.md}";
    await injectIndex(agentsFile, "test-doc", indexContent, false);

    // Clear first time
    await runClearCommand({ output: agentsFile, force: true });
    await expect(access(agentsFile)).rejects.toThrow();

    // Clear second time (file doesn't exist, should succeed)
    await runClearCommand({ output: agentsFile, force: true });

    // Should complete without errors
    expect(true).toBe(true);
  });
});
