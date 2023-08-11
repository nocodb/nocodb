import {
  _wherePk,
  BaseModelSqlv2 as BaseModelSqlv2CE,
  extractCondition,
  extractFilterFromXwhere,
  extractSortsObject,
  getListArgs,
} from 'src/db/BaseModelSqlv2';
import type { Model } from '~/models';

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BaseModelSqlv2 extends BaseModelSqlv2CE {
  public schema?: string;

  constructor({
    dbDriver,
    model,
    viewId,
    schema,
  }: {
    [key: string]: any;
    model: Model;
    schema?: string;
  }) {
    super({ dbDriver, model, viewId });
    this.schema = schema;
  }

  public getTnPath(tb: { table_name: string } | string, alias?: string) {
    const tn = typeof tb === 'string' ? tb : tb.table_name;
    const schema = (this.dbDriver as any).searchPath?.();
    if (this.isPg && this.schema) {
      return `${this.schema}.${tn}${alias ? ` as ${alias}` : ``}`;
    } else if (this.isMssql && schema) {
      return this.dbDriver.raw(`??.??${alias ? ' as ??' : ''}`, [
        schema,
        tn,
        ...(alias ? [alias] : []),
      ]);
    } else if (this.isSnowflake) {
      return `${[
        this.dbDriver.client.config.connection.database,
        this.dbDriver.client.config.connection.schema,
        tn,
      ].join('.')}${alias ? ` as ${alias}` : ``}`;
    } else {
      return `${tn}${alias ? ` as ${alias}` : ``}`;
    }
  }
}

export {
  BaseModelSqlv2,
  _wherePk,
  extractCondition,
  extractFilterFromXwhere,
  extractSortsObject,
  getListArgs,
};
