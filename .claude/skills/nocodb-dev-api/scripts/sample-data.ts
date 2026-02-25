#!/usr/bin/env npx tsx
import { ensureSampleData } from './lib/setup.js';

async function main() {
  const result = await ensureSampleData();
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) + '\n');
  process.exit(1);
});
