import CryptoJS from 'crypto-js';
import {nanoid} from 'nanoid';

import {NcConfig} from "../../../interface/config";
import {Knex, XKnex} from "../../dataMapper";
import NcHelp from "../../utils/NcHelp";
import Noco from "../Noco";
import XcMigrationSource from "../common/XcMigrationSource";

import NcMetaIO, {META_TABLES} from "./NcMetaIO";


export default class NcMetaIOImpl extends NcMetaIO {


  public async metaPaginatedList(projectId: string, dbAlias: string, target: string, args?: { condition?: { [key: string]: any; }; limit?: number; offset?: number; xcCondition?; fields?: string[]; sort?: { field: string, desc?: boolean } }): Promise<{ list: any[]; count: number; }> {
    const query = this.knexConnection(target)
    const countQuery = this.knexConnection(target)

    if (projectId !== null) {
      query.where('project_id', projectId)
      countQuery.where('project_id', projectId)
    }
    if (dbAlias !== null) {
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
      (query as any).condition(args.xcCondition)
      (countQuery as any).condition(args.xcCondition)
    }

    if (args?.fields?.length) {
      query.select(...args.fields)
    }


    return {
      list: await query,
      count: (Object.values(await countQuery.count().first()))?.[0] as any
    };
  }


  private connection: XKnex;
  // todo: need to fix
  private trx: Knex.Transaction;


  constructor(app: Noco, config: NcConfig) {
    super(app, config);

    if (this.config?.meta?.db?.client === 'sqlite3') {
      this.config.meta.db.useNullAsDefault = true;
    }

    if (this.config?.meta?.db) {
      this.connection = XKnex(this.config?.meta?.db);
    } else {
      let dbIndex = this.config.envs?.[this.config.workingEnv]?.db.findIndex(c => c.meta.dbAlias === this.config?.auth?.jwt?.dbAlias)
      dbIndex = dbIndex === -1 ? 0 : dbIndex;
      this.connection = XKnex(this.config.envs?.[this.config.workingEnv]?.db[dbIndex] as any);
    }
  }

  private get knexConnection(): XKnex {
    return (this.trx || this.connection) as any;
  }

  public updateKnex(connectionConfig): void {
    this.connection = XKnex(connectionConfig);
  }

