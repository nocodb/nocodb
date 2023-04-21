import {
  Global,
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { customAlphabet } from 'nanoid';
import CryptoJS from 'crypto-js';
import { Connection } from '../connection/connection';
import Noco from '../Noco';
import NocoCache from '../cache/NocoCache';
import XcMigrationSourcev2 from './migrations/XcMigrationSourcev2';
import XcMigrationSource from './migrations/XcMigrationSource';
import type { Knex } from 'knex';

dayjs.extend(utc);
dayjs.extend(timezone);

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

// todo: tobe fixed
const META_TABLES = [];

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

@Injectable()
export class MetaService {
  constructor(private metaConnection: Connection, @Optional() trx = null) {
    this.trx = trx;
  }

  public get connection() {
    return this.trx ?? this.metaConnection.knexInstance;
  }

  get knexConnection() {
    return this.connection;
  }

  public async metaGet(
    project_id: string,
    dbAlias: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    fields?: string[],
    // xcCondition?
  ): Promise<any> {
    const query = this.connection(target);

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
    ignoreIdGeneration?: boolean,
  ): Promise<any> {
    const id = data?.id || this.genNanoid(target);
    const insertObj = {
      ...data,
      ...(ignoreIdGeneration ? {} : { id }),
    };
    if (base_id !== null) insertObj.base_id = base_id;
    if (project_id !== null) insertObj.project_id = project_id;

    await this.knexConnection(target).insert({
      ...insertObj,
      created_at: this.now(),
      updated_at: this.now(),
    });
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

  //

  public async metaPaginatedList(
    projectId: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [key: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?;
      fields?: string[];
      sort?: { field: string; desc?: boolean };
    },
  ): Promise<{ list: any[]; count: number }> {
    const query = this.knexConnection(target);
    const countQuery = this.knexConnection(target);
    if (projectId !== null && projectId !== undefined) {
      query.where('project_id', projectId);
      countQuery.where('project_id', projectId);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
      countQuery.where('db_alias', dbAlias);
    }

    if (args?.condition) {
      query.where(args.condition);
      countQuery.where(args.condition);
    }
    if (args?.limit) {
      query.limit(args.limit);
    }
    if (args?.sort) {
      query.orderBy(args.sort.field, args.sort.desc ? 'desc' : 'asc');
    }
    if (args?.offset) {
      query.offset(args.offset);
    }
    if (args?.xcCondition) {
      (query as any)
        .condition(args.xcCondition)(countQuery as any)
        .condition(args.xcCondition);
    }

    if (args?.fields?.length) {
      query.select(...args.fields);
    }

    return {
      list: await query,
      count: Object.values(await countQuery.count().first())?.[0] as any,
    };
  }

  // private connection: XKnex;
  // todo: need to fix
  private trx: Knex.Transaction;

  // constructor(app: Noco, config: NcConfig, trx = null) {
  //   super(app, config);
  //
  //   if (this.config?.meta?.db) {
  //     this.connection = trx || XKnex(this.config?.meta?.db);
  //   } else {
  //     let dbIndex = this.config.envs?.[this.config.workingEnv]?.db.findIndex(
  //       (c) => c.meta.dbAlias === this.config?.auth?.jwt?.dbAlias
  //     );
  //     dbIndex = dbIndex === -1 ? 0 : dbIndex;
  //     this.connection = XKnex(
  //       this.config.envs?.[this.config.workingEnv]?.db[dbIndex] as any
  //     );
  //   }
  //   this.trx = trx;
  //   NcConnectionMgr.setXcMeta(this);
  // }

  // public get knexConnection(): XKnex {
  //   return (this.trx || this.connection) as any;
  // }

  // public updateKnex(connectionConfig): void {
  //   this.connection = XKnex(connectionConfig);
  // }

  // public async metaInit(): Promise<boolean> {
  //   await this.connection.migrate.latest({
  //     migrationSource: new XcMigrationSource(),
  //     tableName: 'xc_knex_migrations',
  //   });
  //   await this.connection.migrate.latest({
  //     migrationSource: new XcMigrationSourcev2(),
  //     tableName: 'xc_knex_migrationsv2',
  //   });
  //   return true;
  // }

  public async metaDelete(
    project_id: string,
    dbAlias: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    xcCondition?,
  ): Promise<void> {
    const query = this.knexConnection(target);

    if (project_id !== null && project_id !== undefined) {
      query.where('project_id', project_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }

    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else if (idOrCondition) {
      query.where(idOrCondition);
    }

    if (xcCondition) {
      query.condition(xcCondition, {});
    }

    return query.del();
  }

  public async metaGet2(
    project_id: string,
    baseId: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    fields?: string[],
    xcCondition?,
  ): Promise<any> {
    const query = this.knexConnection(target);

    if (xcCondition) {
      query.condition(xcCondition);
    }

    if (fields?.length) {
      query.select(...fields);
    }

    if (project_id !== null && project_id !== undefined) {
      query.where('project_id', project_id);
    }
    if (baseId !== null && baseId !== undefined) {
      query.where('base_id', baseId);
    }

    if (!idOrCondition) {
      return query.first();
    }

    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else {
      query.where(idOrCondition);
    }

    return query.first();
  }

  public async metaGetNextOrder(
    target: string,
    condition: { [key: string]: any },
  ): Promise<number> {
    const query = this.knexConnection(target);

    query.where(condition);
    query.max('order', { as: 'order' });

    return (+(await query.first())?.order || 0) + 1;
  }

  public async metaInsert(
    project_id: string,
    dbAlias: string,
    target: string,
    data: any,
  ): Promise<any> {
    return this.knexConnection(target).insert({
      db_alias: dbAlias,
      project_id,
      ...data,
      created_at: this.now(),
      updated_at: this.now(),
    });
  }

  public async metaList(
    project_id: string,
    _dbAlias: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?;
      fields?: string[];
      orderBy?: { [key: string]: 'asc' | 'desc' };
    },
  ): Promise<any[]> {
    const query = this.knexConnection(target);

    if (project_id !== null && project_id !== undefined) {
      query.where('project_id', project_id);
    }
    /*    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }*/

    if (args?.condition) {
      query.where(args.condition);
    }
    if (args?.limit) {
      query.limit(args.limit);
    }
    if (args?.offset) {
      query.offset(args.offset);
    }
    if (args?.xcCondition) {
      (query as any).condition(args.xcCondition);
    }

    if (args?.orderBy) {
      for (const [col, dir] of Object.entries(args.orderBy)) {
        query.orderBy(col, dir);
      }
    }
    if (args?.fields?.length) {
      query.select(...args.fields);
    }

    return query;
  }

  public async metaList2(
    project_id: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?;
      fields?: string[];
      orderBy: { [key: string]: 'asc' | 'desc' };
    },
  ): Promise<any[]> {
    const query = this.knexConnection(target);

    if (project_id !== null && project_id !== undefined) {
      query.where('project_id', project_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('base_id', dbAlias);
    }

    if (args?.condition) {
      query.where(args.condition);
    }
    if (args?.limit) {
      query.limit(args.limit);
    }
    if (args?.offset) {
      query.offset(args.offset);
    }
    if (args?.xcCondition) {
      (query as any).condition(args.xcCondition);
    }

    if (args?.orderBy) {
      for (const [col, dir] of Object.entries(args.orderBy)) {
        query.orderBy(col, dir);
      }
    }
    if (args?.fields?.length) {
      query.select(...args.fields);
    }

    return query;
  }

  public async metaCount(
    project_id: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      xcCondition?;
      aggField?: string;
    },
  ): Promise<number> {
    const query = this.knexConnection(target);

    if (project_id !== null && project_id !== undefined) {
      query.where('project_id', project_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('base_id', dbAlias);
    }

    if (args?.condition) {
      query.where(args.condition);
    }

    if (args?.xcCondition) {
      (query as any).condition(args.xcCondition);
    }

    query.count(args?.aggField || 'id', { as: 'count' }).first();

    return +(await query)?.['count'] || 0;
  }

  public async metaUpdate(
    project_id: string,
    dbAlias: string,
    target: string,
    data: any,
    idOrCondition?: string | { [p: string]: any },
    xcCondition?,
  ): Promise<any> {
    const query = this.knexConnection(target);
    if (project_id !== null && project_id !== undefined) {
      query.where('project_id', project_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }

    delete data.created_at;

    query.update({ ...data, updated_at: this.now() });
    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else if (idOrCondition) {
      query.where(idOrCondition);
    }
    if (xcCondition) {
      query.condition(xcCondition);
    }

    return await query;
  }

  public async metaDeleteAll(
    _project_id: string,
    _dbAlias: string,
  ): Promise<void> {
    // await this.knexConnection..dropTableIfExists('nc_roles').;
    // await this.knexConnection.schema.dropTableIfExists('nc_store').;
    // await this.knexConnection.schema.dropTableIfExists('nc_hooks').;
    // await this.knexConnection.schema.dropTableIfExists('nc_cron').;
    // await this.knexConnection.schema.dropTableIfExists('nc_acl').;
  }

  public async isMetaDataExists(
    project_id: string,
    dbAlias: string,
  ): Promise<boolean> {
    const query = this.knexConnection('nc_models');
    if (project_id !== null && project_id !== undefined) {
      query.where('project_id', project_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }
    const data = await query.first();

    return !!data;
  }

  async commit() {
    if (this.trx) {
      await this.trx.commit();
    }
    this.trx = null;
  }

  async rollback(e?) {
    if (this.trx) {
      await this.trx.rollback(e);
    }
    this.trx = null;
  }

  async startTransaction(): Promise<MetaService> {
    const trx = await this.connection.transaction();

    // todo: Extend transaction class to add our custom properties
    Object.assign(trx, {
      clientType: this.connection.clientType,
      searchPath: (this.connection as any).searchPath,
    });

    // todo: tobe done
    return new MetaService(this.metaConnection, trx);
  }

  async metaReset(
    project_id: string,
    dbAlias: string,
    apiType?: string,
  ): Promise<void> {
    // const apiType: string = this.config?.envs?.[this.config.env || this.config.workingEnv]?.db.find(d => {
    //   return d.meta.dbAlias === dbAlias;
    // })?.meta?.api?.type;

    if (apiType) {
      await Promise.all(
        META_TABLES?.[apiType]?.map((table) => {
          return (async () => {
            try {
              await this.knexConnection(table)
                .where({ db_alias: dbAlias, project_id })
                .del();
            } catch (e) {
              console.warn(`Error: ${table} reset failed`);
            }
          })();
        }),
      );
    }
  }

  public async projectCreate(
    projectName: string,
    config: any,
    description?: string,
    meta?: boolean,
  ): Promise<any> {
    try {
      const ranId = this.getNanoId();
      const id = `${projectName.toLowerCase().replace(/\W+/g, '_')}_${ranId}`;
      if (meta) {
        config.prefix = `nc_${ranId}__`;
        // if(config.envs._noco?.db?.[0]?.meta?.tn){
        //   config.envs._noco.db[0].meta.tn += `_${prefix}`
        // }
      }
      config.id = id;
      const project: any = {
        id,
        title: projectName,
        description,
        config: CryptoJS.AES.encrypt(
          JSON.stringify(config),
          'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
        ).toString(),
      };
      // todo: check project name used or not
      await this.knexConnection('nc_projects').insert({
        ...project,
        created_at: this.now(),
        updated_at: this.now(),
      });

      // todo
      await this.knexConnection(MetaTable.PROJECT).insert({
        id,
        title: projectName,
      });

      project.prefix = config.prefix;
      return project;
    } catch (e) {
      console.log(e);
    }
  }

  public async projectUpdate(projectId: string, config: any): Promise<any> {
    try {
      const project = {
        config: CryptoJS.AES.encrypt(
          JSON.stringify(config, null, 2),
          'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
        ).toString(),
      };
      // todo: check project name used or not
      await this.knexConnection('nc_projects').update(project).where({
        id: projectId,
      });
    } catch (e) {
      console.log(e);
    }
  }

  public async projectList(): Promise<any[]> {
    return (await this.knexConnection('nc_projects').select()).map((p) => {
      p.config = CryptoJS.AES.decrypt(
        p.config,
        'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8);
      return p;
    });
  }

  public async userProjectList(userId: any): Promise<any[]> {
    return (
      await this.knexConnection('nc_projects')
        .leftJoin(
          this.knexConnection('nc_projects_users')
            .where(`nc_projects_users.user_id`, userId)
            .as('user'),
          'user.project_id',
          'nc_projects.id',
        )
        .select('nc_projects.*')
        .select('user.user_id')
        .select(
          this.knexConnection('xc_users')
            .select('xc_users.email')
            .innerJoin(
              'nc_projects_users',
              'nc_projects_users.user_id',
              '=',
              'xc_users.id',
            )
            .whereRaw('nc_projects.id = nc_projects_users.project_id')
            .where('nc_projects_users.roles', 'like', '%owner%')
            .first()
            .as('owner'),
        )
        .select(
          this.knexConnection('xc_users')
            .count('xc_users.id')
            .innerJoin(
              'nc_projects_users',
              'nc_projects_users.user_id',
              '=',
              'xc_users.id',
            )
            .where((qb) => {
              qb.where('nc_projects_users.roles', 'like', '%creator%').orWhere(
                'nc_projects_users.roles',
                'like',
                '%owner%',
              );
            })
            .whereRaw('nc_projects.id = nc_projects_users.project_id')
            .andWhere('xc_users.id', userId)
            .first()
            .as('is_creator'),
        )
    ).map((p) => {
      p.allowed = p.user_id === userId;
      p.config = CryptoJS.AES.decrypt(
        p.config,
        'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8);
      return p;
    });
  }

  public async isUserHaveAccessToProject(
    projectId: string,
    userId: any,
  ): Promise<boolean> {
    return !!(await this.knexConnection('nc_projects_users')
      .where({
        project_id: projectId,
        user_id: userId,
      })
      .first());
  }

  public async projectGet(projectName: string, encrypt?): Promise<any> {
    const project = await this.knexConnection('nc_projects')
      .where({
        title: projectName,
      })
      .first();

    if (project && !encrypt) {
      project.config = CryptoJS.AES.decrypt(
        project.config,
        'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8);
    }
    return project;
  }

  public async projectGetById(projectId: string, encrypt?): Promise<any> {
    const project = await this.knexConnection('nc_projects')
      .where({
        id: projectId,
      })
      .first();
    if (project && !encrypt) {
      project.config = CryptoJS.AES.decrypt(
        project.config,
        'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8);
    }
    return project;
  }

  public projectDelete(title: string): Promise<any> {
    return this.knexConnection('nc_projects')
      .where({
        title,
      })
      .delete();
  }

  public projectDeleteById(id: string): Promise<any> {
    return this.knexConnection('nc_projects')
      .where({
        id,
      })
      .delete();
  }

  public async projectStatusUpdate(
    projectId: string,
    status: string,
  ): Promise<any> {
    return this.knexConnection('nc_projects')
      .update({
        status,
      })
      .where({
        id: projectId,
      });
  }

  public async projectAddUser(
    projectId: string,
    userId: any,
    roles: string,
  ): Promise<any> {
    if (
      await this.knexConnection('nc_projects_users')
        .where({
          user_id: userId,
          project_id: projectId,
        })
        .first()
    ) {
      return {};
    }
    return this.knexConnection('nc_projects_users').insert({
      user_id: userId,
      project_id: projectId,
      roles,
    });
  }

  public projectRemoveUser(projectId: string, userId: any): Promise<any> {
    return this.knexConnection('nc_projects_users')
      .where({
        user_id: userId,
        project_id: projectId,
      })
      .delete();
  }

  public removeXcUser(userId: any): Promise<any> {
    return this.knexConnection('xc_users')
      .where({
        id: userId,
      })
      .delete();
  }

  public get knex(): any {
    return this.knexConnection;
  }

  private getNanoId() {
    return nanoid();
  }

  private isMySQL(): boolean {
    return (
      this.connection.clientType() === 'mysql' ||
      this.connection.clientType() === 'mysql2'
    );
  }

  private isSqlite() {
    return this.connection.clientType() === 'sqlite3';
  }

  private isMssql() {
    return this.connection.clientType() === 'mssql';
  }

  private isPg() {
    return this.connection.clientType() === 'pg';
  }

  private isSnowflake() {
    return this.connection.clientType() === 'snowflake';
  }

  private now(): any {
    if (this.isMySQL()) {
      return dayjs().utc().format('YYYY-MM-DD HH:mm:ss');
    }
    return dayjs().utc().format('YYYY-MM-DD HH:mm:ssZ');
  }

  public async audit(
    project_id: string,
    dbAlias: string,
    target: string,
    data: any,
  ): Promise<any> {
    if (['DATA', 'COMMENT'].includes(data?.op_type)) {
      return Promise.resolve(undefined);
    }
    return this.metaInsert(project_id, dbAlias, target, data);
  }

  public async init(): Promise<boolean> {
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSource(),
      tableName: 'xc_knex_migrations',
    });
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSourcev2(),
      tableName: 'xc_knex_migrationsv2',
    });

    // set timezone
    if (this.isMySQL()) {
      await this.connection.raw(`SET time_zone = '+00:00'`);
    } else if (this.isPg()) {
      await this.connection.raw(`SET TIME ZONE 'UTC'`);
    } else if (this.isMssql()) {
      await this.connection.raw(`SET TIMEZONE = 'UTC'`);
    } else if (this.isSqlite()) {
      await this.connection.raw(`PRAGMA timezone = 'UTC'`);
    } else if (this.isSnowflake()) {
      // TODO
    }
    return true;
  }
}
