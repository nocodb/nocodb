import { ManagedAppCategory, ManagedAppVisibility } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

//
// nc_managed_apps and nc_managed_app_versions predate this branch (nc_015), so
// these are alters. The backfills below are NOT no-ops for anyone already
// running develop with listings — they are what turns a comma-string category
// and a per-app `verified` flag into the storefront's real tables.

const RESERVED_HANDLES = new Set([
  'nocodb',
  'noco',
  'official',
  'admin',
  'support',
  'staff',
  'marketplace',
  'system',
]);

function slugify(input: string) {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

// Backfill 1+2: one publisher per workspace that has a live listing, and
// an `owner` membership for everyone who published one of them. The publisher
// no longer belongs to a workspace, so the workspace is only the grouping this
// one-shot uses to decide how many identities to mint; membership is what
// survives, and `created_by` is the closest thing to "whose apps these are".
export const backfillPublishers = async (knex: Knex) => {
  const workspaceIds: string[] = (
    await knex(MetaTable.MANAGED_APPS)
      .distinct('fk_workspace_id')
      // `deleted` defaults to false but is nullable: a plain
      // `.whereNot('deleted', true)` drops NULL rows under three-valued
      // logic, silently orphaning that workspace's listings.
      .where((qb) => qb.where('deleted', false).orWhereNull('deleted'))
      .whereNotNull('fk_workspace_id')
  ).map((r: any) => r.fk_workspace_id);

  const takenHandles = new Set<string>();
  for (const workspaceId of workspaceIds) {
    const workspace = await knex(MetaTable.WORKSPACE)
      .where('id', workspaceId)
      .first();
    const name = workspace?.title || workspaceId;

    // Deterministic and always unique. A unique violation mid-backfill is the
    // one thing that can wedge this migration on MySQL, where DDL has already
    // auto-committed.
    let handle = slugify(name);
    if (!handle || RESERVED_HANDLES.has(handle) || takenHandles.has(handle)) {
      handle = `${handle || 'publisher'}-${workspaceId}`.slice(0, 64);
    }
    takenHandles.add(handle);

    const id = `mpub${workspaceId}`.slice(0, 20);
    await knex(MetaTable.MARKETPLACE_PUBLISHERS).insert({
      id,
      handle,
      name,
      // false for everyone. Listing-level curation was per-app; promoting it to
      // a publisher badge would apply one app's judgement to that workspace's
      // whole catalogue, current and future.
      verified: false,
    });
    await knex(MetaTable.MANAGED_APPS)
      .where('fk_workspace_id', workspaceId)
      .update({ fk_publisher_id: id });

    const authors: string[] = (
      await knex(MetaTable.MANAGED_APPS)
        .distinct('created_by')
        .where('fk_workspace_id', workspaceId)
        .whereNotNull('created_by')
    ).map((r: any) => r.created_by);

    for (const userId of authors) {
      await knex(MetaTable.MARKETPLACE_PUBLISHER_MEMBERS).insert({
        fk_publisher_id: id,
        fk_user_id: userId,
        role: 'owner',
      });
    }
  }
};

// Backfill 5: a readable address for every listing that has been listed.
// Unlisted rows get none — a slug is minted when a listing is listed, and one
// handed out here would burn the name a publisher has not chosen yet.
export const backfillListingSlugs = async (knex: Knex) => {
  const listings = await knex(MetaTable.MANAGED_APPS)
    .whereNotNull('published_at')
    .where((qb) => qb.where('deleted', false).orWhereNull('deleted'))
    .orderBy('id', 'asc')
    .select('id', 'title');

  const taken = new Set<string>();
  for (const listing of listings) {
    let slug = slugify(listing.title);
    // `-${id}` is unique by construction, which is what keeps a unique
    // violation from wedging this on MySQL, where the DDL has auto-committed.
    if (!slug || RESERVED_HANDLES.has(slug) || taken.has(slug)) {
      slug = `${slug || 'app'}-${listing.id}`.slice(0, 64);
    }
    taken.add(slug);

    await knex(MetaTable.MANAGED_APPS).where('id', listing.id).update({ slug });
  }
};

// Backfill 3: comma string -> rows, dropping anything that is not a
// real ManagedAppCategory key.
export const backfillCategories = async (knex: Knex) => {
  const validCategories = new Set<string>(Object.values(ManagedAppCategory));
  const listings = await knex(MetaTable.MANAGED_APPS).select('id', 'category');
  for (const listing of listings) {
    const categories = String(listing.category || '')
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c && validCategories.has(c));
    for (const category of new Set(categories)) {
      await knex(MetaTable.MARKETPLACE_LISTING_CATEGORIES).insert({
        fk_managed_app_id: listing.id,
        category,
      });
    }
  }
};

