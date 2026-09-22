#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * DRY-RUN for the searchPath-backfill migration (PR #9707,
 * `nc_job_015_pg_source_searchpath_backfill`).
 *
 * Reports which EXTERNAL pg/mssql sources the migration WOULD pin (and to what),
 * by faithfully replaying its read + decision logic against a real meta DB.
 * It performs NO writes — the Source.update / resetSource steps are intentionally
 * skipped, so it is safe to run against production.
 *
 * What it replicates (kept in sync with the migration + Source.getConfig):
 *   1. The source query: external pg/mssql, fk_integration_id NOT NULL, not meta,
 *      not deleted (nc_sources_v2), LEFT JOIN nc_integrations_v2 for the
 *      integration config (same as Source.get).
 *   2. Config decryption: crypto-js AES with NC_CONNECTION_ENCRYPT_KEY (or plain
 *      JSON when no key is set) — see src/utils/encryptDecrypt.ts.
 *   3. Post-fix getConfig() merge: integration config + source override
 *      (searchPath / connection.database), then the empty-searchPath cleanup.
 *   4. grandfatherSearchPath(): the pin decision.
 *
 * Usage (run from packages/nocodb so knex + crypto-js resolve):
 *   NC_DB="pg://HOST:5432?u=USER&p=PASS&d=DBNAME" \
 *   NC_CONNECTION_ENCRYPT_KEY="<the instance's key, if configs are encrypted>" \
 *   node test-searchpath-migration.js
 *
 * NC_DB uses NocoDB's URL form:
 *   pg://host:5432?u=user&p=pass&d=db          (postgres meta db)
 *   mysql2://host:3306?u=user&p=pass&d=db      (mysql meta db)
 *   sqlite3://?d=/path/to/noco.db              (sqlite meta db)
 * If the meta DB stores configs encrypted, NC_CONNECTION_ENCRYPT_KEY MUST match
 * the instance's key or decryption fails (reported per source, not fatal).
 */

const knex = require('knex');
const CryptoJS = require('crypto-js');

const SOURCES = 'nc_sources_v2';
const INTEGRATIONS = 'nc_integrations_v2';

// --- NC_DB (NocoDB URL form) -> knex config -----------------------------------
// Mirrors src/utils/nc-config/helpers.ts::metaUrlToDbConfig for the common cases.
const ALIASES = { d: 'database', db: 'database', p: 'password', u: 'user' };

function ncDbToKnexConfig(urlString) {
  const url = new URL(urlString);
  const client = url.protocol.replace(':', ''); // pg | mysql2 | mssql | sqlite3

  if (client.startsWith('sqlite')) {
    const filename =
      url.searchParams.get('d') || url.searchParams.get('database');
    return { client: 'sqlite3', connection: { filename }, useNullAsDefault: true };
  }

  const connection = { host: url.hostname, port: +url.port || undefined };
  for (const [k, v] of url.searchParams.entries()) {
    connection[ALIASES[k] || k] = v;
  }
  // NocoDB stores database under `database`; knex pg/mysql2 accept it directly.
  return { client, connection };
}

// --- crypto: src/utils/encryptDecrypt.ts::decryptPropIfRequired ---------------
function decryptConfig(raw, secret) {
  if (raw === null || raw === undefined) return undefined;
  let jsonString = raw;
  if (secret) {
    jsonString = CryptoJS.AES.decrypt(raw, secret).toString(CryptoJS.enc.Utf8);
  }
  return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
}

// --- minimal deepMerge (only needs to cover searchPath + connection.database) -
function deepMerge(target, source) {
  const out = { ...(target || {}) };
  for (const k of Object.keys(source || {})) {
    const sv = source[k];
    const tv = out[k];
    if (
      sv && typeof sv === 'object' && !Array.isArray(sv) &&
      tv && typeof tv === 'object' && !Array.isArray(tv)
    ) {
      out[k] = deepMerge(tv, sv);
    } else {
      out[k] = sv;
    }
  }
  return out;
}

// --- Source.getConfig() (post-fix, integration inheritance) -------------------
function effectiveConfig(ownConfig, integrationConfig) {
  if (!integrationConfig) return ownConfig; // getConfig short-circuits
  const sourceOverride = {};
  if (ownConfig?.searchPath !== undefined) {
    sourceOverride.searchPath = ownConfig.searchPath;
  }
  if (ownConfig?.connection?.database !== undefined) {
    sourceOverride.connection = { database: ownConfig.connection.database };
  }
  let merged = deepMerge(integrationConfig, sourceOverride);
  if (
    (!Array.isArray(merged.searchPath) && typeof merged.searchPath !== 'string') ||
    !merged.searchPath?.length
  ) {
    merged = { ...merged, searchPath: undefined };
  }
  return merged;
}

