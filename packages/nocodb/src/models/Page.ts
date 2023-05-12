import Noco from '../Noco';
import { MetaTable } from '../utils/globals';
import Project from './Project';

const { v4: uuidv4 } = require('uuid');

// todo: Remove this as Page DAO exists. Exists due to dependent logic in Workspace model
export default class Page {
  public id: string;
  public title: string;
  public description: string;
  public content: string;
  public slug: string;
  public parent_page_id: string;
  public order: number;

  constructor(attr: Partial<Page>) {
    Object.assign(this, attr);
  }

  public static async tableName({
    projectId,
    workspaceId,
  }: {
    projectId: string;
    workspaceId?: string;
  }) {
    const prefix = 'nc_d_page_';
    if (workspaceId) return `${prefix}${workspaceId}`;

    const project = await Project.get(projectId);
    return `${prefix}${project.fk_workspace_id}`;
  }

  static async createPageTable(
    { projectId, workspaceId }: { projectId: string; workspaceId?: string },
    ncMeta = Noco.ncMeta,
  ) {
    const knex = ncMeta.knex;
    const pageTableName = await Page.tableName({ projectId, workspaceId });

    await knex.schema.createTable(pageTableName, (table) => {
      table.string('id', 20).primary().notNullable();

      table.string('project_id', 20).notNullable();
      table
        .foreign('project_id')
        .references(`${MetaTable.PROJECT}.id`)
        .withKeyName(`nc_page_fk_project_id_${uuidv4()}`);

      table.string('title', 150).notNullable();
      table.string('published_title', 150);
      table.text('description', 'longtext').defaultTo('');

      table.text('content', 'longtext').defaultTo('');
      table.text('published_content', 'longtext').defaultTo('');
      table.string('slug', 150).notNullable();

      table.boolean('is_parent').defaultTo(false);
      table.string('parent_page_id', 20).nullable();
      table
        .foreign('parent_page_id')
        .references(`${pageTableName}.id`)
        .withKeyName(`nc_page_parent_${uuidv4()}`);

      table.boolean('is_published').defaultTo(false);
      table.datetime('last_published_date').nullable();
      table.string('last_published_by_id', 20).nullable();
      table
        .foreign('last_published_by_id')
        .references(`${MetaTable.USERS}.id`)
        .withKeyName(`nc_page_last_published_id_${uuidv4()}`);

      table.string('nested_published_parent_id', 20).nullable();
      table
        .foreign('nested_published_parent_id')
        .references(`${pageTableName}.id`)
        .withKeyName(`nc_p_nest_publish_parent_id_${uuidv4()}`);

      table.string('last_updated_by_id', 20).nullable();
      table
        .foreign('last_updated_by_id')
        .references(`${MetaTable.USERS}.id`)
        .withKeyName(`nc_page_last_updated_id_${uuidv4()}`);

      table.string('created_by_id', 20).notNullable();
      table
        .foreign('created_by_id')
        .references(`${MetaTable.USERS}.id`)
        .withKeyName(`nc_page_last_created_id_${uuidv4()}`);

      table.timestamp('archived_date').nullable();
      table.string('archived_by_id', 20).nullable();
      table
        .foreign('archived_by_id')
        .references(`${MetaTable.USERS}.id`)
        .withKeyName(`nc_page_last_archived_id_${uuidv4()}`);

      table.text('metaJson', 'longtext').defaultTo('{}');

      table.float('order');

      table.string('icon');

      table.datetime('created_at', { useTz: true });
      table.datetime('updated_at', { useTz: true });

      table.timestamp('last_snapshot_at').nullable();
      table.string('last_snapshot_id').nullable();
      table.text('content_html', 'longtext').defaultTo('');
    });
  }
}
