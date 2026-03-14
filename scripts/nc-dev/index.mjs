#!/usr/bin/env node
/**
 * nc-dev — Multi-instance NocoDB development tool
 *
 * Commands:
 *   init                  Setup config + seed develop DBs (must be on develop branch)
 *   start [--fresh]       Fork meta_develop+data_develop → start this branch's be+fe
 *   stop [branch]         Stop instance (default: current branch)
 *   list                  List all registered instances
 *   reset                 Drop DB forks + restart fresh (use after rebase)
 *   cleanup [branch]      Stop + drop forked DBs
 *
 * Routing: {branch-slug}.noco.localhost:1355 → be/fe via proxy.mjs
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createConnection } from 'net';

const resolvePath = resolve;
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

// For worktrees, git-common-dir points to the main repo's .git — use that as the config/registry home
// so all worktrees share one registry and one config file.
function getMainRepoRoot() {
  try {
    const commonDir = execSync('git rev-parse --git-common-dir', { cwd: REPO_ROOT, stdio: 'pipe' }).toString().trim();
    const abs = resolvePath(REPO_ROOT, commonDir);
    return abs.endsWith('/.git') ? abs.slice(0, -5) : REPO_ROOT;
  } catch { return REPO_ROOT; }
}
const MAIN_REPO_ROOT = getMainRepoRoot();

const REGISTRY_PATH = resolve(MAIN_REPO_ROOT, '.nc-dev-registry.json');
const CONFIG_PATH = resolve(MAIN_REPO_ROOT, '.nc-dev-config.json');
const PROXY_PORT = 1355;

// Port ranges for branch instances
const BE_PORT_START = 18080;
const FE_PORT_START = 13000;
const MAX_INSTANCES = 20;

// Fixed source DB names — develop seeds these once, all branches fork from them
const SRC_META = 'meta_develop';
const SRC_DATA = 'data_develop';

// ─── Registry ─────────────────────────────────────────────────────────────────

function readRegistry() {
  if (!existsSync(REGISTRY_PATH)) return {};
  try { return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')); } catch { return {}; }
}

function writeRegistry(data) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** Parse a simple .env file into key=value pairs */
function parseEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Parse a DB URL (NocoDB format or standard) into config fields */
function parseDbUrl(url) {
  try {
    // NocoDB NC_DB format: pg://host:port?u=user&p=pass&d=dbname
    const ncMatch = url.match(/^(pg|postgresql|mysql2?):\/\/([^/?:]+)(?::(\d+))?\?(.*)$/);
    if (ncMatch) {
      const [, proto, host, port, qs] = ncMatch;
      const p = Object.fromEntries(new URLSearchParams(qs));
      const dbType = proto.startsWith('pg') ? 'pg' : 'mysql';
      const defaultPort = dbType === 'pg' ? 5432 : 3306;
      return { dbType, pgHost: host, pgPort: parseInt(port || defaultPort, 10), pgUser: p.u || 'postgres', pgPassword: p.p || '', mysqlHost: host, mysqlPort: parseInt(port || defaultPort, 10), mysqlUser: p.u || 'root', mysqlPassword: p.p || '' };
    }
    // Standard: postgresql://user:pass@host:5432/dbname
    const u = new URL(url);
    const proto = u.protocol.replace(':', '');
    const dbType = proto === 'postgresql' || proto === 'pg' ? 'pg' : proto === 'mysql' || proto === 'mysql2' ? 'mysql' : null;
    if (!dbType) return null;
    return { dbType, pgHost: u.hostname, pgPort: parseInt(u.port || '5432', 10), pgUser: decodeURIComponent(u.username || 'postgres'), pgPassword: decodeURIComponent(u.password || ''), mysqlHost: u.hostname, mysqlPort: parseInt(u.port || '3306', 10), mysqlUser: decodeURIComponent(u.username || 'root'), mysqlPassword: decodeURIComponent(u.password || '') };
  } catch { return null; }
}

/**
 * Load config. Priority:
 *  1. .nc-dev-config.json
 *  2. packages/nocodb/.env (DATABASE_URL or NC_DB)
 *  3. Error with instructions
 */
