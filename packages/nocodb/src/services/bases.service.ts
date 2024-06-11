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
import type { Request } from 'express';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { populateMeta, validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { extractPropsAndSanitize } from '~/helpers/extractProps';
import syncMigration from '~/helpers/syncMigration';
import { Base, BaseUser } from '~/models';
import Noco from '~/Noco';
import { getToolDir } from '~/utils/nc-config';
import { MetaService } from '~/meta/meta.service';
import { MetaTable, RootScopes } from '~/utils/globals';
import { TablesService } from '~/services/tables.service';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

@Injectable()
export class BasesService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected metaService: MetaService,
    protected tablesService: TablesService,
  ) {}

  async baseList(
    context: NcContext,
    param: {
      user: { id: string; roles?: string | Record<string, boolean> };
      query?: any;
    },
  ) {
    const bases = extractRolesObj(param.user?.roles)[OrgUserRoles.SUPER_ADMIN]
      ? await Base.list()
      : await BaseUser.getProjectsList(param.user.id, param.query);

    return bases;
  }

  async getProjectWithInfo(context: NcContext, param: { baseId: string }) {
    const base = await Base.getWithInfo(context, param.baseId);
    return base;
  }

  sanitizeProject(base: any) {
    const sanitizedProject = { ...base };
    sanitizedProject.sources?.forEach((b: any) => {
      ['config'].forEach((k) => delete b[k]);
    });
    return sanitizedProject;
  }

  async baseUpdate(
    context: NcContext,
    param: {
      baseId: string;
      base: ProjectUpdateReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUpdateReq',
      param.base,
    );

    const base = await Base.getWithInfo(context, param.baseId);

    const data: Partial<Base> = extractPropsAndSanitize(param?.base as Base, [
      'title',
      'meta',
      'color',
      'status',
      'order',
    ]);
    await this.validateProjectTitle(context, data, base);

    if (data?.order !== undefined) {
      data.order = !isNaN(+data.order) ? +data.order : 0;
    }

    const result = await Base.update(context, param.baseId, data);

    this.appHooksService.emit(AppEvents.PROJECT_UPDATE, {
      base,
      user: param.user,
      req: param.req,
    });

    return result;
  }

  protected async validateProjectTitle(
    context: NcContext,
    data: Partial<Base>,
    base: Base,
  ) {
    if (
      data?.title &&
      base.title !== data.title &&
      (await Base.getByTitle(
        {
          workspace_id: RootScopes.BASE,
          base_id: RootScopes.BASE,
        },
        data.title,
      ))
    ) {
      NcError.badRequest('Base title already in use');
    }
  }

  async baseSoftDelete(
    context: NcContext,
    param: { baseId: any; user: UserType; req: NcRequest },
  ) {
    const base = await Base.getWithInfo(context, param.baseId);

    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    await Base.softDelete(context, param.baseId);

    this.appHooksService.emit(AppEvents.PROJECT_DELETE, {
      base,
      user: param.user,
      req: param.req,
    });

    return true;
  }

  async baseCreate(param: { base: ProjectReqType; user: any; req: any }) {
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

    const context = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    // TODO: create n:m instances here
    await BaseUser.insert(context, {
      fk_user_id: (param as any).user.id,
      base_id: base.id,
      roles: 'owner',
    });

    await syncMigration(base);

    // populate metadata if existing table
    for (const source of await base.getSources()) {
      if (process.env.NC_CLOUD !== 'true' && !base.is_meta) {
        const info = await populateMeta(context, source, base);

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

  async createDefaultBase(param: { user: UserType; req: Request }) {
    const base = await this.baseCreate({
      base: {
        title: 'Getting Started',
        type: 'database',
      } as any,
      user: param.user,
      req: param.req,
    });

    const context = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    const sqlUI = SqlUiFactory.create({ client: base.sources[0].type });
    const columns = sqlUI?.getNewTableColumns() as any;

    const table = await this.tablesService.tableCreate(context, {
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
