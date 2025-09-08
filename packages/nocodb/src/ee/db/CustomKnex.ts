import { Knex } from 'knex';
import { SnowflakeClient } from 'knex-snowflake';
import { DatabricksClient } from 'knex-databricks';
import CustomKnexCE from 'src/db/CustomKnex';
export { Condition, ConditionVal } from 'src/db/CustomKnex';

type CustomKnex = CustomKnexCE & {
  extDb?: {
    client: string;
    connection: Record<string, string>;
  };
  isExtDb?: boolean;
};

function CustomKnex(
  arg: string | Knex.Config<any> | any,
  extDb?: any,
): CustomKnex {
  if (arg?.client === 'snowflake') arg.client = SnowflakeClient;
  if (arg?.client === 'databricks') arg.client = DatabricksClient;

  return CustomKnexCE(arg, extDb);
}

export default CustomKnex;
export { Knex, CustomKnex as XKnex };
