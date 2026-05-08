import knex from 'knex';
import Result from '../../../util/Result';
import D1KnexClient from './D1KnexClient';
import SqliteClient from '~/db/sql-client/lib/sqlite/SqliteClient';

class D1Client extends SqliteClient {
  constructor(connectionConfig) {
    const d1Knex =
      connectionConfig?.knex ||
      knex({
        client: D1KnexClient,
        connection: connectionConfig.connection,
        useNullAsDefault: true,
      } as any);

    super({
      ...connectionConfig,
      knex: d1Knex,
    });

    this.knex = d1Knex;
    this.sqlClient = d1Knex;
  }

  async testConnection(_args: any = {}) {
    const result = new Result();

    try {
      await this.raw('SELECT 1+1 as data');
    } catch (e) {
      result.code = -1;
      result.message = e.message;
    }

    return result;
  }

  async hasDatabase(_args: any = {}) {
    const result = new Result();
    try {
      await this.raw('SELECT 1');
      result.data.value = true;
    } catch (e) {
      result.data.value = false;
      result.code = -1;
      result.message = e.message;
    }
    return result;
  }

  async createDatabaseIfNotExists(_args: any = {}) {
    return new Result();
  }

  async dropDatabase(_args: any = {}) {
    return new Result();
  }

  private isD1InternalName(name?: string) {
    return name?.toLowerCase().startsWith('_cf_');
  }

  async tableList(args: any = {}) {
    const result = await super.tableList(args);
    result.data.list = result.data.list.filter(
      (table) => !this.isD1InternalName(table.tn || table.name),
    );
    return result;
  }

  async viewList(args: any = {}) {
    const result = await super.viewList(args);
    result.data.list = result.data.list.filter(
      (view) => !this.isD1InternalName(view.view_name || view.name),
    );
    return result;
  }

  async relationList(args: any = {}) {
    if (this.isD1InternalName(args.tn)) {
      const result = new Result();
      result.data.list = [];
      return result;
    }

    return super.relationList(args);
  }
}

export default D1Client;
