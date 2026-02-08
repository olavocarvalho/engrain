/**
 * Sync command - Reconstruct .engrain/ from lock file
 * Similar to npm install - reads .engrain-lock.json and downloads/generates all docs
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { generateIndex } from '../indexer/generate';
import { formatSize } from '../indexer/size';
import { injectIndex } from '../injector/inject';
import { addDocsToLock, getAllDocsForProject } from '../injector/lock';
import { track } from '../telemetry';
import type { SyncCommandOptions } from '../types';
import { CommandError } from '../types';
import { c } from '../ui/colors';
import { cleanupTempDir, cloneRepo } from '../utils/git';
import { parseSource } from '../utils/source-parser';

/**
 * Run sync command
 * Reads .engrain-lock.json and reconstructs .engrain/ folder and AGENTS.md
 *
 * @param options - Command options
 */
export async function runSyncCommand(options: SyncCommandOptions): Promise<void> {
  const startTime = Date.now();

  p.intro(pc.bgGreen(pc.black(' engrain sync ')));

  // Step 1: Read lock file
  p.log.message(pc.dim('reading lock file...'));
  const projectDocs = await getAllDocsForProject();

  if (Object.keys(projectDocs).length === 0) {
    p.log.warn('no docs in lock file');
    p.log.message(pc.dim("Run 'engrain docs <repository-url>' to install documentation."));
    p.outro('');
    return;
  }

  p.log.step(`${Object.keys(projectDocs).length} doc(s) found`);

  // Step 2: Sync each doc
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const [docName, entry] of Object.entries(projectDocs)) {
    p.log.message('');
    p.log.info(docName);

    // Skip local docs (can't reconstruct)
    if (entry.commitHash === 'local') {
      p.log.step(`${c.yellow('skipped')} (local source)`);
      skipCount++;
      continue;
    }

    let tempDir: string | null = null;

    try {
      // Clone repository
      const spinner = p.spinner();
      spinner.start('Cloning repository');

      const sourceUrl = entry.sourceUrl ?? parseSource(entry.source).url;
      const cloneResult = await cloneRepo(sourceUrl, entry.ref);
      tempDir = cloneResult.tempDir;
      spinner.stop();

      p.log.step(`cloned ${cloneResult.commitHash.slice(0, 7)}`);

      // Determine docs path
      let docsPath = tempDir;
      if (entry.subpath) {
        docsPath = `${tempDir}/${entry.subpath}`;
      }

      // Generate index
      spinner.start('Generating index');
      const result = await generateIndex(docsPath, options.engrainDir, docName, {
        dryRun: false,
      });
      spinner.stop();

      p.log.step(
        `${result.fileCount} files · ${formatSize(result.sizeBytes)} · ${result.sizeTokens.toLocaleString()} tokens`
      );

      // Inject into AGENTS.md
      spinner.start(`Injecting into ${options.output}`);
      await injectIndex(options.output, docName, result.content, {
        force: true, // Always overwrite during sync
      });
      spinner.stop();

      p.log.step(`injected ${options.output}`);

      // Update lock file (refresh timestamps)
      await addDocsToLock(docName, {
        source: entry.source,
        sourceUrl: entry.sourceUrl,
        sourceType: entry.sourceType,
        ref: entry.ref,
        subpath: entry.subpath,
        commitHash: cloneResult.commitHash,
        indexHash: result.indexHash,
        indexSizeBytes: result.sizeBytes,
        indexSizeTokens: result.sizeTokens,
      });

      successCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      p.log.step(`${c.red('error')} ${message}`);
      errorCount++;
    } finally {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    }
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  p.outro(
    `${c.green('done')} · ${successCount} synced, ${skipCount} skipped, ${errorCount} errors · ${duration}s`
  );

  track({ event: 'sync', successCount: String(successCount), errorCount: String(errorCount) });

  if (errorCount > 0) {
    throw new CommandError('Some docs failed to sync');
  }
}