// Backfill 4: release facts from the newest published version, and
// first_published_at from the earliest.
export const backfillReleaseFacts = async (knex: Knex) => {
  const listings = await knex(MetaTable.MANAGED_APPS).select('id');
  for (const listing of listings) {
    const newest = await knex(MetaTable.MANAGED_APP_VERSIONS)
      .where('fk_managed_app_id', listing.id)
      .whereNotNull('published_at')
      // version_number tiebreaks published_at ties — practically unreachable,
      // free to harden in a one-shot backfill.
      .orderBy([
        { column: 'published_at', order: 'desc' },
        { column: 'version_number', order: 'desc' },
      ])
      .first();
    const earliest = await knex(MetaTable.MANAGED_APP_VERSIONS)
      .where('fk_managed_app_id', listing.id)
      .whereNotNull('published_at')
      .orderBy([
        { column: 'published_at', order: 'asc' },
        { column: 'version_number', order: 'asc' },
      ])
      .first();
    if (!newest) continue;
    await knex(MetaTable.MANAGED_APPS)
      .where('id', listing.id)
      .update({
        last_release_at: newest.published_at,
        latest_version_id: newest.id,
        latest_version: newest.version,
        first_published_at: earliest?.published_at ?? newest.published_at,
      });
  }
  // Counters and has_agents stay at their defaults: no snapshot is parsed here.
  // A pre-migration version's manifest is NULL and renders as "published
  // before this was disclosed" (spec §5.5).
};

// Backfill 5: the publisher prefix baked into every stored snapshot's
// `table_name` values. Install/update replay those names verbatim, so without
// it an installed base in a shared namespace (Base.prefix set) points at the
// PUBLISHER's physical tables. Recoverable only while the publisher's base
// still exists; a version whose base is gone stays NULL and is refused at
// install rather than binding to whatever already answers to that name.
export const backfillVersionSourcePrefix = async (knex: Knex) => {
  const listings = await knex(MetaTable.MANAGED_APPS).select('id', 'base_id');
  for (const listing of listings) {
    if (!listing.base_id) continue;
    const base = await knex(MetaTable.PROJECT)
      .where('id', listing.base_id)
      .first();
    if (!base) continue;
    await knex(MetaTable.MANAGED_APP_VERSIONS)
      .where('fk_managed_app_id', listing.id)
      // '' is a real answer, not a missing one: a base created under pg data
      // reflection owns a schema and needs no prefix at all.
      .update({ source_prefix: base.prefix ?? '' });
  }
};

// Backfill 6: the visibility remap. ONE CASE statement, never two
// UPDATEs: running `unlisted -> private` first would let the following
// `private -> internal` sweep catch those same rows, landing owner-only
// listings in org-wide visibility — the exact exposure this prevents.
// Returns the un-awaited builder so a caller (up(), or a test) can narrow it
// with .whereIn(...) before executing.
export const remapVisibility = (knex: Knex) =>
  knex(MetaTable.MANAGED_APPS).update({
    visibility: knex.raw(
      // ELSE visibility, not a fixed value: an unrecognised value must never
      // be forced to the most-visible state.
      `CASE visibility
         WHEN ? THEN ?
         WHEN ? THEN ?
         ELSE visibility
       END`,
      [
        ManagedAppVisibility.PRIVATE,
        ManagedAppVisibility.INTERNAL,
        ManagedAppVisibility.UNLISTED,
        ManagedAppVisibility.PRIVATE,
      ],
    ),
  });

