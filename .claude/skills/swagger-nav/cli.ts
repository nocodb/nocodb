#!/usr/bin/env npx tsx
import {
  loadSpec,
  getSummary,
  listPaths,
  listSchemas,
  getPath,
  getSchema,
  search,
  getRefs,
  validateRefs,
} from './lib/parser.js';
import { formatOutput } from './lib/formatter.js';

// ---------------------------------------------------------------------------
// Flag parser: --key=value or --key value
// ---------------------------------------------------------------------------

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

function requireFlag(flags: Record<string, string>, name: string): string {
  const val = flags[name];
  if (!val) throw new Error(`Missing required flag: --${name}`);
  return val;
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function out(data: unknown, flags: Record<string, string>, command: string) {
  const format = (flags.format ?? 'json') as 'json' | 'compact' | 'text';
  console.log(formatOutput(data, format, command));
}

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

type Handler = (flags: Record<string, string>) => any;

function loadFromFlags(flags: Record<string, string>) {
  return loadSpec(flags.file ?? 'v3', flags['include-original'] === 'true');
}

const commands: Record<string, Handler> = {
  summary(flags) {
    return getSummary(loadFromFlags(flags));
  },

  'list-paths'(flags) {
    return listPaths(loadFromFlags(flags), { tag: flags.tag, filter: flags.filter });
  },

  'list-schemas'(flags) {
    return listSchemas(loadFromFlags(flags), { filter: flags.filter });
  },

  'get-path'(flags) {
    const spec = loadFromFlags(flags);
    const pathStr = requireFlag(flags, 'path');
    const results = getPath(spec, pathStr, flags.method);
    if (results.length === 0) fail(`No path matching "${pathStr}" found.`);
    if (results.length === 1) return results[0];
    return results;
  },

  'get-schema'(flags) {
    const spec = loadFromFlags(flags);
    const name = requireFlag(flags, 'name');
    const resolveRefsBool = flags['resolve-refs'] === 'true';
    const depth = flags.depth ? parseInt(flags.depth, 10) : 1;
    const result = getSchema(spec, name, resolveRefsBool, depth);
    if (!result) fail(`Schema "${name}" not found.`);
    return result;
  },

  search(flags) {
    const spec = loadFromFlags(flags);
    const query = requireFlag(flags, 'query');
    const limit = flags.limit ? parseInt(flags.limit, 10) : 50;
    return search(spec, query, limit);
  },

  'get-refs'(flags) {
    const spec = loadFromFlags(flags);
    const name = requireFlag(flags, 'name');
    const refs = getRefs(spec, name);
    return { schema: name, references: refs, count: refs.length };
  },

  'validate-refs'(flags) {
    return validateRefs(loadFromFlags(flags));
  },
};

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`swagger-nav — Navigate large OpenAPI/Swagger JSON files

Usage: npx tsx .claude/skills/swagger-nav/cli.ts <command> [flags]

Commands:
  summary                  File overview (paths, schemas, operations, tags)
  list-paths               List all endpoints
    --tag=<tag>              Filter by tag
    --filter=<keyword>       Filter by keyword in path/operationId/summary
  list-schemas             List all schema names
    --filter=<keyword>       Filter by keyword in schema name
  get-path                 Read a specific endpoint definition
    --path=<path>            Full path or fuzzy substring (required)
    --method=<method>        Filter to specific HTTP method
  get-schema               Read a specific schema definition
    --name=<name>            Schema name (required)
    --resolve-refs           Inline-resolve $ref pointers
    --depth=<n>              Max ref resolution depth (default: 1)
  search                   Full-text search across the spec
    --query=<keyword>        Search term (required)
    --limit=<n>              Max results (default: 50)
  get-refs                 Find all references to a schema
    --name=<name>            Schema name (required)
  validate-refs            Find broken $ref references

Global Flags:
  --file=<alias|path>      Swagger file (default: v3)
                           Aliases: v3, ce, legacy, v2, ee, v3Patch
  --include-original       Merge with the original CE spec (ee→ce, v3Patch→v3).
                           The queried spec's entries win on conflict.
  --format=<fmt>           Output format: json (default), compact, text`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  const handler = commands[command];
  if (!handler) fail(`Unknown command: "${command}". Run without args for help.`);

  const flags = parseFlags(args.slice(1));

  try {
    const result = handler(flags);
    out(result, flags, command);
  } catch (e: any) {
    fail(e.message ?? String(e));
  }
}

main();
