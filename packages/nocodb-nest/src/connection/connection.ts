import { Global, Injectable, Scope } from '@nestjs/common'
import type * as knex from 'knex'

import { XKnex } from '../db/CustomKnex'
import NcConfigFactory from '../utils/NcConfigFactory'

@Injectable({
  scope: Scope.DEFAULT
})
export class Connection {
  private knex: knex.Knex;
  private _config: any;

  get knexInstance(): knex.Knex {
    return this.knex;
  }

  get config(): knex.Knex {
    return this._config;
  }

  // init metadb connection
  async init(): Promise<void> {
    this._config = await NcConfigFactory.make();
    this.knex = XKnex({
      ...this._config.meta.db,
      useNullAsDefault: true,
    });
  }
}
