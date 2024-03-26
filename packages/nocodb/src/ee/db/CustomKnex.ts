import { Knex } from 'knex';
import { SnowflakeClient } from 'knex-snowflake';
import CustomKnexCE from 'src/db/CustomKnex';

type CustomKnex = Knex;

function CustomKnex(
  arg: string | Knex.Config<any> | any,
  extDb?: any,
): CustomKnex {
  if (arg?.client === 'snowflake') arg.client = SnowflakeClient;

  return CustomKnexCE(arg, extDb);
}

export default CustomKnex;
export { Knex, CustomKnex as XKnex };
