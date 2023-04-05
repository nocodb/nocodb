import { Global, Injectable } from '@nestjs/common'
import XcMigrationSource from './migrations/XcMigrationSource'
import XcMigrationSourcev2 from './migrations/XcMigrationSourcev2'
import { Connection } from '../connection/connection';
import { customAlphabet } from 'nanoid';

// todo: move
export enum MetaTable {
  PROJECT = 'nc_projects_v2',
  BASES = 'nc_bases_v2',
  MODELS = 'nc_models_v2',
  COLUMNS = 'nc_columns_v2',
  COLUMN_VALIDATIONS = 'nc_columns_validations_v2',
  COL_PROPS = 'nc_col_props_v2',
  COL_RELATIONS = 'nc_col_relations_v2',
  COL_SELECT_OPTIONS = 'nc_col_select_options_v2',
  COL_LOOKUP = 'nc_col_lookup_v2',
  COL_ROLLUP = 'nc_col_rollup_v2',
  COL_FORMULA = 'nc_col_formula_v2',
  COL_QRCODE = 'nc_col_qrcode_v2',
  COL_BARCODE = 'nc_col_barcode_v2',
  FILTER_EXP = 'nc_filter_exp_v2',
  // HOOK_FILTER_EXP = 'nc_hook_filter_exp_v2',
  SORT = 'nc_sort_v2',
  SHARED_VIEWS = 'nc_shared_views_v2',
  ACL = 'nc_acl_v2',
  FORM_VIEW = 'nc_form_view_v2',
  FORM_VIEW_COLUMNS = 'nc_form_view_columns_v2',
  GALLERY_VIEW = 'nc_gallery_view_v2',
  GALLERY_VIEW_COLUMNS = 'nc_gallery_view_columns_v2',
  GRID_VIEW = 'nc_grid_view_v2',
  GRID_VIEW_COLUMNS = 'nc_grid_view_columns_v2',
  KANBAN_VIEW = 'nc_kanban_view_v2',
  KANBAN_VIEW_COLUMNS = 'nc_kanban_view_columns_v2',
  USERS = 'nc_users_v2',
  ORGS = 'nc_orgs_v2',
  TEAMS = 'nc_teams_v2',
  TEAM_USERS = 'nc_team_users_v2',
  VIEWS = 'nc_views_v2',
  AUDIT = 'nc_audit_v2',
  HOOKS = 'nc_hooks_v2',
  HOOK_LOGS = 'nc_hook_logs_v2',
  PLUGIN = 'nc_plugins_v2',
  PROJECT_USERS = 'nc_project_users_v2',
  MODEL_ROLE_VISIBILITY = 'nc_disabled_models_for_role_v2',
  API_TOKENS = 'nc_api_tokens',
  SYNC_SOURCE = 'nc_sync_source_v2',
  SYNC_LOGS = 'nc_sync_logs_v2',
  MAP_VIEW = 'nc_map_view_v2',
  MAP_VIEW_COLUMNS = 'nc_map_view_columns_v2',
  STORE = 'nc_store',
}


export const orderedMetaTables = [
  MetaTable.MODEL_ROLE_VISIBILITY,
  MetaTable.PLUGIN,
  MetaTable.AUDIT,
  MetaTable.TEAM_USERS,
  MetaTable.TEAMS,
  MetaTable.ORGS,
  MetaTable.PROJECT_USERS,
  MetaTable.USERS,
  MetaTable.MAP_VIEW,
  MetaTable.MAP_VIEW_COLUMNS,
  MetaTable.KANBAN_VIEW_COLUMNS,
  MetaTable.KANBAN_VIEW,
  MetaTable.GRID_VIEW_COLUMNS,
  MetaTable.GRID_VIEW,
  MetaTable.GALLERY_VIEW_COLUMNS,
  MetaTable.GALLERY_VIEW,
  MetaTable.FORM_VIEW_COLUMNS,
  MetaTable.FORM_VIEW,
  MetaTable.SHARED_VIEWS,
  MetaTable.SORT,
  MetaTable.FILTER_EXP,
  MetaTable.HOOK_LOGS,
  MetaTable.HOOKS,
  MetaTable.VIEWS,
  MetaTable.COL_FORMULA,
  MetaTable.COL_ROLLUP,
  MetaTable.COL_LOOKUP,
  MetaTable.COL_SELECT_OPTIONS,
  MetaTable.COL_RELATIONS,
  MetaTable.COLUMN_VALIDATIONS,
  MetaTable.COLUMNS,
  MetaTable.MODELS,
  MetaTable.BASES,
  MetaTable.PROJECT,
];

export const sakilaTableNames = [
  'actor',
  'address',
  'category',
  'city',
  'country',
  'customer',
  'film',
  'film_actor',
  'film_category',
  'film_text',
  'inventory',
  'language',
  'payment',
  'rental',
  'staff',
  'store',
  'actor_info',
  'customer_list',
  'film_list',
  'nicer_but_slower_film_list',
  'sales_by_film_category',
  'sales_by_store',
  'staff_list',
];

