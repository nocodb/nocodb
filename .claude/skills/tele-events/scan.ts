#!/usr/bin/env npx tsx

/**
 * Telemetry Event Scanner
 *
 * Scans nc-gui for frontend telemetry events ($e / v-e) and compares
 * against the catalog at packages/nc-gui/tele/events.json.
 *
 * Usage:
 *   npx tsx .claude/skills/tele-events/scan.ts          # Human-readable
 *   npx tsx .claude/skills/tele-events/scan.ts --json    # JSON output
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const SKILL_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(SKILL_DIR, '../../..')
const NC_GUI = resolve(ROOT, 'packages/nc-gui')
const CATALOG_PATH = resolve(NC_GUI, 'tele/events.json')

const jsonOutput = process.argv.includes('--json')

// ── Helpers ──

const VUE_TS_EXTS = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx'])

function walkFiles(dir: string, exts: Set<string>): string[] {
  const results: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.nuxt' || entry === 'dist' || entry === '.output') continue
    const full = resolve(dir, entry)
    try {
      const stat = statSync(full)
      if (stat.isDirectory()) {
        results.push(...walkFiles(full, exts))
      } else if (exts.has(extname(entry))) {
        results.push(full)
      }
    } catch {
      // skip unreadable
    }
  }
  return results
}

function matchAll(content: string, regex: RegExp): string[] {
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(content)) !== null) {
    results.push(m[1])
  }
  return results
}

function loadCatalog(): Record<string, Record<string, string>> {
  if (!existsSync(CATALOG_PATH)) {
    console.error(`Catalog not found: ${CATALOG_PATH}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'))
}

function flattenCatalog(catalog: Record<string, Record<string, string>>): Set<string> {
  const keys = new Set<string>()
  for (const category of Object.values(catalog)) {
    for (const key of Object.keys(category)) {
      keys.add(key)
    }
  }
  return keys
}

// ── Scanner ──

function scanEvents(): Set<string> {
  const events = new Set<string>()
  const files = walkFiles(NC_GUI, VUE_TS_EXTS)

  const veRegex = /v-e="\['([^']+)'/g
  const eSingleRegex = /\$e\('([^']+)'/g
  const eDoubleRegex = /\$e\("([^"]+)"/g

  for (const file of files) {
    let content: string
    try {
      content = readFileSync(file, 'utf-8')
    } catch {
      continue
    }

    for (const e of matchAll(content, veRegex)) events.add(e)
    for (const e of matchAll(content, eSingleRegex)) events.add(e)
    for (const e of matchAll(content, eDoubleRegex)) events.add(e)

    veRegex.lastIndex = 0
    eSingleRegex.lastIndex = 0
    eDoubleRegex.lastIndex = 0
  }

  // Filter out dynamic template literals and false positives
  const filtered = new Set<string>()
  for (const e of events) {
    if (e.includes('${') || e.includes('`') || e.length <= 1) continue
    if (!e.includes(':') && !e.includes('-')) continue
    filtered.add(e)
  }

  return filtered
}

// ── Report ──

const codeEvents = scanEvents()
const catalog = loadCatalog()
const catalogKeys = flattenCatalog(catalog)

const missingFromCatalog = [...codeEvents].filter((e) => !catalogKeys.has(e)).sort()
const staleInCatalog = [...catalogKeys].filter((e) => !codeEvents.has(e)).sort()

if (jsonOutput) {
  console.log(
    JSON.stringify(
      {
        totalInCode: codeEvents.size,
        totalInCatalog: catalogKeys.size,
        missingFromCatalog,
        staleInCatalog,
      },
      null,
      2,
    ),
  )
} else {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  FRONTEND TELEMETRY SCAN`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Events in code:    ${codeEvents.size}`)
  console.log(`  Events in catalog: ${catalogKeys.size}`)
  console.log(`  Missing from catalog: ${missingFromCatalog.length}`)
  console.log(`  Stale in catalog:     ${staleInCatalog.length}`)

  if (missingFromCatalog.length > 0) {
    console.log(`\n  ⚠ MISSING FROM CATALOG (found in code, not in JSON):`)
    for (const e of missingFromCatalog) {
      console.log(`    + ${e}`)
    }
  }

  if (staleInCatalog.length > 0) {
    console.log(`\n  ⚠ STALE IN CATALOG (in JSON, not found in code):`)
    for (const e of staleInCatalog) {
      console.log(`    - ${e}`)
    }
  }

  if (missingFromCatalog.length === 0 && staleInCatalog.length === 0) {
    console.log(`\n  ✓ Catalog is in sync with code!`)
  }

  console.log('')
}