// down() step: comma string <- rows, the reverse of backfillCategories.
// Grouped read, not exported by up(), because up() never groups the other
// direction — this is down()-only.
export const restoreCategories = async (knex: Knex) => {
  const rows = await knex(MetaTable.MARKETPLACE_LISTING_CATEGORIES).select(
    'fk_managed_app_id',
    'category',
  );
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const list = grouped.get(row.fk_managed_app_id) ?? [];
    list.push(row.category);
    grouped.set(row.fk_managed_app_id, list);
  }
  for (const [listingId, categories] of grouped) {
    await knex(MetaTable.MANAGED_APPS)
      .where('id', listingId)
      .update({ category: categories.join(',') });
  }
};

const up = async (knex: Knex) => {
  // Store listing v2 + storefront, as one alter. `verified` is absent on
  // purpose: the packaged-teams step added it as per-app curation and the
  // storefront step replaced it with the publisher badge, so the schema this
  // branch ships never has it.
  await knex.schema.alterTable(MetaTable.MANAGED_APPS, (table) => {
    // Short plain-text card copy, distinct from the rich description rendered
    // on the detail page.
    table.string('tagline', 140);
    // Stamped from the publisher workspace's org at create time — it scopes the
    // 'org' visibility.
    table.string('fk_org_id', 20);
    table.string('fk_publisher_id', 20).index();
    // The listing's readable address, minted from the title when it is first
    // listed and never mutated after — a rename must not break a pasted link.
    // Nullable because a listing has none until it is listed, and unique because
    // it resolves a URL. The id resolves at the same position, so a stale slug
    // is a cosmetic mismatch rather than a 404.
    table.string('slug', 64).unique();
    table.text('cover');
    table.text('screenshots');
    table.boolean('delisted').defaultTo(false).index();
    table.timestamp('first_published_at').index();
    table.timestamp('last_release_at').index();
    table.string('latest_version_id', 20);
    table.string('latest_version', 32);
    table.boolean('has_agents').defaultTo(false).index();
    table.integer('table_count').defaultTo(0);
    table.integer('action_count').defaultTo(0);
    table.integer('automation_count').defaultTo(0);
    table.integer('ai_field_count').defaultTo(0);
    // What an install hands the person who installed it. The publisher decides,
    // because only they know which their app is: a finished product whose
    // tables are an implementation detail, or a starting point meant to be
    // taken apart. `app` is the default and the narrower of the two on purpose
    // — a row that never said which surface it wanted must not be read as
    // consent to hand over the base.
    table.string('install_surface', 20).defaultTo('app');
    // The kill switch, and not the same thing as delisting. Delisting stops
    // distribution, but nothing on the agent, workflow or action execution path
    // ever read the listing — so a malicious app kept running against its
    // installers' data after its page was gone. Suspension is read on the
    // execution path instead. Nullable with no default: absence is the healthy
    // state, so every existing row is already correct.
    table.dateTime('suspended_at');
    table.string('suspended_reason', 255);
    table.index(['fk_org_id'], 'nc_managed_apps_org_idx');
  });

  await knex.schema.alterTable(MetaTable.MANAGED_APP_VERSIONS, (table) => {
    // A release snapshot is a package format: its table set is whatever the
    // publishing server serialized. Stamping the format at publish is the only
    // point at which it can be known — it cannot be inferred later.
    table.integer('schema_format').notNullable().defaultTo(1);
    table.text('capability_manifest');
    table.text('rebind_manifest');
    // Matches nc_bases_v2.prefix (varchar 255). Nullable on purpose: NULL means
    // "unknowable", which install must refuse, not treat as ''.
    table.string('source_prefix', 255);
    // Suspension lives on the version as well as the app so one bad release can
    // be stopped without stopping the publisher.
    table.dateTime('suspended_at');
    table.string('suspended_reason', 255);
    // The fan-out brake. A release that fails its canary ring is marked here so
    // the remaining installs stay on their current version and a later
    // re-trigger does not quietly resume the same bad rollout.
    table.dateTime('rollout_halted_at');
    table.string('rollout_halt_reason', 255);
  });

  // The installed base carries its own copy of the surface rather than reading
  // the listing, because the surface is decided at install: a publisher who
  // later opens their app up must not silently open every instance already
  // running, and one who closes it must not reach into a running install and
  // take away what its owner already has.
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.string('managed_app_surface', 20);
  });

  // Publisher-side link: which workspace teams ship with a managed app.
  await knex.schema.createTable(MetaTable.MANAGED_APP_TEAMS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('fk_managed_app_id', 20).notNullable();
    table.string('fk_team_id', 20).notNullable();
    // Stable slug identifying the team across versions/installs — remap key,
    // never displayed.
    table.string('handle', 64).notNullable();
    // Base role granted to the instantiated team on the installed base.
    table.string('base_role', 50).notNullable().defaultTo('viewer');
    // What this team does in the app — shown to installers when staffing.
    table.text('duty');
    // Publisher opt-out: the team stays assigned to the base but doesn't ship.
    table.boolean('excluded').defaultTo(false);
    table.float('order');
    table.timestamps(true, true);

    table.unique(['fk_managed_app_id', 'handle'], {
      indexName: 'nc_managed_app_teams_handle_idx',
    });
    table.unique(['fk_managed_app_id', 'fk_team_id'], {
      indexName: 'nc_managed_app_teams_team_idx',
    });
    table.index(['fk_workspace_id'], 'nc_managed_app_teams_workspace_idx');
  });

  // Install-side provenance on teams instantiated from a packaged app:
  // (fk_origin_base_id, origin_handle) is the remap/reconciliation key —
  // titles stay display-only and are free to clash or be renamed.
  await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
    table.string('origin_handle', 64);
    table.string('fk_origin_base_id', 20);
    table.index(['fk_origin_base_id'], 'nc_teams_origin_base_idx');
  });

  // Uninstall has no target version, so to_version_id is genuinely absent — not
  // invented.
  await knex.schema.alterTable(
    MetaTable.MANAGED_APP_DEPLOYMENT_LOGS,
    (table) => {
      table.string('to_version_id', 20).nullable().alter();
    },
  );

  await knex.schema.createTable(MetaTable.MARKETPLACE_PUBLISHERS, (table) => {
    table.string('id', 20).primary();
    // No workspace and no org: the store sits above both, so a publisher is
    // its own entity addressed by `handle`. Who may edit it is
    // `nc_marketplace_publisher_members`; what it ships is
    // `nc_managed_apps.fk_publisher_id`.
    table.string('handle', 64).notNullable().unique();
    table.string('name', 120).notNullable();
    table.string('bio', 280);
    table.string('website', 255);
    table.text('logo');
    table.string('accent', 9);
    table.boolean('verified').defaultTo(false);
    table.boolean('delisted').defaultTo(false);
    table.boolean('deleted').defaultTo(false);
    table.timestamps(true, true);
  });

  // People, not workspaces: a publisher outlives any one workspace, and the
  // page says who runs it rather than where it is filed. `owner` is minted with
  // the publisher and is the only role that may hand the identity on.
  await knex.schema.createTable(
    MetaTable.MARKETPLACE_PUBLISHER_MEMBERS,
    (table) => {
      table.string('fk_publisher_id', 20).notNullable();
      table.string('fk_user_id', 20).notNullable();
      table.string('role', 16).notNullable().defaultTo('member');
      table.timestamps(true, true);
      table.primary(['fk_publisher_id', 'fk_user_id']);
      // "which publishers am I in" is the read every publish makes.
      table.index('fk_user_id');
    },
  );

  await knex.schema.createTable(
    MetaTable.MARKETPLACE_LISTING_CATEGORIES,
    (table) => {
      table.string('fk_managed_app_id', 20).notNullable();
      table.string('category', 32).notNullable();
      table.primary(['fk_managed_app_id', 'category']);
      table.index('category');
    },
  );

  await knex.schema.createTable(MetaTable.MARKETPLACE_CURATIONS, (table) => {
    table.string('id', 20).primary();
    table.string('slot', 32).notNullable();
    table.string('fk_managed_app_id', 20).notNullable();
    table.float('order');
    table.timestamp('starts_at');
    table.timestamp('ends_at');
    table.timestamps(true, true);
    // No separate .index('slot'): it would duplicate the leading column of
    // this unique constraint.
    table.unique(['slot', 'fk_managed_app_id']);
  });

  await knex.schema.createTable(MetaTable.MARKETPLACE_REPORTS, (table) => {
    table.string('id', 20).primary();
    // No .index() here: it would duplicate the leading column of the unique
    // constraint below.
    table.string('fk_managed_app_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable();
    table.string('reason', 32).notNullable();
    table.string('detail', 1000);
    table.string('status', 16).defaultTo('open');
    table.timestamps(true, true);
    table.unique(['fk_managed_app_id', 'fk_user_id']);
  });

  await backfillPublishers(knex);
  await backfillListingSlugs(knex);
  await backfillCategories(knex);
  await backfillReleaseFacts(knex);
  await backfillVersionSourcePrefix(knex);
  await remapVisibility(knex);

  // Only now drop the old column: every backfill above reads it.
  await knex.schema.alterTable(MetaTable.MANAGED_APPS, (table) => {
    table.dropColumn('category');
  });
};