function readConfig() {
  if (existsSync(CONFIG_PATH)) {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  }

  const envPath = resolve(REPO_ROOT, 'packages/nocodb/.env');
  if (existsSync(envPath)) {
    const env = parseEnvFile(envPath);
    const parsed = parseDbUrl(env.DATABASE_URL || env.NC_DB || '');
    if (parsed) { console.log('  ℹ DB config from packages/nocodb/.env'); return parsed; }
  }

  console.error('\n  ✗ No DB config found.\n    Run: node scripts/nc-dev/index.mjs init\n');
  process.exit(1);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getCurrentBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT }).toString().trim();
}

function branchToSlug(branch) {
  return branch.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function allocatePorts(registry) {
  const used = new Set(Object.values(registry).flatMap((r) => [r.bePort, r.fePort]));
  for (let i = 0; i < MAX_INSTANCES; i++) {
    const be = BE_PORT_START + i * 10;
    const fe = FE_PORT_START + i * 10;
    if (!used.has(be) && !used.has(fe)) return { bePort: be, fePort: fe };
  }
  throw new Error('No free port slots — too many instances running');
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Start proxy only if port 1355 is not already in use; otherwise send SIGHUP to reload registry */
function ensureProxy() {
  return new Promise((resolve) => {
    const probe = createConnection(PROXY_PORT, 'localhost');
    probe.once('connect', () => {
      // Already running — send SIGHUP so it reloads the registry
      probe.destroy();
      try {
        execSync(`kill -HUP $(lsof -ti tcp:${PROXY_PORT}) 2>/dev/null || true`, { shell: true, stdio: 'pipe' });
      } catch { /* non-fatal */ }
      resolve();
    });
    probe.once('error', () => {
      // Not running — start it
      probe.destroy();
      import(resolvePath(__dirname, 'proxy.mjs')).catch(() => {});
      resolve();
    });
  });
}

function isProcessRunning(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function killProcess(pid) {
  if (!pid || !isProcessRunning(pid)) return;
  try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
}

/** Spawn a child, prefix each output line with a colored label */
function spawnStreaming(label, color, cmd, args, opts) {
  const RESET = '\x1b[0m';
  const prefix = `${color}[${label}]${RESET} `;
  const child = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: opts.cwd ?? REPO_ROOT,
    env: { ...process.env, ...opts.env },
  });
  const print = (chunk) => chunk.toString().split('\n').forEach((l) => { if (l.trim()) process.stdout.write(prefix + l + '\n'); });
  child.stdout.on('data', print);
  child.stderr.on('data', print);
  return child;
}

function keepAlive(children) {
  let done = 0;
  for (const [label, child] of children) {
    child.on('exit', (code) => { console.log(`\n  [${label}] exited (${code})`); if (++done >= children.length) process.exit(0); });
  }
  process.on('SIGINT', () => {
    console.log('\n  Stopping …');
    children.forEach(([, c]) => c.kill('SIGTERM'));
    setTimeout(() => process.exit(0), 1500);
  });
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/** Build psql DSN + PGPASSWORD env */
function pgConnect(config) {
  const { pgHost, pgPort, pgUser, pgPassword } = config;
  if (pgPassword) {
    return { env: { PGPASSWORD: pgPassword }, dsn: `-h ${pgHost} -p ${pgPort ?? 5432} -U ${pgUser} -w` };
  }
  // No password + localhost: try Unix socket with OS user (macOS Homebrew trust auth)
  if (!pgHost || pgHost === 'localhost' || pgHost === '127.0.0.1') {
    const user = pgUser === 'postgres' ? (process.env.USER || pgUser) : pgUser;
    return { env: {}, dsn: `-U ${user}` };
  }
  return { env: { PGPASSWORD: '' }, dsn: `-h ${pgHost} -p ${pgPort ?? 5432} -U ${pgUser} -w` };
}

/** Build NocoDB NC_DB URL: pg://host:port?u=user&p=pass&d=dbname */
function buildDbUrl(config, dbName) {
  const { dbType, pgHost, pgPort, pgUser, pgPassword, mysqlHost, mysqlPort, mysqlUser, mysqlPassword } = config;
  if (dbType === 'pg') {
    return `pg://${pgHost ?? 'localhost'}:${pgPort ?? 5432}?u=${pgUser}&p=${pgPassword ?? ''}&d=${dbName}`;
  }
  if (dbType === 'mysql') {
    const pass = mysqlPassword ? `:${encodeURIComponent(mysqlPassword)}` : '';
    return `mysql://${mysqlUser}${pass}@${mysqlHost}:${mysqlPort ?? 3306}/${dbName}`;
  }
  if (dbType === 'sqlite') {
    return `${config.sqliteSourcePath.replace(/\.db$/, '')}_${dbName}.db`;
  }
  throw new Error(`Unknown dbType: ${dbType}`);
}

/**
 * Strip migration tracking rows that have no corresponding file on disk.
 * Prevents Knex "migration directory is corrupt" when the source DB (develop)
 * is ahead of the branch being developed.
 */
function purgeFutureMigrations(config, targetDb, dsn, pgEnv) {
  const migrationsDir = resolve(REPO_ROOT, 'packages/nocodb/src/meta/migrations/v0');
  if (!existsSync(migrationsDir)) return;

  const onDisk = new Set(
    execSync(`ls "${migrationsDir}"`, { stdio: 'pipe' }).toString().trim().split('\n')
      .map((f) => f.replace(/\.(ts|js)$/, '')),
  );

  let tracked = [];
  try {
    const out = execSync(`psql ${dsn} -d "${targetDb}" -tA -c "SELECT name FROM xc_knex_migrationsv0;"`, { env: { ...process.env, ...pgEnv }, stdio: 'pipe' }).toString().trim();
    tracked = out ? out.split('\n').map((s) => s.trim()).filter(Boolean) : [];
  } catch { return; }

  const toDelete = tracked.filter((n) => !onDisk.has(n));
  if (!toDelete.length) return;

  const list = toDelete.map((n) => `'${n}'`).join(', ');
  execSync(`psql ${dsn} -d "${targetDb}" -c "DELETE FROM xc_knex_migrationsv0 WHERE name IN (${list});"`, { env: { ...process.env, ...pgEnv }, stdio: 'pipe' });
  console.log(`  ✓ Removed future migration(s): ${toDelete.join(', ')}`);
}

/** Fork a single PG DB via TEMPLATE, then strip future migrations */
function forkPgDb(config, sourceDb, targetDb) {
  const { env, dsn } = pgConnect(config);
  try {
    execSync(`psql ${dsn} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${sourceDb}' AND pid <> pg_backend_pid();"`, { env: { ...process.env, ...env }, stdio: 'pipe' });
  } catch { /* non-fatal */ }
  try {
    execSync(`psql ${dsn} -d postgres -c "CREATE DATABASE \\"${targetDb}\\" TEMPLATE \\"${sourceDb}\\";"`, { env: { ...process.env, ...env }, stdio: 'pipe' });
    console.log(`  ✓ "${targetDb}" forked from "${sourceDb}"`);
  } catch (e) {
    if (e.stderr?.toString().includes('already exists') || e.stdout?.toString().includes('already exists')) {
      console.log(`  ✓ "${targetDb}" already exists — reusing`);
    } else {
      throw e;
    }
  }
  purgeFutureMigrations(config, targetDb, dsn, env);
}

/** Drop a PG DB (terminate connections first) */
function dropPgDb(config, dbName) {
  if (!dbName) return;
  const { env, dsn } = pgConnect(config);
  try {
    execSync(`psql ${dsn} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${dbName}';"`, { env: { ...process.env, ...env }, stdio: 'pipe' });
    execSync(`psql ${dsn} -d postgres -c "DROP DATABASE IF EXISTS \\"${dbName}\\";"`, { env: { ...process.env, ...env }, stdio: 'pipe' });
    console.log(`  ✓ Dropped "${dbName}"`);
  } catch (e) { console.warn(`  ⚠ Could not drop "${dbName}": ${e.message}`); }
}

/** Fork meta_develop + data_develop → branch-specific DBs */
function forkBothDbs(config, metaDbName, dataDbName) {
  const { dbType } = config;
  if (dbType === 'pg') {
    forkPgDb(config, SRC_META, metaDbName);
    forkPgDb(config, SRC_DATA, dataDbName);
  } else if (dbType === 'mysql') {
    const { mysqlHost, mysqlPort, mysqlUser, mysqlPassword } = config;
    const pass = mysqlPassword ? `-p${mysqlPassword}` : '';
    const conn = `-h ${mysqlHost} -P ${mysqlPort ?? 3306} -u ${mysqlUser} ${pass}`;
    for (const [src, tgt] of [[SRC_META, metaDbName], [SRC_DATA, dataDbName]]) {
      execSync(`mysql ${conn} -e "CREATE DATABASE IF NOT EXISTS \`${tgt}\`;"`, { stdio: 'pipe' });
      execSync(`mysqldump ${conn} ${src} | mysql ${conn} ${tgt}`, { stdio: 'pipe', shell: true });
      console.log(`  ✓ "${tgt}" forked from "${src}"`);
    }
  } else if (dbType === 'sqlite') {
    const base = config.sqliteSourcePath.replace(/\.db$/, '');
    for (const [src, tgt] of [[SRC_META, metaDbName], [SRC_DATA, dataDbName]]) {
      execSync(`cp "${base}_${src}.db" "${base}_${tgt}.db"`, { stdio: 'pipe' });
      console.log(`  ✓ "${tgt}" copied from "${src}"`);
    }
  }
}

/** Drop both DBs for a registry entry */
function dropBothDbs(config, entry) {
  const { dbType } = config;
  if (dbType === 'pg') {
    dropPgDb(config, entry.metaDbName);
    dropPgDb(config, entry.dataDbName);
  } else if (dbType === 'mysql') {
    const { mysqlHost, mysqlPort, mysqlUser, mysqlPassword } = config;
    const pass = mysqlPassword ? `-p${mysqlPassword}` : '';
    const conn = `-h ${mysqlHost} -P ${mysqlPort ?? 3306} -u ${mysqlUser} ${pass}`;
    for (const db of [entry.metaDbName, entry.dataDbName].filter(Boolean)) {
      try { execSync(`mysql ${conn} -e "DROP DATABASE IF EXISTS \`${db}\`;"`, { stdio: 'pipe' }); console.log(`  ✓ Dropped "${db}"`); }
      catch (e) { console.warn(`  ⚠ ${e.message}`); }
    }
  } else if (dbType === 'sqlite') {
    const base = config.sqliteSourcePath.replace(/\.db$/, '');
    for (const db of [entry.metaDbName, entry.dataDbName].filter(Boolean)) {
      const p = `${base}_${db}.db`;
      if (existsSync(p)) { try { execSync(`rm -f "${p}"`); console.log(`  ✓ Deleted "${p}"`); } catch (e) { console.warn(`  ⚠ ${e.message}`); } }
    }
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/**
 * Full setup: ensure develop branch, create config, update .gitignore, seed DBs.
 */
async function cmdInit() {
  // 1. Enforce develop branch
  const branch = getCurrentBranch();
  if (branch !== 'develop') {
    console.error(`\n  ✗ You must be on the develop branch to run init.\n    Current branch: ${branch}\n    Run: git checkout develop\n`);
    process.exit(1);
  }

  // 2. Create config if missing
  if (!existsSync(CONFIG_PATH)) {
    const template = {
      dbType: 'pg',
      pgHost: 'localhost',
      pgPort: 5432,
      pgUser: 'postgres',
      pgPassword: 'password',
      _mysql: { mysqlHost: 'localhost', mysqlPort: 3306, mysqlUser: 'root', mysqlPassword: '' },
      _sqlite: { sqliteSourcePath: './packages/nocodb/test_sakila.db' },
    };
    writeFileSync(CONFIG_PATH, JSON.stringify(template, null, 2));
    console.log('  ✓ Created .nc-dev-config.json');
  } else {
    console.log('  ✓ .nc-dev-config.json already exists');
  }

  // 3. Update .gitignore if needed
  const giPath = resolve(REPO_ROOT, '.gitignore');
  if (existsSync(giPath)) {
    const gi = readFileSync(giPath, 'utf8');
    const entries = ['.nc-dev-config.json', '.nc-dev-registry.json', '.nc-dev-proxy.pid', '.nc-dev-proxy.log', '.nc-dev-logs/'];
    const missing = entries.filter((e) => !gi.includes(e));
    if (missing.length) {
      writeFileSync(giPath, gi + '\n# nc-dev\n' + missing.join('\n') + '\n');
      console.log('  ✓ Updated .gitignore');
    }
  }

  // 4. Seed develop DBs
  const config = readConfig();
  const metaUrl = buildDbUrl(config, SRC_META);
  const dataUrl = buildDbUrl(config, SRC_DATA);

  console.log(`\n  Seeding → NC_DB: ${SRC_META}  NC_DATA_DB: ${SRC_DATA}`);
  console.log(`  Starting be+fe — Ctrl+C when seeding is done\n`);

  const be = spawnStreaming('be', '\x1b[36m', 'pnpm', ['run', 'watch:run:nc-dev'], {
    cwd: resolve(REPO_ROOT, 'packages/nocodb'),
    env: { NC_DB: metaUrl, NC_DATA_DB: dataUrl, NODE_ENV: 'development' },
  });

  const fe = spawnStreaming('fe', '\x1b[35m', 'pnpm', ['run', 'dev:ee'], {
    cwd: resolve(REPO_ROOT, 'packages/nc-gui'),
    env: { NODE_ENV: 'development' },
  });

  await ensureProxy();
  keepAlive([['be', be], ['fe', fe]]);
}

async function cmdStart(opts = {}) {
  const config = readConfig();
  const branch = getCurrentBranch();
  const slug = branchToSlug(branch);
  const registry = readRegistry();
  let entry = registry[branch];

  // Stop any stale processes before (re)starting
  if (entry) {
    if (isProcessRunning(entry.bePid) || isProcessRunning(entry.fePid)) {
      console.log(`  → Stopping existing processes …`);
      killProcess(entry.bePid);
      killProcess(entry.fePid);
      await sleep(1000);
    }
    if (opts.fresh) {
      dropBothDbs(config, entry);
      entry = null;
      delete registry[branch];
    }
  }

  if (!entry) {
    const { bePort, fePort } = allocatePorts(registry);
    const safe = slug.replace(/-/g, '_');
    const metaDbName = `ncdev_${safe}_meta`;
    const dataDbName = `ncdev_${safe}_data`;

    console.log(`\n  → Forking ${SRC_META} → ${metaDbName}`);
    console.log(`  → Forking ${SRC_DATA} → ${dataDbName}`);
    forkBothDbs(config, metaDbName, dataDbName);

    entry = { branch, slug, metaDbName, dataDbName, metaDbUrl: buildDbUrl(config, metaDbName), dataDbUrl: buildDbUrl(config, dataDbName), bePort, fePort, bePid: null, fePid: null, startedAt: new Date().toISOString() };
  }

  console.log(`\n  Starting — streaming logs (Ctrl+C to stop)\n`);
  printInstanceInfo(branch, entry);

  const be = spawnStreaming('be', '\x1b[36m', 'pnpm', ['run', 'watch:run:nc-dev'], {
    cwd: resolve(REPO_ROOT, 'packages/nocodb'),
    env: { PORT: String(entry.bePort), NC_DB: entry.metaDbUrl, NC_DATA_DB: entry.dataDbUrl, NODE_ENV: 'development' },
  });

  const fe = spawnStreaming('fe', '\x1b[35m', 'pnpm', ['run', 'dev:ee'], {
    cwd: resolve(REPO_ROOT, 'packages/nc-gui'),
    env: { PORT: String(entry.fePort), NUXT_PUBLIC_NC_BACKEND_URL: `http://localhost:${entry.bePort}`, NODE_ENV: 'development' },
  });

  entry.bePid = be.pid;
  entry.fePid = fe.pid;
  entry.startedAt = new Date().toISOString();
  registry[branch] = entry;
  writeRegistry(registry);

  await ensureProxy();

  process.on('SIGINT', () => {
    console.log('\n  Stopping …');
    be.kill('SIGTERM');
    fe.kill('SIGTERM');
    const r = readRegistry();
    if (r[branch]) { r[branch].bePid = null; r[branch].fePid = null; writeRegistry(r); }
    setTimeout(() => process.exit(0), 1500);
  });

  keepAlive([['be', be], ['fe', fe]]);
}

async function cmdStop(targetBranch) {
  const branch = targetBranch ?? getCurrentBranch();
  const registry = readRegistry();
  const entry = registry[branch];
  if (!entry) { console.log(`  No instance for "${branch}"`); return; }

  killProcess(entry.bePid);
  killProcess(entry.fePid);
  entry.bePid = null;
  entry.fePid = null;
  writeRegistry(registry);
  console.log(`  ✓ Stopped "${branch}"`);
}

async function cmdList() {
  const entries = Object.values(readRegistry());
  if (!entries.length) { console.log('  No instances registered.'); return; }

  console.log(`\n  ${'Branch'.padEnd(32)} ${'BE'.padEnd(7)} ${'FE'.padEnd(7)} Status`);
  console.log('  ' + '─'.repeat(60));
  for (const e of entries) {
    const beUp = isProcessRunning(e.bePid);
    const feUp = isProcessRunning(e.fePid);
    const status = beUp && feUp ? '✓ running' : beUp || feUp ? '⚠ partial' : '✗ stopped';
    console.log(`  ${e.branch.padEnd(32)} :${String(e.bePort).padEnd(6)} :${String(e.fePort).padEnd(6)} ${status}`);
  }
  console.log('');
  entries.filter((e) => isProcessRunning(e.bePid) || isProcessRunning(e.fePid))
    .forEach((e) => console.log(`  http://${e.slug}.noco.localhost:${PROXY_PORT}`));
  console.log('');
}

async function cmdReset() {
  const config = readConfig();
  const branch = getCurrentBranch();
  const registry = readRegistry();
  const entry = registry[branch];

  if (entry) {
    killProcess(entry.bePid);
    killProcess(entry.fePid);
    dropBothDbs(config, entry);
    delete registry[branch];
    writeRegistry(registry);
  }

  await cmdStart({ fresh: false });
}

async function cmdCleanup(targetBranch) {
  const config = readConfig();
  const branch = targetBranch ?? getCurrentBranch();
  const registry = readRegistry();
  const entry = registry[branch];
  if (!entry) { console.log(`  No instance for "${branch}"`); return; }

  killProcess(entry.bePid);
  killProcess(entry.fePid);
  dropBothDbs(config, entry);
  delete registry[branch];
  writeRegistry(registry);
  console.log(`  ✓ Cleaned up "${branch}"`);
}

// ─── Print ────────────────────────────────────────────────────────────────────

function printInstanceInfo(branch, entry) {
  console.log(`  Branch:   ${branch}`);
  console.log(`  URL:      http://${branchToSlug(branch)}.noco.localhost:${PROXY_PORT}`);
  console.log(`  Backend:  http://localhost:${entry.bePort}`);
  console.log(`  Frontend: http://localhost:${entry.fePort}`);
  console.log(`  Meta DB:  ${entry.metaDbName}`);
  console.log(`  Data DB:  ${entry.dataDbName}`);
  console.log('');
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

const commands = {
  init:    cmdInit,
  start:   () => cmdStart({ fresh: args.includes('--fresh') }),
  stop:    () => cmdStop(args[0]),
  list:    cmdList,
  reset:   cmdReset,
  cleanup: () => cmdCleanup(args[0]),
};

if (!cmd || !commands[cmd]) {
  console.log(`
  nc-dev — multi-instance NocoDB dev proxy

  Usage:  pnpm nc-dev <command>

  Commands:
    init                  Setup config + seed develop DBs (must be on develop branch)
    start [--fresh]       Fork develop DBs → start this branch
    stop [branch]         Stop instance
    list                  List all instances
    reset                 Drop forks + restart fresh (use after rebase)
    cleanup [branch]      Stop + drop forked DBs
`);
  process.exit(cmd ? 1 : 0);
}

commands[cmd]().catch((e) => { console.error('\n  ✗', e.message); process.exit(1); });
