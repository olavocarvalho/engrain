#!/usr/bin/env node

import module from 'node:module';

// Enable Node's on-disk compile cache (faster repeated startups).
// https://nodejs.org/api/module.html#module-compile-cache
if (module.enableCompileCache && !process.env.NODE_DISABLE_COMPILE_CACHE) {
  try {
    module.enableCompileCache();
  } catch {
    // Ignore errors
  }
}

await import('../dist/engrain.js');
