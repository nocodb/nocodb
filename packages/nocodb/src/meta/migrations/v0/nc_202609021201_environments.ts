import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const OLD_INSTANCES = 'nc_sandboxes_v2';
const OLD_CHANGELOG = 'nc_sandbox_changelog';

//
// The named settings an integration, a base variable or a whole base can run
// under (production / staging / custom), and the per-base lane instances that
// carry them. The sandbox tables predate this branch, so they are RENAMED
// rather than created — nc_019_sandboxes and its successors are already
// recorded on develop and their rows must survive.
//
// `fk_environment_id` is everywhere a SOFT id reference (meta tables use no DB
// FKs): a built-in reserved key (`production`/`staging`) or a custom `env…` row
// id. nc_environments itself stores only CUSTOM environments.

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.ENVIRONMENTS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20);
    table.string('key', 50).notNullable();
    table.string('title', 255);
    table.text('description');
    table.string('color', 20);
    table.float('order');
    table.text('meta');
    // Promote topology (§3.2) — star now, chain later: persisted so an ordered
    // promote ladder can be layered on with NO migration. NULL = promotes to
    // production.
    table.string('promotes_to', 20);
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['id']);
    table.unique(['fk_workspace_id', 'key'], {
      indexName: 'nc_environments_ws_key_unique',
    });
    table.unique(['fk_org_id', 'key'], {
      indexName: 'nc_environments_org_key_unique',
    });
    table.index(['fk_workspace_id'], 'nc_environments_ws_index');
    table.index(['fk_org_id'], 'nc_environments_org_index');
  });

  // Per-environment integration config OVERRIDES. The default/production config
  // stays in `nc_integrations_v2.config`; this table holds only non-default env
  // overrides. `config` is an encrypted JSON blob, same shape/encryption as the
  // integration's own config. `production` NEVER appears here (its config is the
  // integration's own).
  await knex.schema.createTable(MetaTable.INTEGRATION_ENV_CONFIGS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_integration_id', 20).notNullable();
    table.string('fk_environment_id', 20).notNullable();
    table.text('config');
    table.boolean('is_encrypted').defaultTo(false);
    table.text('meta');
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['id']);
    table.unique(['fk_integration_id', 'fk_environment_id'], {
      indexName: 'nc_integration_env_configs_int_env_unique',
    });
    table.index(['fk_integration_id'], 'nc_integration_env_configs_int_index');
    table.index(['fk_environment_id'], 'nc_integration_env_configs_env_index');
  });

  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.string('credential_mode', 20).defaultTo('shared');
  });

  // Per-user credentials for `per_user` AUTH integrations. One row per
  // (integration, user, environment) — a user's token is minted per environment
  // (a staging connection authorizes a different account than production).
  //
  // Unlike nc_integration_env_configs, the reserved key `production` IS stored
  // here: per-user mode never falls back to the integration's own config (that
  // would silently escalate to the admin's credential), so production needs its
  // own row. `config` NEVER leaves the backend — not even to its owner; clients
  // only ever see connection state.
  await knex.schema.createTable(MetaTable.INTEGRATION_USER_CONFIGS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_integration_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable();
    table.string('fk_environment_id', 20).notNullable();
    table.text('config');
    table.boolean('is_encrypted').defaultTo(false);
    table.text('meta');
    table.timestamps(true, true);
    table.primary(['id']);
    // Enables the atomic onConflict().merge() upsert on the token-refresh path.
    table.unique(['fk_integration_id', 'fk_user_id', 'fk_environment_id'], {
      indexName: 'nc_integration_user_configs_int_user_env_unique',
    });
    table.index(['fk_integration_id'], 'nc_integration_user_configs_int_index');
    table.index(['fk_user_id'], 'nc_integration_user_configs_user_index');
    table.index(['fk_environment_id'], 'nc_integration_user_configs_env_index');
  });

  // Per-environment value OVERRIDES for base variables, mirroring
  // nc_integration_env_configs. The default/production value stays in
  // `nc_base_variables.value`.
  //
  // Variable ids are preserved across base duplication (composite (base_id, id)
  // PK on nc_base_variables), so the unique constraint must include base_id —
  // the same fk_variable_id legitimately exists in multiple bases.
  await knex.schema.createTable(MetaTable.BASE_VARIABLE_ENV_VALUES, (table) => {
    table.string('id', 20).notNullable();
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('fk_variable_id', 20).notNullable();
    table.string('fk_environment_id', 20).notNullable();
    table.text('value');
    table.boolean('is_encrypted').defaultTo(false);
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.unique(['base_id', 'fk_variable_id', 'fk_environment_id'], {
      indexName: 'nc_base_var_env_values_unique',
    });
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_base_var_env_values_base_ws_index',
    );
    table.index(['fk_environment_id'], 'nc_base_var_env_values_env_index');
  });

  // instance table: one sandbox per base -> N lane instances per base
  //
  // COPIED, not renamed. A rename is invisible to the pod running it and fatal
  // to every pod still on the previous image: they go on querying
  // `nc_sandboxes_v2` and `is_sandbox`, which during a rolling deploy is most
  // of the fleet. `is_sandbox` sits in the base-list query behind every
  // dashboard load, so a rename there is a whole-platform outage on the way in
  // — and the old image cannot be rolled back to, because knex refuses to boot
  // against migrations it has no record of.
  //
  // So this migration only ADDS. A follow-up release drops the old names once
  // nothing reads them, and reconciles rows written to the old shape during the
  // shift.
  //
  // Legacy rows are grandfathered: fk_environment_id stays NULL, which resolves
  // production config exactly as a pre-lane sandbox did.
  await knex.schema.createTable(MetaTable.BASE_ENVIRONMENTS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('fk_base_id', 20).notNullable();
    table.string('fk_lane_base_id', 20).notNullable();
    table.string('created_by', 20).notNullable();
    table.text('meta');
    table.string('state', 20).notNullable().defaultTo('idle');
    table.text('state_error');
    table.timestamp('state_started_at');
    // Which environment this lane runs its Auth/AI integrations under, so
    // testing in a lane uses staging credentials instead of production. NULL =
    // production (no override). Credential separation only — data isolation is
    // unaffected (the lane already duplicates the internal schema).
    table.string('fk_environment_id', 20);
    table.string('data_mode', 20).notNullable().defaultTo('full');
    table.integer('data_window_days');
    // When the lane's rows were last re-copied from Production. A lane goes
    // stale the moment Production is written to, and the alternative to a sync
    // is close-and-reopen, which changes the lane base id and destroys
    // uncommitted work. NULL means never synced since it was opened.
    table.timestamp('last_data_synced_at', { useTz: true });
    table.timestamps(true, true);
  });

  // Ids are carried over, so everything referencing an instance still resolves.
  await knex.raw(
    `INSERT INTO ?? (
       id, fk_workspace_id, fk_base_id, fk_lane_base_id, created_by, meta,
       state, state_error, state_started_at, created_at, updated_at
     )
     SELECT
       id, fk_workspace_id, production_base_id, sandbox_base_id, created_by,
       meta, merge_state, merge_error, merge_started_at, created_at, updated_at
     FROM ??`,
    [MetaTable.BASE_ENVIRONMENTS, OLD_INSTANCES],
  );

  await knex.schema.alterTable(MetaTable.BASE_ENVIRONMENTS, (table) => {
    table.index(['fk_workspace_id'], 'nc_base_environments_ws_idx');
    table.index(['fk_base_id'], 'nc_base_environments_base_idx');
    table.index(['fk_lane_base_id'], 'nc_base_environments_lane_base_idx');
    table.index(['created_by'], 'nc_base_environments_created_by_idx');
    // One instance per (base, environment). NULLs compare distinct, but legacy
    // NULL-lane rows were already <=1 per base under the old unique on
    // production_base_id, and new inserts always name a lane
    // (service-enforced).
    table.unique(
      ['fk_base_id', 'fk_environment_id'],
      'nc_base_environments_base_env_unique',
    );
  });

  // changelog
  // `seq` values are preserved — replay order must not change.
  //
  // entity_id/parent_entity_id are created at their widened length directly.
  // `nc_202608211200_widen_entity_id_columns` widens the OLD table under its own
  // name, so it stays in its chronological slot and untouched.
  await knex.schema.createTable(MetaTable.ENVIRONMENT_CHANGELOG, (table) => {
    table.string('id', 20).notNullable().primary();
    table.bigInteger('seq').notNullable();
    table.string('fk_base_environment_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('event', 80).notNullable();
    table.string('entity_type', 40).notNullable();
    table.string('entity_id', 255);
    table.string('entity_title', 255);
    table.string('parent_entity_id', 255);
    table.string('parent_entity_title', 255);
    table.string('created_by', 20).notNullable();
    table.text('description').nullable();
    table.text('meta');
    table.string('status', 20).notNullable().defaultTo('pending');
    table.timestamp('merged_at');
    table.timestamps(true, true);
  });

  await knex.raw(
    `INSERT INTO ?? (
       id, seq, fk_base_environment_id, base_id, event, entity_type, entity_id,
       entity_title, parent_entity_id, parent_entity_title, created_by,
       description, meta, status, merged_at, created_at, updated_at
     )
     SELECT
       id, seq, fk_sandbox_id, base_id, event, entity_type, entity_id,
       entity_title, parent_entity_id, parent_entity_title, created_by,
       description, meta, status, merged_at, created_at, updated_at
     FROM ??`,
    [MetaTable.ENVIRONMENT_CHANGELOG, OLD_CHANGELOG],
  );

  await knex.schema.alterTable(MetaTable.ENVIRONMENT_CHANGELOG, (table) => {
    table.unique(
      ['fk_base_environment_id', 'seq'],
      'nc_ecl_instance_seq_unique',
    );
    table.index(['fk_base_environment_id', 'seq'], 'nc_ecl_instance_seq_index');
    table.index(['base_id'], 'nc_ecl_base_id_index');
    table.index(['entity_type', 'entity_id'], 'nc_ecl_entity_type_id_index');
  });

  // base flags
  // Added beside `is_sandbox` / `is_sandbox_production`, never over them: this
  // is the hottest table in the deployment and old pods filter the base list on
  // the old names. `ADD COLUMN ... DEFAULT false` is metadata-only on PG11+, so
  // no table rewrite.
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.boolean('is_lane_instance').defaultTo(false);
    table.boolean('has_lane_instances').defaultTo(false);
  });

  // Only the true rows — a handful — need writing; the column default already
  // says false for everything else, and NULL meant false to every old reader.
  // An unqualified UPDATE here would rewrite every base row in the deployment.
  await knex(MetaTable.PROJECT)
    .where('is_sandbox', true)
    .update({ is_lane_instance: true });
  await knex(MetaTable.PROJECT)
    .where('is_sandbox_production', true)
    .update({ has_lane_instances: true });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.index(['is_lane_instance'], 'nc_bases_is_lane_instance_idx');
    table.index(['has_lane_instances'], 'nc_bases_has_lane_instances_idx');
  });
};

