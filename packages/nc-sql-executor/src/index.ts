import express from 'express';
import knex, { Knex } from 'knex';
import hash from 'object-hash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone';
import { defaults, types } from 'pg';

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

const app = express();
const connectionPools: { [key: string]: Knex; } = {};

app.use(express.json());

app.post('/query', async (req, res) => {
  const { query, config, raw = false } = req.body;

  config.pool = {
    min: 0,
    max: 5,
  }

  const connectionKey = hash(config);

  if (!connectionPools[connectionKey]) {
    connectionPools[connectionKey] = knex(config);
  }

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
                  : await trx.raw(q)
            );
          }
        }
        await trx.commit();
        result = responses;
      } catch (e) {
        await trx.rollback();
        console.error(e);
        return res.status(500).send({
          error: e.message
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
              ? await connectionPools[connectionKey].from(connectionPools[connectionKey].raw(query).wrap('(', ') __nc_alias'))
              : await connectionPools[connectionKey].raw(query);
      }
    }
  } catch (e) {
    console.log('\nQuery failed with error:');
    console.log(query);
    console.log(e);
    console.log('\n');
    return res.status(500).send({
      error: e.message
    });
  }
  res.send(result);
});

app.listen(process.env.PORT || 9000, () => {
  console.log(`Server listening on port ${process.env.PORT || 9000}`);
});

