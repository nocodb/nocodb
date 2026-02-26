#!/usr/bin/env npx tsx
import { init } from './lib/setup.js';

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
    } else {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    }
  }
  return flags;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const url = flags.url;
  if (!url) {
    process.stdout.write(JSON.stringify({ error: '--url is required (e.g. --url=http://localhost:8080)' }) + '\n');
    process.exit(1);
  }
  const result = await init(url);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) + '\n');
  process.exit(1);
});