export enum CacheScope {
  PROJECT = 'project',
  BASE = 'base',
  MODEL = 'model',
  COLUMN = 'column',
  COL_PROP = 'colProp',
  COL_RELATION = 'colRelation',
  COL_SELECT_OPTION = 'colSelectOption',
  COL_LOOKUP = 'colLookup',
  COL_ROLLUP = 'colRollup',
  COL_FORMULA = 'colFormula',
  COL_QRCODE = 'colQRCode',
  COL_BARCODE = 'colBarcode',
  FILTER_EXP = 'filterExp',
  SORT = 'sort',
  SHARED_VIEW = 'sharedView',
  ACL = 'acl',
  FORM_VIEW = 'formView',
  FORM_VIEW_COLUMN = 'formViewColumn',
  GALLERY_VIEW = 'galleryView',
  GALLERY_VIEW_COLUMN = 'galleryViewColumn',
  GRID_VIEW = 'gridView',
  GRID_VIEW_COLUMN = 'gridViewColumn',
  KANBAN_VIEW = 'kanbanView',
  MAP_VIEW = 'mapView',
  MAP_VIEW_COLUMN = 'mapViewColumn',
  KANBAN_VIEW_COLUMN = 'kanbanViewColumn',
  USER = 'user',
  ORGS = 'orgs',
  TEAM = 'team',
  TEAM_USER = 'teamUser',
  VIEW = 'view',
  AUDIT = 'audit',
  HOOK = 'hook',
  PLUGIN = 'plugin',
  PROJECT_USER = 'projectUser',
  MODEL_ROLE_VISIBILITY = 'modelRoleVisibility',
  API_TOKEN = 'apiToken',
  INSTANCE_META = 'instanceMeta',
  USER_PROJECT = 'userProject',
}
export enum CacheGetType {
  TYPE_ARRAY = 'TYPE_ARRAY',
  TYPE_OBJECT = 'TYPE_OBJECT',
  TYPE_STRING = 'TYPE_STRING',
}

export enum CacheDelDirection {
  PARENT_TO_CHILD = 'PARENT_TO_CHILD',
  CHILD_TO_PARENT = 'CHILD_TO_PARENT',
}

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

@Global()
@Injectable()
export class MetaService {

  constructor(private connection: Connection) {
  }


  public async metaInit(): Promise<boolean> {
    await this.connection.knexInstance.migrate.latest({
      migrationSource: new XcMigrationSource(),
      tableName: 'xc_knex_migrations',
    });
    await this.connection.knexInstance.migrate.latest({
      migrationSource: new XcMigrationSourcev2(),
      tableName: 'xc_knex_migrationsv2',
    });
    return true;
  }

  get knexConnection() {
    return this.connection.knexInstance;
  }

  public async metaGet(
    project_id: string,
    dbAlias: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    fields?: string[],
    // xcCondition?
  ): Promise<any> {
    const query = this.connection.knexInstance(target);

    // if (xcCondition) {
    //   query.condition(xcCondition);
    // }

    if (fields?.length) {
      query.select(...fields);
    }

    if (project_id !== null && project_id !== undefined) {
      query.where('project_id', project_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }

    if (!idOrCondition) {
      return query.first();
    }

    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else {
      query.where(idOrCondition);
    }

    // console.log(query.toQuery())

    return query.first();
  }

  public async metaInsert2(
    project_id: string,
    base_id: string,
    target: string,
    data: any,
    ignoreIdGeneration?: boolean
  ): Promise<any> {
    const id = data?.id || this.genNanoid(target);
    const insertObj = {
      ...data,
      ...(ignoreIdGeneration ? {} : { id }),
      created_at: data?.created_at || this.knexConnection?.fn?.now(),
      updated_at: data?.updated_at || this.knexConnection?.fn?.now(),
    };
    if (base_id !== null) insertObj.base_id = base_id;
    if (project_id !== null) insertObj.project_id = project_id;

    await this.knexConnection(target).insert(insertObj);
    return insertObj;
  }


  private genNanoid(target: string) {
    let prefix;
    switch (target) {
      case MetaTable.PROJECT:
        prefix = 'p_';
        break;
      case MetaTable.BASES:
        prefix = 'ds_';
        break;
      case MetaTable.MODELS:
        prefix = 'md_';
        break;
      case MetaTable.COLUMNS:
        prefix = 'cl_';
        break;
      case MetaTable.COL_RELATIONS:
        prefix = 'ln_';
        break;
      case MetaTable.COL_SELECT_OPTIONS:
        prefix = 'sl_';
        break;
      case MetaTable.COL_LOOKUP:
        prefix = 'lk_';
        break;
      case MetaTable.COL_ROLLUP:
        prefix = 'rl_';
        break;
      case MetaTable.COL_FORMULA:
        prefix = 'fm_';
        break;
      case MetaTable.FILTER_EXP:
        prefix = 'fi_';
        break;
      case MetaTable.SORT:
        prefix = 'so_';
        break;
      case MetaTable.SHARED_VIEWS:
        prefix = 'sv_';
        break;
      case MetaTable.ACL:
        prefix = 'ac_';
        break;
      case MetaTable.FORM_VIEW:
        prefix = 'fv_';
        break;
      case MetaTable.FORM_VIEW_COLUMNS:
        prefix = 'fvc_';
        break;
      case MetaTable.GALLERY_VIEW:
        prefix = 'gv_';
        break;
      case MetaTable.GALLERY_VIEW_COLUMNS:
        prefix = 'gvc_';
        break;
      case MetaTable.KANBAN_VIEW:
        prefix = 'kv_';
        break;
      case MetaTable.KANBAN_VIEW_COLUMNS:
        prefix = 'kvc_';
        break;
      case MetaTable.USERS:
        prefix = 'us_';
        break;
      case MetaTable.ORGS:
        prefix = 'org_';
        break;
      case MetaTable.TEAMS:
        prefix = 'tm_';
        break;
      case MetaTable.VIEWS:
        prefix = 'vw_';
        break;
      case MetaTable.HOOKS:
        prefix = 'hk_';
        break;
      case MetaTable.HOOK_LOGS:
        prefix = 'hkl_';
        break;
      case MetaTable.AUDIT:
        prefix = 'adt_';
        break;
      case MetaTable.API_TOKENS:
        prefix = 'tkn_';
        break;
      default:
        prefix = 'nc_';
        break;
    }

    return `${prefix}${nanoidv2()}`;
  }

}
