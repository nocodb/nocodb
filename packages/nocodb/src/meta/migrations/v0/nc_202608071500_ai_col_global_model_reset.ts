import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_202608071500_ai_col_global_model_reset');

const RETIRED_TIER_NAMES = ['high', 'medium', 'low'];

/** The synthetic id `Integration.get` short-circuits for the managed AI integration. */
const GLOBAL_AI_INTEGRATION_ID = 'global_ai';

const up = async (knex: Knex) => {
  for (const table of [MetaTable.COL_LONG_TEXT, MetaTable.COL_BUTTON]) {
    const cleared = await knex(table)
      .whereNotNull('model')
      .where((qb) => {
        qb.where('fk_integration_id', GLOBAL_AI_INTEGRATION_ID).orWhereIn(
          'model',
          RETIRED_TIER_NAMES,
        );
      })
      .update({ model: null });

    if (cleared) {
      logger.log(`Cleared stored AI model picks on ${cleared} ${table} row(s)`);
    }
  }
};

const down = async (_knex: Knex) => {};

export { up, down };