// A down migration cannot restore a publisher's bio, logo, accent or handle —
// those are new information with no pre-migration source.
const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MANAGED_APPS, (table) => {
    table.string('category', 255);
    // Restores the pre-migration index dropped along with the column
    // (nc_014_sandboxes.ts), so a down/up cycle doesn't silently lose it.
    table.index(['category'], 'nc_sandboxes_category_idx');
  });

  await restoreCategories(knex);

  await knex(MetaTable.MANAGED_APPS).update({
    visibility: knex.raw(
      // ELSE visibility, not a fixed value: a new-UNLISTED (link-share) row
      // must round-trip to the literal string 'unlisted', whose pre-migration
      // meaning was owner-only — a narrowing. `ELSE public` would instead
      // make an unconsented link-share listing world-visible on rollback.
      `CASE visibility
         WHEN ? THEN ?
         WHEN ? THEN ?
         ELSE visibility
       END`,
      [
        ManagedAppVisibility.INTERNAL,
        ManagedAppVisibility.PRIVATE,
        ManagedAppVisibility.PRIVATE,
        ManagedAppVisibility.UNLISTED,
      ],
    ),
  });

  await knex.schema.dropTable(MetaTable.MARKETPLACE_REPORTS);
  await knex.schema.dropTable(MetaTable.MARKETPLACE_CURATIONS);
  await knex.schema.dropTable(MetaTable.MARKETPLACE_LISTING_CATEGORIES);
  await knex.schema.dropTable(MetaTable.MARKETPLACE_PUBLISHER_MEMBERS);
  await knex.schema.dropTable(MetaTable.MARKETPLACE_PUBLISHERS);

  await knex.schema.alterTable(
    MetaTable.MANAGED_APP_DEPLOYMENT_LOGS,
    (table) => {
      table.string('to_version_id', 20).notNullable().alter();
    },
  );

  await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
    table.dropIndex(['fk_origin_base_id'], 'nc_teams_origin_base_idx');
    table.dropColumn('fk_origin_base_id');
    table.dropColumn('origin_handle');
  });

  await knex.schema.dropTable(MetaTable.MANAGED_APP_TEAMS);

  await knex.schema.alterTable(MetaTable.MANAGED_APP_VERSIONS, (table) => {
    table.dropColumn('rollout_halt_reason');
    table.dropColumn('rollout_halted_at');
    table.dropColumn('suspended_reason');
    table.dropColumn('suspended_at');
    table.dropColumn('source_prefix');
    table.dropColumn('rebind_manifest');
    table.dropColumn('capability_manifest');
    table.dropColumn('schema_format');
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropColumn('managed_app_surface');
  });

  await knex.schema.alterTable(MetaTable.MANAGED_APPS, (table) => {
    table.dropIndex(['fk_org_id'], 'nc_managed_apps_org_idx');
    table.dropColumn('suspended_reason');
    table.dropColumn('suspended_at');
    table.dropColumn('install_surface');
    table.dropColumn('ai_field_count');
    table.dropColumn('automation_count');
    table.dropColumn('action_count');
    table.dropColumn('table_count');
    table.dropColumn('has_agents');
    table.dropColumn('latest_version');
    table.dropColumn('latest_version_id');
    table.dropColumn('last_release_at');
    table.dropColumn('first_published_at');
    table.dropColumn('delisted');
    table.dropColumn('screenshots');
    table.dropColumn('cover');
    table.dropColumn('slug');
    table.dropColumn('fk_publisher_id');
    table.dropColumn('fk_org_id');
    table.dropColumn('tagline');
  });
};

export { up, down };
