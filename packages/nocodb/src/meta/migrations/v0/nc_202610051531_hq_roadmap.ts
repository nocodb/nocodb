import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const CATEGORY_GROUP_ID = 'rmlcategory';

const CATEGORY_LABELS = [
  ['rmlcatdata', 'Data', 'blue'],
  ['rmlcatworkflows', 'Workflows', 'purple'],
  ['rmlcatinterfaces', 'Interfaces', 'pink'],
  ['rmlcatapps', 'Apps', 'orange'],
  ['rmlcatfactory', 'Factory', 'green'],
  ['rmlcatintegrations', 'Integrations', 'yellow'],
];

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.HQ_ROADMAP_ITEMS, (table) => {
    table.string('id', 20).primary();
    table.integer('number').notNullable();
    table.string('title', 160).notNullable();
    table.text('description');
    table.string('status', 16).notNullable();
    table.string('visibility', 8).notNullable().defaultTo('public');
    table.smallint('priority').notNullable().defaultTo(0);
    table.double('estimate');
    table.string('fk_assignee_id', 20);
    table.date('target_date');
    table.string('target_date_resolution', 12);
    // Double, not `float` (pg `real`): board drags bisect the gap between neighbours.
    table.double('sort_order').notNullable().defaultTo(0);
    table.integer('vote_count').notNullable().defaultTo(0);
    table.integer('vote_adjustment').notNullable().defaultTo(0);
    table.integer('comment_count').notNullable().defaultTo(0);
    table.text('attachments');
    table.text('meta');
    table.string('fk_user_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.boolean('is_staff').notNullable().defaultTo(false);
    table.string('duplicate_of_id', 20);
    table.text('close_reason');
    table.dateTime('approved_at');
    table.string('fk_approved_by', 20);
    table.dateTime('triaged_at');
    table.dateTime('published_at');
    table.dateTime('started_at');
    table.dateTime('completed_at');
    table.dateTime('canceled_at');
    table.dateTime('status_changed_at');
    table.bigInteger('impact_mrr_cents').notNullable().defaultTo(0);
    table.integer('impact_accounts').notNullable().defaultTo(0);
    table.string('impact_submitter_plan', 255);
    table.dateTime('impact_computed_at');
    table.dateTime('deleted_at');
    table.timestamps(true, true);

    table.unique(['number'], { indexName: 'nc_hq_rm_items_number_uq' });
    table.index(
      ['status', 'visibility', 'published_at'],
      'nc_hq_rm_items_status_vis_idx',
    );
    table.index(['status', 'sort_order'], 'nc_hq_rm_items_status_sort_idx');
    table.index(['fk_assignee_id', 'status'], 'nc_hq_rm_items_assignee_idx');
    table.index(['fk_user_id', 'created_at'], 'nc_hq_rm_items_user_idx');
    table.index(['fk_workspace_id'], 'nc_hq_rm_items_workspace_idx');
    table.index(['duplicate_of_id'], 'nc_hq_rm_items_duplicate_idx');
  });

  // Match the list sorts exactly; the roadmap only runs on cloud, whose meta db is pg.
  if (['pg', 'postgresql'].includes(knex.client.config.client)) {
    const items = MetaTable.HQ_ROADMAP_ITEMS;
    await knex.raw(
      'CREATE INDEX ?? ON ?? ((?? + ??) DESC, (coalesce(??, ??)) DESC, ??)',
      [
        'nc_hq_rm_items_top_idx',
        items,
        'vote_count',
        'vote_adjustment',
        'published_at',
        'created_at',
        'id',
      ],
    );
    await knex.raw('CREATE INDEX ?? ON ?? ((coalesce(??, ??)) DESC, ??)', [
      'nc_hq_rm_items_new_idx',
      items,
      'published_at',
      'created_at',
      'id',
    ]);
    await knex.raw('CREATE INDEX ?? ON ?? (?? DESC, ??)', [
      'nc_hq_rm_items_revenue_idx',
      items,
      'impact_mrr_cents',
      'id',
    ]);
  }

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_LABELS, (table) => {
    table.string('id', 20).primary();
    table.string('title', 64).notNullable();
    table.string('description', 255);
    table.string('color', 32);
    table.string('fk_group_id', 20);
    table.boolean('is_group').notNullable().defaultTo(false);
    table.string('group_type', 16);
    table.boolean('is_public').notNullable().defaultTo(false);
    table.double('order').notNullable().defaultTo(0);
    table.dateTime('archived_at');
    table.timestamps(true, true);

    table.index(['fk_group_id'], 'nc_hq_rm_labels_group_idx');
  });

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_ITEM_LABELS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_item_id', 20).notNullable();
    table.string('fk_label_id', 20).notNullable();
    table.timestamps(true, true);

    table.unique(['fk_item_id', 'fk_label_id'], {
      indexName: 'nc_hq_rm_item_labels_uq',
    });
    table.index(['fk_label_id'], 'nc_hq_rm_item_labels_label_idx');
  });

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_VOTES, (table) => {
    table.string('id', 20).primary();
    table.string('fk_item_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.timestamps(true, true);

    table.unique(['fk_item_id', 'fk_user_id'], {
      indexName: 'nc_hq_rm_votes_uq',
    });
    table.index(['fk_item_id', 'created_at'], 'nc_hq_rm_votes_item_idx');
    table.index(['fk_user_id', 'created_at'], 'nc_hq_rm_votes_user_idx');
  });

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_SUBSCRIBERS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_item_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable();
    table.string('reason', 16).notNullable();
    table.boolean('muted').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.unique(['fk_item_id', 'fk_user_id'], {
      indexName: 'nc_hq_rm_subscribers_uq',
    });
    table.index(['fk_user_id'], 'nc_hq_rm_subscribers_user_idx');
  });

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_COMMENTS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_item_id', 20).notNullable();
    table.string('fk_parent_id', 20);
    table.string('fk_user_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.text('body').notNullable();
    table.text('attachments');
    table.boolean('is_internal').notNullable().defaultTo(false);
    table.boolean('is_staff').notNullable().defaultTo(false);
    table.boolean('pinned').notNullable().defaultTo(false);
    table.dateTime('hidden_at');
    table.string('fk_hidden_by', 20);
    table.integer('like_count').notNullable().defaultTo(0);
    table.dateTime('edited_at');
    table.dateTime('deleted_at');
    table.timestamps(true, true);

    table.index(
      ['fk_item_id', 'is_internal', 'created_at'],
      'nc_hq_rm_comments_item_idx',
    );
    table.index(['fk_parent_id'], 'nc_hq_rm_comments_parent_idx');
    table.index(['fk_user_id', 'created_at'], 'nc_hq_rm_comments_user_idx');
  });

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_COMMENT_LIKES, (table) => {
    table.string('id', 20).primary();
    table.string('fk_comment_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable();
    table.timestamps(true, true);

    table.unique(['fk_comment_id', 'fk_user_id'], {
      indexName: 'nc_hq_rm_comment_likes_uq',
    });
    table.index(['fk_user_id'], 'nc_hq_rm_comment_likes_user_idx');
  });

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_PROFILES, (table) => {
    table.string('id', 20).primary();
    table.string('fk_user_id', 20).notNullable();
    table.string('handle', 48).notNullable();
    table.boolean('email_opt_out').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.unique(['fk_user_id'], { indexName: 'nc_hq_rm_profiles_user_uq' });
    table.unique(['handle'], { indexName: 'nc_hq_rm_profiles_handle_uq' });
  });

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_ACTIVITY, (table) => {
    table.string('id', 20).primary();
    table.string('fk_item_id', 20).notNullable();
    table.string('fk_user_id', 20);
    table.string('type', 32).notNullable();
    table.text('details');
    table.timestamps(true, true);

    table.index(['fk_item_id', 'created_at'], 'nc_hq_rm_activity_item_idx');
  });

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_IMPACT, (table) => {
    table.string('id', 20).primary();
    table.string('fk_item_id', 20).notNullable();
    table.string('scope_type', 16).notNullable();
    table.string('scope_id', 20).notNullable();
    table.string('scope_title', 255);
    // As wide as `nc_plans.title`: custom plan names run long.
    table.string('plan_title', 255);
    table.bigInteger('mrr_cents').notNullable().defaultTo(0);
    table.integer('voter_count').notNullable().defaultTo(0);
    table.dateTime('computed_at');
    table.timestamps(true, true);

    table.unique(['fk_item_id', 'scope_id'], {
      indexName: 'nc_hq_rm_impact_uq',
    });
    table.index(['fk_item_id', 'mrr_cents'], 'nc_hq_rm_impact_item_idx');
    table.index(['plan_title'], 'nc_hq_rm_impact_plan_idx');
  });

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_RELATIONS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_item_id', 20).notNullable();
    table.string('fk_related_item_id', 20).notNullable();
    table.string('type', 16).notNullable();
    table.string('fk_created_by', 20);
    table.timestamps(true, true);

    table.unique(['fk_item_id', 'fk_related_item_id', 'type'], {
      indexName: 'nc_hq_rm_relations_uq',
    });
    table.index(['fk_related_item_id'], 'nc_hq_rm_relations_related_idx');
  });

  await knex.schema.createTable(MetaTable.HQ_ROADMAP_LINKS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_item_id', 20).notNullable();
    table.text('url').notNullable();
    table.string('title', 255);
    table.string('source', 32).notNullable();
    table.text('meta');
    table.string('fk_created_by', 20);
    table.timestamps(true, true);

    table.index(['fk_item_id'], 'nc_hq_rm_links_item_idx');
  });

  await knex(MetaTable.HQ_ROADMAP_LABELS).insert([
    {
      id: CATEGORY_GROUP_ID,
      title: 'Category',
      color: null,
      fk_group_id: null,
      is_group: true,
      group_type: 'single',
      is_public: true,
      order: 1,
    },
    ...CATEGORY_LABELS.map(([id, title, color], index) => ({
      id,
      title,
      color,
      fk_group_id: CATEGORY_GROUP_ID,
      is_group: false,
      group_type: null,
      is_public: false,
      order: index + 1,
    })),
  ]);
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_LINKS);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_RELATIONS);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_IMPACT);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_ACTIVITY);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_PROFILES);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_COMMENT_LIKES);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_COMMENTS);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_SUBSCRIBERS);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_VOTES);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_ITEM_LABELS);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_LABELS);
  await knex.schema.dropTableIfExists(MetaTable.HQ_ROADMAP_ITEMS);
};

export { up, down };
