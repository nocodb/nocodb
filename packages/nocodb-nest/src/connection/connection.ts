import { Global, Injectable, OnModuleInit } from '@nestjs/common';

import * as knex from 'knex';
import NcConfigFactory from '../utils/NcConfigFactory';

@Global()
@Injectable()
export class Connection implements OnModuleInit {
  private knex: knex.Knex;
  private dbConfig: any;

  get knexInstance(): knex.Knex {
    return this.knex;
  }

  // init metadb connection
  async onModuleInit(): Promise<void> {
    this.dbConfig = await NcConfigFactory.make();
    this.knex = knex.default({ ...this.dbConfig.meta.db, useNullAsDefault: true });
  }
}
