import { Injectable, Scope } from '@nestjs/common';

import { XKnex } from '../db/CustomKnex';
import { NcConfig } from '../utils/nc-config';
import type * as knex from 'knex';

@Injectable({
  scope: Scope.DEFAULT,
})
export class Connection {
  private knex: knex.Knex;
  private _config: any;

  constructor(config: NcConfig) {
    this._config = config;
    this.knex = XKnex({
      ...this._config.meta.db,
      useNullAsDefault: true,
    });
  }

  get knexInstance(): knex.Knex {
    return this.knex;
  }

  get config(): NcConfig {
    return this._config;
  }
}
