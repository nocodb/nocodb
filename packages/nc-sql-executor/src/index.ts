import express from 'express';
import knex, { Knex } from 'knex';
import hash from 'object-hash';

const app = express();
const connectionPools: { [key: string]: Knex; } = {};

app.use(express.json());

app.post('/query', async (req, res) => {
  const { query, config, raw = false } = req.body;

  config.pool = {
    min: 2,
    max: 5,
  }

  const connectionKey = hash(config);

  if (!connectionPools[connectionKey]) {
    connectionPools[connectionKey] = knex(config);
  }

  let result;

  try {
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
  } catch (e) {
    console.log('\nQuery failed with error:');
    console.log(query);
    console.log(e);
    console.log('\n');
  }
  res.send(result);
});

app.listen(9000, () => {
  console.log('Server is listening on port 9000');
});