  public async metaInit(): Promise<boolean> {
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSource(),
      tableName: 'xc_knex_migrations'
    });
    return true;
  }


  public async metaInitOld(): Promise<boolean> {


    let freshlyStarted = false;


    if (!(await this.knexConnection.schema.hasTable('nc_projects'))) {
      await this.knexConnection.schema.createTable('nc_projects', table => {
        table.increments();
        table.string('title');
        table.text('description');
        table.text('meta');
        table.timestamps();
      })
    }


    if (!(await this.knexConnection.schema.hasTable('nc_roles'))) {
      freshlyStarted = true;
      await this.knexConnection.schema.createTable('nc_roles', table => {
        table.increments();
        table.string('project_id').defaultTo('default');
        table.string('db_alias').defaultTo('db');
        table.string('title');
        table.string('type').defaultTo('CUSTOM');
        table.string('description');
        table.timestamps();
      });

      await this.knexConnection('nc_roles').insert([
        {db_alias: '', title: 'owner', description: 'Super Admin user of the app', type: 'SYSTEM'},
        {db_alias: '', title: 'creator', description: 'Admin user of the app', type: 'SYSTEM'},
        {db_alias: '', title: 'editor', description: 'Registered app users', type: 'SYSTEM'},
        {db_alias: '', title: 'guest', description: 'Unauthenticated public user', type: 'SYSTEM'},
      ])
    }

    if (!(await this.knexConnection.schema.hasTable('nc_hooks'))) {
      await this.knexConnection.schema.createTable('nc_hooks', table => {
        table.increments();
        table.string('project_id').defaultTo('default');
        table.string('db_alias').defaultTo('db')
        table.string('title');
        table.string('description', 255);
        table.string('env').defaultTo('all');
        table.string('tn');
        table.string('event');

        table.string('operation');
        table.boolean('async').defaultTo(false);
        table.boolean('payload').defaultTo(true);

        table.text('url', 'text');
        table.text('headers', 'text');
        table.integer('retries').defaultTo(0);
        table.integer('retry_interval').defaultTo(60000);
        table.integer('timeout').defaultTo(60000);
        table.boolean('active').defaultTo(true);
        table.timestamps();
      })
    }


    if (!(await this.knexConnection.schema.hasTable('nc_store'))) {
      await this.knexConnection.schema.createTable('nc_store', table => {
        table.increments();
        table.string('project_id').defaultTo('default')
        table.string('db_alias').defaultTo('db')
        table.string('key').index();
        table.text('value', 'text');
        table.string('type');
        table.string('env');
        table.string('tag');
        table.timestamps();
      })


      await this.knexConnection('nc_store').insert({
        key: 'NC_DEBUG',
        value: JSON.stringify({
          'nc:app': false,
          'nc:api:rest': false,
          'nc:api:base': false,
          'nc:api:gql': false,
          'nc:api:grpc': false,
          'nc:migrator': false,
          'nc:datamapper': false,
        }),
        db_alias: ''
      })

    }

    if (!(await this.knexConnection.schema.hasTable('nc_cron'))) {
      await this.knexConnection.schema.createTable('nc_cron', table => {
        table.increments();
        table.string('project_id').defaultTo('default')
        table.string('db_alias').defaultTo('db')
        table.string('title');
        table.string('description', 255);
        table.string('env');
        table.string('pattern');
        table.string('webhook');
        table.string('timezone').defaultTo('America/Los_Angeles');
        table.boolean('active').defaultTo(true);
        table.text('cron_handler');
        table.text('payload');
        table.text('headers');
        table.integer('retries').defaultTo(0);
        table.integer('retry_interval').defaultTo(60000);
        table.integer('timeout').defaultTo(60000);

        table.timestamps();
      })
    }


    if (!(await this.knexConnection.schema.hasTable('nc_acl'))) {
      await this.knexConnection.schema.createTable('nc_acl', table => {
        table.increments();
        table.string('project_id').defaultTo('default')
        table.string('db_alias').defaultTo('db')
        table.string('tn');
        table.text('acl');
        table.string('type').defaultTo('table');
        table.timestamps();
      })
    }


    if (!(await this.knexConnection.schema.hasTable('nc_models'))) {
      await this.knexConnection.schema.createTable('nc_models', table => {
        table.increments();
        table.string('project_id').defaultTo('default')
        table.string('db_alias').defaultTo('db')
        table.string('title');
        table.string('type').defaultTo('table');
        table.text('meta', 'mediumtext');
        table.text('schema', 'text');
        table.text('schema_previous', 'text')
        table.text('services', 'mediumtext');
        table.text('messages', 'text');
        table.boolean('enabled').defaultTo(true);
        table.timestamps();
        table.index(['db_alias', 'title'])
      })
    }


    if (!(await this.knexConnection.schema.hasTable('nc_relations'))) {
      await this.knexConnection.schema.createTable('nc_relations', table => {
        table.increments();
        table.string('project_id').defaultTo('default')
        table.string('db_alias')
        table.string('tn');
        table.string('rtn');
        table.string('cn');
        table.string('rcn');
        table.string('referenced_db_alias');
        table.string('type');
        table.string('db_type');
        table.string('ur');
        table.string('dr');

        table.timestamps();
        table.index(['db_alias', 'tn'])
      })
    }

    if (this.config.projectType === 'rest' || this.isRest) {
      if (!(await this.knexConnection.schema.hasTable('nc_routes'))) {
        await this.knexConnection.schema.createTable('nc_routes', table => {
          table.increments();
          table.string('project_id').defaultTo('default')
          table.string('db_alias').defaultTo('db')
          table.string('title');
          table.string('tn');
          table.string('tnp');
          table.string('tnc');
          table.string('relation_type');
          table.text('path', 'text');
          table.string('type');
          table.text('handler', 'text');
          table.text('acl', 'text');
          table.integer('order');
          table.text('functions');
          table.integer('handler_type').defaultTo(1);
          table.boolean('is_custom');
          // table.text('placeholder', 'longtext');
          table.timestamps();
          table.index(['db_alias', 'title', 'tn'])
        })
      }
    }

    if (this.config.projectType === 'graphql' || this.isGql) {
      if (!(await this.knexConnection.schema.hasTable('nc_resolvers'))) {
        await this.knexConnection.schema.createTable('nc_resolvers', (table) => {
          table.increments();
          table.string('project_id').defaultTo('default')
          table.string('db_alias').defaultTo('db')
          table.string('title');
          table.text('resolver', 'text');
          table.string('type');
          table.text('acl', 'text');
          table.text('functions');
          table.integer('handler_type').defaultTo(1);
          // table.text('placeholder', 'text');
          table.timestamps();
        })
      }

      if (!(await this.knexConnection.schema.hasTable('nc_loaders'))) {
        await this.knexConnection.schema.createTable('nc_loaders', table => {
          table.increments();
          table.string('project_id').defaultTo('default')
          table.string('db_alias').defaultTo('db')
          table.string('title');
          table.string('parent');
          table.string('child');
          table.string('relation');
          table.string('resolver');
          table.text('functions');
          table.timestamps();
        })
      }
    }

    if (this.config.projectType === 'grpc' || this.isGrpc) {
      if (!(await this.knexConnection.schema.hasTable('nc_rpc'))) {
        await this.knexConnection.schema.createTable('nc_rpc', (table) => {
          table.increments();
          table.string('project_id').defaultTo('default')
          table.string('db_alias').defaultTo('db')
          table.string('title');
          table.string('tn');
          table.text('service', 'text');

          table.string('tnp');
          table.string('tnc');
          table.string('relation_type');
          table.integer('order');

          table.string('type');
          table.text('acl', 'text');
          table.text('functions', 'text');
          table.integer('handler_type').defaultTo(1);
          // table.text('placeholder', 'text');
          table.timestamps();
        })
      }
    }

    try {
      const debugEnabled = await this.metaGet('', '', 'nc_store', {
        key: 'NC_DEBUG'
      });

      NcHelp.enableOrDisableDebugLog(JSON.parse(debugEnabled.value));
    } catch (_e) {
      console.log(_e)
    }

    if (!freshlyStarted) {
      freshlyStarted = !(await this.knexConnection('nc_models').first());
    }


    return freshlyStarted;
  }


  public async metaDelete(
    project_id: string,
    dbAlias: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    xcCondition?
  ): Promise<void> {
    const query = this.knexConnection(target);


    if (project_id !== null) {
      query.where('project_id', project_id)
    }
    if (dbAlias !== null) {
      query.where('db_alias', dbAlias);
    }

    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else if (idOrCondition) {
      query.where(idOrCondition);
    }

    if (xcCondition) {
      query.condition(xcCondition, {})
    }

    return query.del();
  }

  public async metaGet(project_id: string,
                       dbAlias: string,
                       target: string,
                       idOrCondition: string | { [p: string]: any },
                       fields?: string[], xcCondition?): Promise<any> {
    const query = this.knexConnection(target);


    if (xcCondition) {
      query.condition(xcCondition)
    }

    if (fields?.length) {
      query.select(...fields)
    }


    if (project_id !== null) {
      query.where('project_id', project_id)
    }
    if (dbAlias !== null) {
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


  public async metaInsert(project_id: string, dbAlias: string, target: string, data: any): Promise<any> {
    return this.knexConnection(target).insert({
      'db_alias': dbAlias,
      project_id,
      created_at: this.knexConnection?.fn?.now(),
      updated_at: this.knexConnection?.fn?.now(), ...data
    });
  }

  public async metaList(project_id: string, dbAlias: string, target: string, args?: {
    condition?: { [p: string]: any }; limit?: number; offset?: number, xcCondition?,
    fields?: string[]
  }): Promise<any[]> {
    const query = this.knexConnection(target)

    if (project_id !== null) {
      query.where('project_id', project_id)
    }
    if (dbAlias !== null) {
      query.where('db_alias', dbAlias);
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
      (query as any).condition(args.xcCondition)
    }

    if (args?.fields?.length) {
      query.select(...args.fields)
    }

    return query;
  }

  public async metaUpdate(project_id: string, dbAlias: string, target: string, data: any, idOrCondition?: string | { [p: string]: any }, xcCondition?): Promise<any> {
    const query = this.knexConnection(target);
    if (project_id !== null) {
      query.where('project_id', project_id)
    }
    if (dbAlias !== null) {
      query.where('db_alias', dbAlias);
    }

    delete data.created_at;

    query.update({...data, updated_at: this.knexConnection?.fn?.now()});
    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else if (idOrCondition) {
      query.where(idOrCondition);
    }
    if (xcCondition) {
      query.condition(xcCondition)
    }

    // console.log(query.toQuery())


    return query;
  }

  public async metaDeleteAll(_project_id: string, _dbAlias: string): Promise<void> {
    // await this.knexConnection..dropTableIfExists('nc_roles').;
    // await this.knexConnection.schema.dropTableIfExists('nc_store').;
    // await this.knexConnection.schema.dropTableIfExists('nc_hooks').;
    // await this.knexConnection.schema.dropTableIfExists('nc_cron').;
    // await this.knexConnection.schema.dropTableIfExists('nc_acl').;
  }

  public async isMetaDataExists(project_id: string, dbAlias: string): Promise<boolean> {
    const query = this.knexConnection('nc_models');
    if (project_id !== null) {
      query.where('project_id', project_id)
    }
    if (dbAlias !== null) {
      query.where('db_alias', dbAlias);
    }
    const data = await query.first();

    return !!data;
  }

  commit() {
    if (this.trx) {
      this.trx.commit();
    }
    this.trx = null;
  }

  rollback(e?) {
    if (this.trx) {
      this.trx.rollback(e);
    }
    this.trx = null;
  }

  async startTransaction() {
    if (!this.trx) {
      this.trx = await this.connection.transaction();
    }
  }

  async metaReset(project_id: string, dbAlias: string, apiType?: string): Promise<void> {
    // const apiType: string = this.config?.envs?.[this.config.env || this.config.workingEnv]?.db.find(d => {
    //   return d.meta.dbAlias === dbAlias;
    // })?.meta?.api?.type;

    if (apiType) {
      await Promise.all(META_TABLES?.[apiType]?.map(table => {
        return (async () => {
          try {
            await this.knexConnection(table).where({db_alias: dbAlias, project_id}).del();
          } catch (e) {
            console.warn(`Error: ${table} reset failed`)
          }
        })()
      }))
    }
  }

  public async projectCreate(projectName: string, config: any, description?: string): Promise<any> {
    try {
      const id = this.getProjectId(projectName);
      config.id = id;
      const project = {
        id,
        title: projectName,
        description,
        config: CryptoJS.AES.encrypt(JSON.stringify(config), this.config?.auth?.jwt?.secret).toString()
      };
      // todo: check project name used or not
      await this.connection('nc_projects').insert({
        ...project,
        created_at: this.knexConnection?.fn?.now(),
        updated_at: this.knexConnection?.fn?.now(),
      });
      return project;
    } catch (e) {
      console.log(e)
    }
  }

  public async projectUpdate(projectId: string,
                             config: any): Promise<any> {
    try {
      const project = {
        config: CryptoJS.AES.encrypt(JSON.stringify(config, null, 2), this.config?.auth?.jwt?.secret).toString()
      };
      // todo: check project name used or not
      await this.connection('nc_projects').update(project).where({
        id: projectId
      });
    } catch (e) {
      console.log(e)
    }
  }

  public async projectList(): Promise<any[]> {
    return (await this.connection('nc_projects').select()).map(p => {
      p.config = CryptoJS.AES.decrypt(p.config, this.config?.auth?.jwt?.secret).toString(CryptoJS.enc.Utf8)
      return p;
    });
  }

  public async userProjectList(userId: any): Promise<any[]> {
    return (await this.connection('nc_projects')
      .innerJoin('nc_projects_users', 'nc_projects_users.project_id', 'nc_projects.id')
      .select('nc_projects.*')
      .where(`nc_projects_users.user_id`, userId)).map(p => {
      p.config = CryptoJS.AES.decrypt(p.config, this.config?.auth?.jwt?.secret).toString(CryptoJS.enc.Utf8)
      return p;
    });
  }

  public async isUserHaveAccessToProject(projectId: string, userId: any): Promise<boolean> {
    return !!(await this.connection('nc_projects_users').where({
      project_id: projectId,
      user_id: userId
    }).first());
  }

  public async projectGet(projectName: string, encrypt ?): Promise<any> {
    const project = await this.connection('nc_projects').where({
      title: projectName
    }).first();

    if (project && !encrypt) {
      project.config = CryptoJS.AES.decrypt(project.config, this.config?.auth?.jwt?.secret).toString(CryptoJS.enc.Utf8)
    }
    return project;
  }

  public async projectGetById(projectId: string, encrypt ?): Promise<any> {
    const project = await this.connection('nc_projects').where({
      id: projectId
    }).first();
    if (project && !encrypt) {
      project.config = CryptoJS.AES.decrypt(project.config, this.config?.auth?.jwt?.secret).toString(CryptoJS.enc.Utf8)
    }
    return project;
  }


  public projectDelete(title: string): Promise<any> {
    return this.connection('nc_projects').where({
      title
    }).delete();
  }

  public async projectStatusUpdate(projectName: string, status: string): Promise<any> {
    return this.connection('nc_projects').update({
      status
    }).where({
      title: projectName
    });
  }

  public async projectAddUser(projectId: string, userId: any, roles: string): Promise<any> {
    if (await this.connection('nc_projects_users').where({
      user_id: userId,
      project_id: projectId
    }).first()) {
      return {}
    }
    return this.connection('nc_projects_users').insert({
      user_id: userId,
      project_id: projectId,
      roles
    });
  }

  public projectRemoveUser(projectId: string, userId: any): Promise<any> {
    return this.connection('nc_projects_users').where({
      user_id: userId,
      project_id: projectId
    }).delete();
  }


  get isRest(): boolean {
    return this.config?.envs?.[this.config.workingEnv]?.db?.some(db => db?.meta?.api?.type === 'rest');
  }

  get isGql(): boolean {
    return this.config?.envs?.[this.config.workingEnv]?.db?.some(db => db?.meta?.api?.type === 'graphql');
  }

  get isGrpc(): boolean {
    return this.config?.envs?.[this.config.workingEnv]?.db?.some(db => db?.meta?.api?.type === 'grpc');
  }

  public get knex(): any {
    return this.knexConnection;
  }

  private getProjectId(projectName: string) {
    return `${projectName.toLowerCase().replace(/\W+/g, '_')}_${nanoid(4)}`
  }

  public async audit(project_id: string, dbAlias: string, target: string, data: any): Promise<any> {
    if (['DATA', 'COMMENT'].includes(data?.op_type)) {
      return Promise.resolve(undefined);
    }
    return this.metaInsert(project_id, dbAlias, target, data)
  }

}/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
