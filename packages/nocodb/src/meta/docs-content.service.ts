import { Injectable, Optional } from '@nestjs/common';
import type { knex } from 'knex';
import { MetaService } from '~/meta/meta.service';
import { NcConfig } from '~/utils/nc-config';

@Injectable()
export class DocsContentService extends MetaService {
  constructor(
    config: NcConfig,
    @Optional() trx = null,
    @Optional() nested = 0,
    @Optional() sharedKnex: knex.Knex | null = null,
  ) {
    super(config, trx, nested, sharedKnex);
  }
}