const down = async (knex: Knex) => {
  // Mirrors an additive `up`: the originals were never renamed or dropped, so
  // rolling back means removing what was added. Nothing is reverse-renamed and
  // no instance row is destroyed — `nc_sandboxes_v2` and `nc_sandbox_changelog`
  // still hold everything they held before, and the old base flags were never
  // touched. Rows created in the new tables after the deploy are lost, which is
  // what a rollback of a feature means.
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropIndex(['is_lane_instance'], 'nc_bases_is_lane_instance_idx');
    table.dropIndex(['has_lane_instances'], 'nc_bases_has_lane_instances_idx');
  });
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropColumn('is_lane_instance');
    table.dropColumn('has_lane_instances');
  });

  await knex.schema.dropTable(MetaTable.ENVIRONMENT_CHANGELOG);
  await knex.schema.dropTable(MetaTable.BASE_ENVIRONMENTS);

  await knex.schema.dropTable(MetaTable.BASE_VARIABLE_ENV_VALUES);
  await knex.schema.dropTable(MetaTable.INTEGRATION_USER_CONFIGS);
  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.dropColumn('credential_mode');
  });
  await knex.schema.dropTable(MetaTable.INTEGRATION_ENV_CONFIGS);
  await knex.schema.dropTable(MetaTable.ENVIRONMENTS);
};

export { up, down };
