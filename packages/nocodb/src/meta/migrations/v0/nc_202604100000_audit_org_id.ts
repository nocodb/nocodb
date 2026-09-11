import {
  up as addOrgId,
  down as dropOrgId,
} from '~/meta/migrations/audit/nc_002_add_org_id';

const up = async (knex) => {
  const start = Date.now();
  console.log('[nc_202604100000_audit_org_id] Starting migration...');

  await addOrgId(knex);

  console.log(
    `[nc_202604100000_audit_org_id] Migration completed in ${
      Date.now() - start
    }ms`,
  );
};

const down = async (knex) => {
  await dropOrgId(knex);
};

export { up, down };
