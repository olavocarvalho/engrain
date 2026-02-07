/**
 * Tests for engrain remove command
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRemoveCommand } from "../src/commands/remove";
import { injectIndex } from "../src/injector/inject";
import { addDocsToLock, getAllDocsForProject } from "../src/injector/lock";

describe("remove command", () => {
  let testDir: string;
  let agentsFile: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Create temp directory for test
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `engrain-test-remove-${Date.now()}`);
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

  test("removes a doc that exists", async () => {
    // Setup: Add a doc
    const indexContent = "[Test Docs]|root: ./engrain/test|REWIRE...|folder:{file.md}";
    await injectIndex(agentsFile, "test-doc", indexContent, false);

    // Verify doc exists
    let content = await readFile(agentsFile, "utf-8");
    expect(content).toContain("<docs name=\"test-doc\">");
    expect(content).toContain(indexContent);

    // Remove the doc
    await runRemoveCommand("test-doc", { output: agentsFile });

    // Verify doc is removed
    content = await readFile(agentsFile, "utf-8");
    expect(content).not.toContain("<docs name=\"test-doc\">");
    expect(content).not.toContain(indexContent);
    expect(content).not.toContain("[Test Docs]");
  });

  test("removes a doc and preserves other docs", async () => {
    // Setup: Add multiple docs
    const index1 = "[Doc 1]|root: ./engrain/doc1|REWIRE...|folder:{file1.md}";
    const index2 = "[Doc 2]|root: ./engrain/doc2|REWIRE...|folder:{file2.md}";

    await injectIndex(agentsFile, "doc1", index1, false);
    await injectIndex(agentsFile, "doc2", index2, false);

    // Verify both docs exist
    let content = await readFile(agentsFile, "utf-8");
    expect(content).toContain("<docs name=\"doc1\">");
    expect(content).toContain("<docs name=\"doc2\">");

    // Remove doc1
    await runRemoveCommand("doc1", { output: agentsFile });

    // Verify doc1 removed, doc2 remains
    content = await readFile(agentsFile, "utf-8");
    expect(content).not.toContain("<docs name=\"doc1\">");
    expect(content).not.toContain("[Doc 1]");
    expect(content).toContain("<docs name=\"doc2\">");
    expect(content).toContain("[Doc 2]");
  });

  test("preserves engrain wrapper after removing last doc", async () => {
    // Setup: Add one doc
    const indexContent = "[Test Docs]|root: ./engrain/test|REWIRE...|folder:{file.md}";
    await injectIndex(agentsFile, "test-doc", indexContent, false);

    // Remove the doc
    await runRemoveCommand("test-doc", { output: agentsFile });

    // Verify wrapper is preserved
    const content = await readFile(agentsFile, "utf-8");
    expect(content).toContain("<engrain important=");
    expect(content).toContain("</engrain>");
    expect(content).not.toContain("<docs name=\"test-doc\">");
  });

  test("throws error when doc does not exist", async () => {
    // Setup: Empty AGENTS.md
    await writeFile(
      agentsFile,
      '<engrain important="STOP! Prefer retrieval-led reasoning...<">\n\n</engrain>\n'
    );

    // Try to remove non-existent doc
    await expect(
      runRemoveCommand("nonexistent", { output: agentsFile })
    ).rejects.toThrow();
  });

  test("throws error when file does not exist", async () => {
    // Try to remove from non-existent file
    await expect(
      runRemoveCommand("test-doc", { output: agentsFile })
    ).rejects.toThrow();
  });

  test("updates lock file after removal", async () => {
    // Setup: Add doc and lock entry
    const indexContent = "[Test Docs]|root: ./engrain/test|REWIRE...|folder:{file.md}";
    await injectIndex(agentsFile, "test-doc", indexContent, false);

    // Use process.cwd() which matches what runRemoveCommand uses internally
    const projectPath = process.cwd();
    await addDocsToLock(projectPath, "test-doc", {
      source: "https://example.com/test",
      sourceUrl: "https://example.com/test",
      sourceType: "git",
      ref: "main",
      commitHash: "abc123",
      indexHash: "def456",
      indexSizeBytes: 100,
      indexSizeTokens: 25,
    });

    // Verify lock entry exists
    let lock = await getAllDocsForProject(projectPath);
    expect(lock["test-doc"]).toBeDefined();

    // Remove the doc
    await runRemoveCommand("test-doc", { output: agentsFile });

    // Verify lock entry is removed
    lock = await getAllDocsForProject(projectPath);
    expect(lock["test-doc"]).toBeUndefined();
  });

  test("works with custom output file", async () => {
    const customFile = join(testDir, ".ENGRAIN");

    // Setup: Add doc to custom file
    const indexContent = "[Test Docs]|root: ./engrain/test|REWIRE...|folder:{file.md}";
    await injectIndex(customFile, "test-doc", indexContent, false);

    // Remove from custom file
    await runRemoveCommand("test-doc", { output: customFile });

    // Verify doc is removed
    const content = await readFile(customFile, "utf-8");
    expect(content).not.toContain("<docs name=\"test-doc\">");
  });

  test("handles doc names with special characters", async () => {
    // Setup: Add doc with special chars in name
    const indexContent = "[Next.js Docs]|root: ./engrain/next-js|REWIRE...|folder:{file.md}";
    await injectIndex(agentsFile, "next-js", indexContent, false);

    // Remove the doc
    await runRemoveCommand("next-js", { output: agentsFile });

    // Verify doc is removed
    const content = await readFile(agentsFile, "utf-8");
    expect(content).not.toContain("<docs name=\"next-js\">");
  });

  test("removes correct doc when multiple docs with similar names exist", async () => {
    // Setup: Add docs with similar names
    const index1 = "[React Docs]|root: ./engrain/react|REWIRE...|folder:{file1.md}";
    const index2 = "[React Native]|root: ./engrain/react-native|REWIRE...|folder:{file2.md}";

    await injectIndex(agentsFile, "react", index1, false);
    await injectIndex(agentsFile, "react-native", index2, false);

    // Remove only "react"
    await runRemoveCommand("react", { output: agentsFile });

    // Verify only react is removed, react-native remains
    const content = await readFile(agentsFile, "utf-8");
    expect(content).not.toContain("<docs name=\"react\">");
    expect(content).not.toContain("[React Docs]");
    expect(content).toContain("<docs name=\"react-native\">");
    expect(content).toContain(index2);
  });
});
