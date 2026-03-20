import Fastify from 'fastify';
import knex, { Knex } from 'knex';
import hash from 'object-hash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone';
import { defaults, types } from 'pg';
import path from 'path';
import fastifyStatic from '@fastify/static';
import { SnowflakeClient } from 'knex-snowflake';
import { DatabricksClient } from 'knex-databricks';

dayjs.extend(utc);
dayjs.extend(timezone);

const MAX_POOL_SIZE = process.env.MAX_POOL_SIZE
  ? parseInt(process.env.MAX_POOL_SIZE, 10)
  : 50;

const DEBUG = process.env.DEBUG === 'true';

const fastify = Fastify({ logger: DEBUG });

fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
});

// PG Type Overrides
const pgTypes = {
  FLOAT4: 700,
  FLOAT8: 701,
  DATE: 1082,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
  NUMERIC: 1700,
};

types.setTypeParser(pgTypes.DATE, (val) => val);
types.setTypeParser(pgTypes.TIMESTAMP, (val) =>
  dayjs.utc(val).format('YYYY-MM-DD HH:mm:ssZ'),
);
types.setTypeParser(pgTypes.TIMESTAMPTZ, (val) =>
  dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ'),
);

const parseFloatVal = (val: string) => parseFloat(val);

defaults.parseInt8 = true;
types.setTypeParser(pgTypes.FLOAT8, parseFloatVal);
types.setTypeParser(pgTypes.NUMERIC, parseFloatVal);

// Custom MySQL typeCast
function typeCast(field, next) {
  const res = next();
  if (res && res instanceof Buffer) {
    // Convert buffer to hex string
    const hex = [...res].map((v) => ('00' + v.toString(16)).slice(-2)).join('');
    if (field.type === 'BIT') return parseInt(hex, 16);
    return hex;
  }
  if (field.type === 'NEWDECIMAL') {
    return res ? parseFloat(res) : res;
  }
  return res;
}

// Dynamic configuration
const dynamicPoolSize = process.env.DYNAMIC_POOL_SIZE === 'true';
const dynamicPoolPercent = process.env.DYNAMIC_POOL_PERCENT
  ? parseInt(process.env.DYNAMIC_POOL_PERCENT, 10)
  : 50;

// How long a pool can sit idle before the sweep destroys it (default 60 min)
const IDLE_POOL_TTL_MS = process.env.IDLE_POOL_TTL_MIN
  ? parseInt(process.env.IDLE_POOL_TTL_MIN, 10) * 60_000
  : 60 * 60_000;

// How often the idle-pool sweep runs (default 10 min)
const SWEEP_INTERVAL_MS = process.env.SWEEP_INTERVAL_MIN
  ? parseInt(process.env.SWEEP_INTERVAL_MIN, 10) * 60_000
  : 10 * 60_000;

// Per-query timeout in ms (default 45s)
const QUERY_TIMEOUT_MS = process.env.QUERY_TIMEOUT_MS
  ? parseInt(process.env.QUERY_TIMEOUT_MS, 10)
  : 45_000;

const connectionPools: Record<string, Knex> = {};
const connectionStats: Record<
  string,
  {
    queries: number;
    createdAt: string;
    lastQueryAt?: string;
    shared?: boolean;
  }
> = {};

// sourceId → connectionKey so we can detect config changes and destroy stale pools
const sourceHashMap = new Map<string, string>();

// connectionKey → last time a query used this pool
const poolLastAccess = new Map<string, number>();

// Cache max connection results per unique config signature to avoid re-querying.
const maxConnectionsCache = new Map<string, number>();

const isMysql = (client: string) => {
  return client === 'mysql' || client === 'mysql2';
};

const isPg = (client: string) => client === 'pg';

const queryTimeoutOpts = (client: string) =>
  isPg(client) || isMysql(client) ? { cancel: true } : undefined;

function getKnexClient(client: string) {
  if (client === 'snowflake') return SnowflakeClient;
  if (client === 'databricks') return DatabricksClient;
  return client;
}

const BodyJsonSchema = {
  type: 'object',
  required: ['query', 'config'],
  properties: {
    query: { type: 'array', items: { type: 'string' } },
    config: {
      type: 'object',
      properties: {
        client: { type: 'string' },
        connection: { type: 'object' },
      },
      required: ['client', 'connection'],
    },
    raw: { type: 'boolean' },
    sourceId: { type: 'string' },
  },
};

function serializeError(err: any) {
  return {
    message: err.message,
    _errorType: err.constructor?.name,
  };
}

