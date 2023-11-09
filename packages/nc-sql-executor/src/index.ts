import Fastify from 'fastify';
import knex, { Knex } from 'knex';
import hash from 'object-hash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone';
import { defaults, types } from 'pg';

const DEBUG = process.env.DEBUG === 'true';

const fastify = Fastify({
  logger: DEBUG,
});
const connectionPools: { [key: string]: Knex } = {};
const dynamicPoolSize = process.env.DYNAMIC_POOL_SIZE === 'true';
const dynamicPoolPercent = process.env.DYNAMIC_POOL_PERCENT
  ? parseInt(process.env.DYNAMIC_POOL_PERCENT)
  : 50;

const BodyJsonSchema = {
  type: 'object',
  required: ['query', 'config'],
  properties: {
    query: {
      type: 'array',
      items: { type: 'string' },
    },
    config: {
      type: 'object',
      properties: {
        client: { type: 'string' },
        connection: { type: 'object' },
      },
      required: ['client', 'connection'],
    },
    raw: { type: 'boolean' },
  },
};

fastify.post(
  '/query',
  {
    schema: {
      body: BodyJsonSchema,
    },
  },
  async (req, res) => {
    const { query: queries, config, raw = false } = req.body as any;

    const query = queries.length === 1 ? queries[0] : queries;

    const { pool, ...configWithoutPool } = config;

    const connectionKey = hash(configWithoutPool);

    let fromPool = true;

    if (!connectionPools[connectionKey]) {
      if (dynamicPoolSize) {
        // mysql SHOW VARIABLES LIKE 'max_connections'; { Variable_name: 'max_connections', Value: '151' }
        // pg SHOW max_connections; { max_connections: '100' }
        const tempKnex = knex({ ...config, pool: { min: 0, max: 1 } });
        let maxConnections;
        if (config.client === 'mysql2' || config.client === 'mysql') {
          maxConnections = (
            await tempKnex.raw("SHOW VARIABLES LIKE 'max_connections'")
          )?.[0]?.[0]?.Value;
        } else if (config.client === 'pg') {
          maxConnections = (await tempKnex.raw('SHOW max_connections'))
            .rows?.[0]?.max_connections;
        }
        tempKnex.destroy();

        // use dynamicPoolPercent of maxConnections
        const poolSize = Math.floor(
          (parseInt(maxConnections || 20) * dynamicPoolPercent) / 100,
        );

        // console.log('Max connections: ', maxConnections);
        // console.log('Pool size: ', poolSize);

        connectionPools[connectionKey] = knex({
          ...config,
          pool: { min: 0, max: poolSize },
        });
      } else {
        connectionPools[connectionKey] = knex(config);
      }
      fromPool = false;
    }

    /*
    const knexPool = connectionPools[connectionKey].client.pool;

    console.log(`\n
      Connections in use: ${knexPool.numUsed()}\n
      Connections free: ${knexPool.numFree()}\n
      Acquiring: ${knexPool.numPendingAcquires()}\n
      Creating: ${knexPool.numPendingCreates()}\n
      ${dayjs().format('YYYY-MM-DD HH:mm:ssZ')} (${fromPool ? 'pool' : 'fresh'})\n
    `);
    */

    let result;

    try {
      if (Array.isArray(query)) {
        const trx = await connectionPools[connectionKey].transaction();
        const responses = [];
        try {
          for (const q of query) {
            if (raw) {
              responses.push(await trx.raw(q));
            } else {
              responses.push(
                config.client === 'pg' || config.client === 'snowflake'
                  ? (await trx.raw(q))?.rows
                  : q.slice(0, 6) === 'select' && config.client !== 'mssql'
                  ? await trx.from(trx.raw(q).wrap('(', ') __nc_alias'))
                  : await trx.raw(q),
              );
            }
          }
          await trx.commit();
          result = responses;
        } catch (e) {
          await trx.rollback();
          console.error(e);
          return res.status(500).send({
            error: e.message,
          });
        }
      } else {
        if (raw) {
          result = await connectionPools[connectionKey].raw(query);
        } else {
          result =
            config.client === 'pg' || config.client === 'snowflake'
              ? (await connectionPools[connectionKey].raw(query))?.rows
              : query.slice(0, 6) === 'select' && config.client !== 'mssql'
              ? await connectionPools[connectionKey].from(
                  connectionPools[connectionKey]
                    .raw(query)
                    .wrap('(', ') __nc_alias'),
                )
              : await connectionPools[connectionKey].raw(query);
        }
      }
    } catch (e) {
      console.error('\nQuery failed with error:');
      console.error(query);
      console.error(e);
      console.error('\n');
      return res.status(500).send({
        error: e.message,
      });
    }

    res.send(result);
  },
);

fastify.get('/api/v1/health', async (req, res) => {
  res.status(200).send({
    uptime: process.uptime(),
    message: 'OK',
    date: new Date(),
  });
});

fastify.listen(
  { port: +process.env.PORT || 9000, host: process.env.HOST || 'localhost' },
  function (err) {
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

// Custom Knex

dayjs.extend(utc);

dayjs.extend(timezone);

// refer : https://github.com/brianc/node-pg-types/blob/master/lib/builtins.js
const pgTypes = {
  FLOAT4: 700,
  FLOAT8: 701,
  DATE: 1082,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
  NUMERIC: 1700,
};

// override parsing date column to Date()
types.setTypeParser(pgTypes.DATE, (val) => val);
// override timestamp
types.setTypeParser(pgTypes.TIMESTAMP, (val) => {
  return dayjs.utc(val).format('YYYY-MM-DD HH:mm:ssZ');
});
// override timestampz
types.setTypeParser(pgTypes.TIMESTAMPTZ, (val) => {
  return dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
});

const parseFloatVal = (val: string) => {
  return parseFloat(val);
};

// parse integer values
defaults.parseInt8 = true;

// parse float values
types.setTypeParser(pgTypes.FLOAT8, parseFloatVal);
types.setTypeParser(pgTypes.NUMERIC, parseFloatVal);
