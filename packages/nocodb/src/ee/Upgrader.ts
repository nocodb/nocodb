import { default as CEUpgrader } from 'src/Upgrader';
import type CustomKnex from '~/db/CustomKnex';
import type { Source } from '~/models';
import { MetaTable, RootScopes, RootScopeTables } from '~/utils/globals';

const BATCH_SIZE = 500;

export default class Upgrader extends CEUpgrader {
  protected async logHelper(workspace_id, base_id, target, q) {
    const qStr = q.toQuery();

    if (
      (workspace_id === RootScopes.BYPASS && base_id === RootScopes.BYPASS) ||
      (workspace_id === RootScopes.FULL_BYPASS &&
        base_id === RootScopes.FULL_BYPASS)
    ) {
      return;
    }

    if (target === MetaTable.PROJECT) {
      if (!qStr.includes('fk_workspace_id') || !qStr.includes('id')) {
        if (!(workspace_id in RootScopeTables)) {
          console.log(`Missing tenant isolation (${workspace_id}): ${qStr}`);
          console.log(new Error().stack);
        }
      }
    } else {
      if (
        !qStr.includes('fk_workspace_id') ||
        (base_id !== RootScopes.WORKSPACE && !qStr.includes('base_id'))
      ) {
        if (!(workspace_id in RootScopeTables)) {
          console.log(`Missing tenant isolation (${workspace_id}): ${qStr}`);
          console.log(new Error().stack);
        }
      }
    }
  }

  async runUpgraderQueries() {
    if (!this._upgrader_mode) throw new Error('Upgrader mode is not enabled');

    const queries = this._upgrader_queries.splice(0, BATCH_SIZE);

    if (!queries.length) return [];

    await this.knexConnection.raw(queries.join(';'));
  }

  static async flushSourceQueries(source: Source, dbDriver: CustomKnex) {
    const queries = source.upgraderQueries?.splice(0) ?? [];

    if (!queries.length) return;

    await dbDriver.raw(queries.join(';'));
  }
}
