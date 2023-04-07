import { Global, Injectable, OnModuleInit } from '@nestjs/common';

import * as knex from 'knex';
import { XKnex } from '../db/CustomKnex'
import NcConfigFactory from '../utils/NcConfigFactory';

@Global()
@Injectable()
export class Connection implements OnModuleInit {
  private knex: knex.Knex;
  private _config: any;

  get knexInstance(): knex.Knex {
    return this.knex;
  }

  get config(): knex.Knex {
    return this._config;
  }

  // init metadb connection
  async onModuleInit(): Promise<void> {
    this._config = await NcConfigFactory.make();
    this.knex = XKnex({
      ...this._config.meta.db,
      useNullAsDefault: true,
    });
  }
}
