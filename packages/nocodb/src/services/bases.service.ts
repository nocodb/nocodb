import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';
import { customAlphabet } from 'nanoid';
import {
  AppEvents,
  extractRolesObj,
  OrgUserRoles,
  SqlUiFactory,
} from 'nocodb-sdk';
import type {
  ProjectReqType,
  ProjectUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { populateMeta, validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { extractPropsAndSanitize } from '~/helpers/extractProps';
import syncMigration from '~/helpers/syncMigration';
import { Base, BaseUser } from '~/models';
import Noco from '~/Noco';
import { getToolDir } from '~/utils/nc-config';
import { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/utils/globals';
import { TablesService } from '~/services/tables.service';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

@Injectable()
export class BasesService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected metaService: MetaService,
    protected tablesService: TablesService,
  ) {}

  async baseList(param: {
    user: { id: string; roles?: string | Record<string, boolean> };
    query?: any;
  }) {
    const bases = extractRolesObj(param.user?.roles)[OrgUserRoles.SUPER_ADMIN]
      ? await Base.list(param.query)
      : await BaseUser.getProjectsList(param.user.id, param.query);

    return bases;
  }

  async getProjectWithInfo(param: { baseId: string }) {
    const base = await Base.getWithInfo(param.baseId);
    return base;
  }

  sanitizeProject(base: any) {
    const sanitizedProject = { ...base };
    sanitizedProject.sources?.forEach((b: any) => {
      ['config'].forEach((k) => delete b[k]);
    });
    return sanitizedProject;
  }

  async baseUpdate(param: {
    baseId: string;
    base: ProjectUpdateReqType;
    user: UserType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUpdateReq',
      param.base,
    );

    const base = await Base.getWithInfo(param.baseId);

    const data: Partial<Base> = extractPropsAndSanitize(param?.base as Base, [
      'title',
      'meta',
      'color',
      'status',
    ]);
    await this.validateProjectTitle(data, base);

    const result = await Base.update(param.baseId, data);

    this.appHooksService.emit(AppEvents.PROJECT_UPDATE, {
      base,
      user: param.user,
      req: param.req,
    });

    return result;
  }

  protected async validateProjectTitle(data: Partial<Base>, base: Base) {
    if (
      data?.title &&
      base.title !== data.title &&
      (await Base.getByTitle(data.title))
    ) {
      NcError.badRequest('Base title already in use');
    }
  }

  async baseSoftDelete(param: { baseId: any; user: UserType; req: NcRequest }) {
    const base = await Base.getWithInfo(param.baseId);

    if (!base) {
      NcError.notFound('Base not found');
    }

    await Base.softDelete(param.baseId);

    this.appHooksService.emit(AppEvents.PROJECT_DELETE, {
      base,
      user: param.user,
      req: param.req,
    });

    return true;
  }

  async baseCreate(param: { base: ProjectReqType; user: any; req: NcRequest }) {
    validatePayload('swagger.json#/components/schemas/ProjectReq', param.base);

    const baseId = await this.metaService.genNanoid(MetaTable.PROJECT);

    const baseBody: ProjectReqType & Record<string, any> = param.base;
    baseBody.id = baseId;

    if (!baseBody.external) {
      const ranId = nanoid();
      baseBody.prefix = `nc_${ranId}__`;
      baseBody.is_meta = true;
      if (process.env.NC_MINIMAL_DBS === 'true') {
        // if env variable NC_MINIMAL_DBS is set, then create a SQLite file/connection for each base
        // each file will be named as nc_<random_id>.db
        const fs = require('fs');
        const toolDir = getToolDir();
        const nanoidv2 = customAlphabet(
          '1234567890abcdefghijklmnopqrstuvwxyz',
          14,
        );
        if (!(await promisify(fs.exists)(`${toolDir}/nc_minimal_dbs`))) {
          await promisify(fs.mkdir)(`${toolDir}/nc_minimal_dbs`);
        }
        const dbId = nanoidv2();
        const baseTitle = DOMPurify.sanitize(baseBody.title);
        baseBody.prefix = '';
        baseBody.sources = [
          {
            type: 'sqlite3',
            is_meta: false,
            config: {
              client: 'sqlite3',
              connection: {
                client: 'sqlite3',
                database: baseTitle,
                connection: {
                  filename: `${toolDir}/nc_minimal_dbs/${baseTitle}_${dbId}.db`,
                },
              },
            },
            inflection_column: 'camelize',
            inflection_table: 'camelize',
          },
        ];
      } else {
        const db = Noco.getConfig().meta?.db;
        baseBody.sources = [
          {
            type: db?.client,
            config: null,
            is_meta: true,
            inflection_column: 'camelize',
            inflection_table: 'camelize',
          },
        ];
      }
    } else {
      if (process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED) {
        NcError.badRequest('Connecting to external db is disabled');
      }
      baseBody.is_meta = false;
    }

    if (baseBody?.title.length > 50) {
      NcError.badRequest('Base title exceeds 50 characters');
    }

    baseBody.title = DOMPurify.sanitize(baseBody.title);
    baseBody.slug = baseBody.title;

    const base = await Base.createProject(baseBody);

    // TODO: create n:m instances here
    await BaseUser.insert({
      fk_user_id: (param as any).user.id,
      base_id: base.id,
      roles: 'owner',
    });

    await syncMigration(base);

    // populate metadata if existing table
    for (const source of await base.getBases()) {
      if (process.env.NC_CLOUD !== 'true' && !base.is_meta) {
        const info = await populateMeta(source, base);

        this.appHooksService.emit(AppEvents.APIS_CREATED, {
          info,
          req: param.req,
        });

        delete source.config;
      }
    }

    this.appHooksService.emit(AppEvents.PROJECT_CREATE, {
      base,
      user: param.user,
      xcdb: !baseBody.external,
      req: param.req,
    });

    return base;
  }

  async createDefaultBase(param: { user: UserType; req: NcRequest }) {
    const base = await this.baseCreate({
      base: {
        title: 'Getting Started',
        type: 'database',
      } as any,
      user: param.user,
      req: param.req,
    });

    const sqlUI = SqlUiFactory.create({ client: base.sources[0].type });
    const columns = sqlUI?.getNewTableColumns() as any;

    const table = await this.tablesService.tableCreate({
      baseId: base.id,
      sourceId: base.sources[0].id,
      table: {
        title: 'Features',
        table_name: 'Features',
        columns,
      },
      user: param.user,
    });

    (base as any).tables = [table];

    return base;
  }
}