// --- grandfatherSearchPath() (verbatim decision) ------------------------------
function grandfatherSearchPath(type, isMeta, ownConfig, effConfig) {
  if ((type !== 'pg' && type !== 'mssql') || isMeta) return null;
  if (ownConfig?.searchPath?.length) return null;
  const defaultSchema = type === 'mssql' ? 'dbo' : 'public';
  const effectiveSchema = effConfig?.searchPath?.[0];
  if (!effectiveSchema || effectiveSchema === defaultSchema) return null;
  return [defaultSchema];
}

async function main() {
  const ncDb = process.env.NC_DB;
  if (!ncDb) {
    console.error('ERROR: set NC_DB (e.g. pg://host:5432?u=user&p=pass&d=db)');
    process.exit(1);
  }
  const secret = process.env.NC_CONNECTION_ENCRYPT_KEY || '';

  const cfg = ncDbToKnexConfig(ncDb);
  console.log(
    `Meta DB: client=${cfg.client} host=${cfg.connection?.host ?? cfg.connection?.filename} ` +
      `db=${cfg.connection?.database ?? ''}`,
  );
  console.log(
    `Encryption key: ${secret ? 'SET (configs will be AES-decrypted)' : 'NOT set (configs read as plain JSON)'}`,
  );
  console.log('Mode: DRY-RUN — no rows will be written.\n');

  const db = knex(cfg);
  const isFalsy = (col) =>
    function () {
      this.where(col, false).orWhereNull(col);
    };

  let rows;
  try {
    rows = await db(SOURCES)
      .leftJoin(INTEGRATIONS, `${SOURCES}.fk_integration_id`, `${INTEGRATIONS}.id`)
      .whereIn(`${SOURCES}.type`, ['pg', 'mssql'])
      .whereNotNull(`${SOURCES}.fk_integration_id`)
      .where(isFalsy(`${SOURCES}.is_meta`))
      .where(isFalsy(`${SOURCES}.deleted`))
      .select(
        `${SOURCES}.id`,
        `${SOURCES}.base_id`,
        `${SOURCES}.fk_workspace_id`,
        `${SOURCES}.type`,
        `${SOURCES}.is_meta`,
        `${SOURCES}.config`,
        `${INTEGRATIONS}.config as integration_config`,
      );
  } catch (e) {
    console.error('Query failed:', e.message);
    await db.destroy();
    process.exit(1);
  }

  console.log(`Candidate sources (external pg/mssql, integration-backed): ${rows.length}\n`);

  const summary = { wouldPin: 0, skipOwnSearchPath: 0, skipDefaultOrNone: 0, decryptFailed: 0 };

  for (const row of rows) {
    const tag = `source ${row.id} [${row.type}] base=${row.base_id}`;
    let ownConfig;
    let intConfig;
    try {
      ownConfig = decryptConfig(row.config, secret);
      intConfig = decryptConfig(row.integration_config, secret);
    } catch (e) {
      summary.decryptFailed++;
      console.log(`  ${tag}: DECRYPT FAILED (${e.message}) — check NC_CONNECTION_ENCRYPT_KEY`);
      continue;
    }

    const eff = effectiveConfig(ownConfig, intConfig);
    const ownSp = ownConfig?.searchPath;
    const effSchema = eff?.searchPath?.[0];
    const defaultSchema = row.type === 'mssql' ? 'dbo' : 'public';
    const decision = grandfatherSearchPath(row.type, false, ownConfig, eff);

    if (decision) {
      summary.wouldPin++;
      console.log(
        `  ${tag}: WOULD PIN searchPath=[${decision[0]}]  ` +
          `(effective schema='${effSchema}' != default '${defaultSchema}', no own searchPath)`,
      );
    } else if (ownSp?.length) {
      summary.skipOwnSearchPath++;
      console.log(`  ${tag}: skip — already has own searchPath=[${ownSp.join(',')}]`);
    } else {
      summary.skipDefaultOrNone++;
      console.log(
        `  ${tag}: skip — effective schema=${effSchema ? `'${effSchema}'` : '(none)'} ` +
          `is default '${defaultSchema}' or unset (no behaviour change)`,
      );
    }
  }

  console.log('\n=== SUMMARY (dry-run, nothing written) ===');
  console.log(`  candidates:            ${rows.length}`);
  console.log(`  WOULD PIN:             ${summary.wouldPin}`);
  console.log(`  skip (own searchPath): ${summary.skipOwnSearchPath}`);
  console.log(`  skip (default/none):   ${summary.skipDefaultOrNone}`);
  console.log(`  decrypt failed:        ${summary.decryptFailed}`);

  await db.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
