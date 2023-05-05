import { Global, Injectable, Scope } from '@nestjs/common';

import { XKnex } from '../db/CustomKnex';
import NcConfigFactory from '../utils/NcConfigFactory';
import type * as knex from 'knex';

@Injectable({
  scope: Scope.DEFAULT,
})
export class Connection {
  public static knex: knex.Knex;
  public static _config: any;

  get knexInstance(): knex.Knex {
    return Connection.knex;
  }

  get config(): knex.Knex {
    return Connection._config;
  }

  // init metadb connection
  static async init(): Promise<void> {
    Connection._config = await NcConfigFactory.make();
    if (!Connection.knex) {
      Connection.knex = XKnex({
        ...this._config.meta.db,
        useNullAsDefault: true,
      });
    }
  }

  // init metadb connection
  async init(): Promise<void> {
    return await Connection.init();
  }
}