async function execAndGetRows(kn: Knex, config: any, query: string) {
  const client = config.client;
  const isSelect = /^(\(|)select/i.test(query);
  const isInsert = /^(\(|)insert/i.test(query);

  if (client === 'pg' || client === 'snowflake') {
    return (
      await kn.raw(query).timeout(QUERY_TIMEOUT_MS, queryTimeoutOpts(client))
    )?.rows;
  } else if (isSelect) {
    // Wrap select queries (some dialects require this)
    return await kn
      .from(kn.raw(query).wrap('(', ') __nc_alias'))
      .timeout(QUERY_TIMEOUT_MS, queryTimeoutOpts(client));
  } else if (isInsert && isMysql(client)) {
    const res = await kn
      .raw(query)
      .timeout(QUERY_TIMEOUT_MS, queryTimeoutOpts(client));
    if (res && res[0] && res[0].insertId) return res[0].insertId;
    return res;
  } else {
    return await kn
      .raw(query)
      .timeout(QUERY_TIMEOUT_MS, queryTimeoutOpts(client));
  }
}

async function getDynamicPoolSize(
  config: any,
  connectionKey: string,
  sourceId: string | null,
) {
  if (!dynamicPoolSize) return undefined;

  // Check cache first
  if (maxConnectionsCache.has(connectionKey)) {
    const cachedMax = maxConnectionsCache.get(connectionKey);
    if (cachedMax) {
      return Math.floor((cachedMax * dynamicPoolPercent) / 100);
    }
  }

  // Temporary knex to query max connections
  const tempKnex = knex({
    ...config,
    connection: {
      ...(config.connection || {}),
      typeCast,
    },
    pool: { min: 0, max: 1 },
  });

  let maxConnections;
  try {
    if (config.client === 'mysql2' || config.client === 'mysql') {
      const res = await tempKnex.raw("SHOW VARIABLES LIKE 'max_connections'");
      maxConnections = res?.[0]?.[0]?.Value;
    } else if (config.client === 'pg') {
      const res = await tempKnex.raw('SHOW max_connections');
      maxConnections = res.rows?.[0]?.max_connections;
    } else {
      // Default fallback for other DBs
      maxConnections = 20;
    }
  } catch (err) {
    console.error(sourceId, 'Error fetching max_connections:', err);
    maxConnections = 20; // a safe default
  } finally {
    await tempKnex.destroy().catch((e) => console.error(sourceId, e));
  }

  const parsedMax = parseInt(maxConnections || '20', 10);
  maxConnectionsCache.set(connectionKey, parsedMax);
  return Math.floor((parsedMax * dynamicPoolPercent) / 100);
}

/**
 * Check if any sourceId still points to the given connectionKey.
 */
function isPoolReferenced(connectionKey: string): boolean {
  for (const key of sourceHashMap.values()) {
    if (key === connectionKey) return true;
  }
  return false;
}

async function getConnectionPool(config: any, sourceId: string | null) {
  const { pool, ...configWithoutPool } = config;
  const connectionKey = hash(configWithoutPool, { unorderedArrays: true });

  // If this sourceId previously used a different config, destroy the old pool
  if (sourceId) {
    const prevKey = sourceHashMap.get(sourceId);
    if (prevKey && prevKey !== connectionKey) {
      sourceHashMap.delete(sourceId);
      delete connectionStats[sourceId];

      // Destroy old pool only if no other sourceId still references it
      if (!isPoolReferenced(prevKey) && connectionPools[prevKey]) {
        await connectionPools[prevKey].destroy().catch((e) => {
          console.error('Error destroying stale pool:', e);
        });
        delete connectionPools[prevKey];
        poolLastAccess.delete(prevKey);
        maxConnectionsCache.delete(prevKey);
      }
    }

    sourceHashMap.set(sourceId, connectionKey);
  }

  if (!connectionPools[connectionKey]) {
    let poolSizeConfig = {};
    if (dynamicPoolSize) {
      const dynamicPoolMax = await getDynamicPoolSize(
        config,
        connectionKey,
        sourceId,
      );
      if (dynamicPoolMax) {
        poolSizeConfig = { min: 0, max: dynamicPoolMax };
      }
    } else {
      poolSizeConfig = { min: 0, max: MAX_POOL_SIZE };
    }

    connectionPools[connectionKey] = knex({
      ...config,
      connection: {
        ...(config.connection || {}),
        typeCast,
      },
      pool: Object.keys(poolSizeConfig).length > 0 ? poolSizeConfig : undefined,
    });

    if (sourceId) {
      connectionStats[sourceId] = {
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ssZ'),
        queries: 0,
      };
    }
  }

  poolLastAccess.set(connectionKey, Date.now());

  return connectionPools[connectionKey];
}

async function handleQuery(
  kn: Knex,
  config: any,
  query: string | string[],
  raw: boolean,
) {
  if (Array.isArray(query)) {
    // Execute all queries in a single transaction for consistency
    const client = config.client;
    const trx = await kn.transaction();
    const responses = [];
    try {
      for (const q of query) {
        if (raw) {
          responses.push(
            await trx
              .raw(q)
              .timeout(QUERY_TIMEOUT_MS, queryTimeoutOpts(config.client)),
          );
        } else {
          const execRowsResult = await execAndGetRows(trx, config, q);
          if (isMysql(client) && !Array.isArray(execRowsResult)) {
            // this is the case of returnedId from mySql, which is number
            responses.push(execRowsResult);
          } else {
            responses.push(...execRowsResult);
          }
        }
      }
      await trx.commit();
      return responses;
    } catch (e) {
      await trx.rollback();
      throw e;
    }
  } else {
    return raw
      ? kn.raw(query).timeout(QUERY_TIMEOUT_MS, queryTimeoutOpts(config.client))
      : execAndGetRows(kn, config, query);
  }
}

async function queryHandler(req, res) {
  const startTime = dayjs();
  const { query: queries, config, raw = false } = req.body;
  const { sourceId = null } = req.params || {};

  config.client = getKnexClient(config.client);

  const query = queries.length === 1 ? queries[0] : queries;

  let kn: Knex;
  try {
    kn = await getConnectionPool(config, sourceId);
  } catch (err) {
    console.error('Error establishing connection pool:', err);
    return res.status(500).send({ error: serializeError(err) });
  }

  try {
    const result = await handleQuery(kn, config, query, raw);
    // Update stats if sourceId is provided
    if (sourceId) {
      if (connectionStats[sourceId]) {
        connectionStats[sourceId].queries++;
        connectionStats[sourceId].lastQueryAt = dayjs().format(
          'YYYY-MM-DD HH:mm:ssZ',
        );
      } else {
        connectionStats[sourceId] = {
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ssZ'),
          queries: 1,
          shared: true,
        };
      }
    }

    return res.send(result);
  } catch (e) {
    console.error('\nQuery failed with error:', e, '\nQuery:', query, '\n');
    return res.status(500).send({ error: serializeError(e) });
  } finally {
    // Optionally log query execution time if needed
    if (DEBUG) {
      const duration = dayjs().diff(startTime, 'millisecond');
      console.log(`Query executed in ${duration}ms`);
    }
  }
}

fastify.post('/query', { schema: { body: BodyJsonSchema } }, queryHandler);
fastify.post(
  '/query/:sourceId',
  { schema: { body: BodyJsonSchema } },
  queryHandler,
);

fastify.get('/api/v1/health', async (req, res) => {
  res.status(200).send({
    uptime: process.uptime(),
    message: 'OK',
    date: new Date(),
  });
});

fastify.get('/metrics', async (req, res) => {
  res.status(200).send(connectionStats);
});

/**
 * Periodically destroy connection pools that have been idle longer than
 * IDLE_POOL_TTL_MS. Cleans up all related maps so nothing grows unbounded.
 */
async function sweepIdlePools() {
  const now = Date.now();

  for (const [connectionKey, lastAccess] of poolLastAccess) {
    if (now - lastAccess < IDLE_POOL_TTL_MS) continue;

    // Destroy the pool
    if (connectionPools[connectionKey]) {
      await connectionPools[connectionKey].destroy().catch((e) => {
        console.error('Error destroying idle pool:', e);
      });
      delete connectionPools[connectionKey];
    }

    poolLastAccess.delete(connectionKey);
    maxConnectionsCache.delete(connectionKey);

    // Remove all sourceIds that pointed to this pool
    for (const [sourceId, key] of sourceHashMap) {
      if (key === connectionKey) {
        sourceHashMap.delete(sourceId);
        delete connectionStats[sourceId];
      }
    }
  }
}

setInterval(() => {
  sweepIdlePools().catch((e) => console.error('Idle pool sweep error:', e));
}, SWEEP_INTERVAL_MS);

async function gracefulShutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);

  // Stop accepting new requests
  await fastify.close().catch(() => {});

  // Destroy all connection pools
  const destroyPromises = Object.entries(connectionPools).map(([key, pool]) => {
    delete connectionPools[key];
    return pool.destroy().catch(() => {});
  });
  await Promise.all(destroyPromises);

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

fastify.listen(
  { port: +process.env.PORT || 9000, host: process.env.HOST || 'localhost' },
  (err) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    console.log(
      `Server listening on ${process.env.HOST || 'localhost'}:${
        +process.env.PORT || 9000
      }`,
    );
  },
);
