/**
 * Smoke tests for engrain CLI
 * Basic sanity checks to ensure core functionality works
 */

import { describe, test, expect } from "bun:test";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI_PATH = join(import.meta.dir, "..", "src", "engrain.ts");

/**
 * Helper to run CLI command and capture output
 */
async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("bun", [CLI_PATH, ...args], {
      env: { ...process.env, NO_COLOR: "1" },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

describe("CLI Smoke Tests", () => {
  test("--help shows help text", async () => {
    const { stdout, exitCode } = await runCLI(["--help"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("engrain");
    expect(stdout).toContain("docs");
    expect(stdout).toContain("check");
  });

  test("--version shows version", async () => {
    const { stdout, exitCode } = await runCLI(["--version"]);

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\d+\.\d+\.\d+/); // Version number format
  });

  test("docs --help shows docs command help", async () => {
    const { stdout, exitCode } = await runCLI(["docs", "--help"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("engrain docs");
    expect(stdout).toContain("--output");
    expect(stdout).toContain("--engrain-dir");
    expect(stdout).toContain("--name");
    expect(stdout).toContain("--ref");
    expect(stdout).toContain("--dry-run");
    expect(stdout).toContain("--force");
  });

  test("check --help shows check command help", async () => {
    const { stdout, exitCode } = await runCLI(["check", "--help"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("engrain check");
  });

  test("docs with local path and dry-run works", async () => {
    // Create temp directory with test docs
    const testDir = join(tmpdir(), `engrain-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      // Create test documentation files
      await writeFile(join(testDir, "README.md"), "# Test Doc\n\nContent here.");
      await writeFile(join(testDir, "guide.md"), "# Guide\n\nGuide content.");

      // Run engrain docs with dry-run
      const { stdout, exitCode } = await runCLI([
        "docs",
        testDir,
        "--name",
        "test-docs",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Parsing source");
      expect(stdout).toContain("Generating index");
      expect(stdout).toContain("Indexed");
      expect(stdout).toContain("files");
      expect(stdout).toContain("Dry run - skipping injection");
      expect(stdout).toContain("Done");
    } finally {
      // Cleanup
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 30000); // 30s timeout for this test

  test("docs without URL shows error", async () => {
    const { stdout, stderr, exitCode } = await runCLI(["docs"]);

    expect(exitCode).toBe(1);
    expect(stdout + stderr).toContain("missing <repository-url>");
  });

  test("check with no installed docs shows helpful message", async () => {
    const { stdout, exitCode } = await runCLI(["check"]);

    // May succeed or fail depending on whether docs are installed
    // Just check it doesn't crash
    expect([0, 1]).toContain(exitCode);
    expect(stdout).toBeTruthy(); // Should output something
  });

  test("unknown command shows error", async () => {
    const { stdout, stderr, exitCode } = await runCLI(["invalid-command"]);

    expect(exitCode).toBe(1);
    expect(stdout + stderr).toContain("unknown command");
  });
});

describe("Utilities Smoke Tests", () => {
  test("sanitizeName prevents path traversal", async () => {
    const { sanitizeName } = await import("../src/utils/sanitize");

    expect(sanitizeName("../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeName("../../secret")).toBe("secret");
    expect(sanitizeName("normal-name")).toBe("normal-name");
    expect(sanitizeName("UPPERCASE")).toBe("uppercase");
    expect(sanitizeName("")).toBe("unnamed-doc");
  });

  test("isPathSafe validates paths correctly", async () => {
    const { isPathSafe } = await import("../src/utils/sanitize");

    expect(isPathSafe("/home/user/.engrain", "/home/user/.engrain/next-js")).toBe(true);
    expect(isPathSafe("/home/user/.engrain", "/home/user/.engrain")).toBe(true);
    expect(isPathSafe("/home/user/.engrain", "/home/user/other")).toBe(false);
    expect(isPathSafe("/home/user/.engrain", "/home/user/.engrain/../other")).toBe(false);
  });

  test("parseSource handles GitHub URLs", async () => {
    const { parseSource } = await import("../src/utils/source-parser");

    const result = parseSource("https://github.com/vercel/next.js/tree/canary/docs");

    expect(result.type).toBe("github");
    expect(result.owner).toBe("vercel");
    expect(result.repo).toBe("next.js");
    expect(result.ref).toBe("canary");
    expect(result.subpath).toBe("docs");
  });

  test("parseSource handles GitHub shorthand", async () => {
    const { parseSource } = await import("../src/utils/source-parser");

    const result = parseSource("vercel/next.js");

    expect(result.type).toBe("github");
    expect(result.owner).toBe("vercel");
    expect(result.repo).toBe("next.js");
    expect(result.url).toBe("https://github.com/vercel/next.js.git");
  });
});
