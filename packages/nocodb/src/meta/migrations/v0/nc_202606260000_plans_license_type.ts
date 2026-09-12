import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Map kept inline (not imported from SDK) so this migration is hermetic and
// stable even if SDK enum values are later renamed. The three (title, type)
// pairs reflect the on-prem paid plans the JWT issuer signs today.
const TITLE_TO_LICENSE_TYPE: Array<[string, string]> = [
  ['Self-hosted Business', 'self_hosted_business'],
  ['Self-hosted Scale', 'self_hosted_scale'],
  ['Self-hosted Enterprise', 'self_hosted_enterprise'],
];

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PLANS, (table) => {
    table.string('license_type', 40).nullable();
    table.index('license_type', 'nc_plans_license_type_idx');
  });

  // Backfill existing rows. Cloud-only titles (Free / Plus / Business /
  // Enterprise) are intentionally left NULL — they never produce an on-prem
  // license.
  for (const [title, licenseType] of TITLE_TO_LICENSE_TYPE) {
    await knex(MetaTable.PLANS)
      .where({ title })
      .update({ license_type: licenseType });
  }
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PLANS, (table) => {
    table.dropIndex('license_type', 'nc_plans_license_type_idx');
    table.dropColumn('license_type');
  });
};

export { up, down };
