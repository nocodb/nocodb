import { Injectable } from '@nestjs/common';
import { extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
import type {
  ProjectReqType,
  ProjectUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Base, BaseUser, Source } from '~/models';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { BasesService } from '~/services/bases.service';
import { RootScopes } from '~/utils/globals';

@Injectable()
export class BasesV3Service {
  protected builder;
  protected sourceBuilder;

  constructor(protected readonly basesService: BasesService) {
    this.builder = builderGenerator({
      allowed: [
        'id',
        'title',
        'description',
        'created_at',
        'updated_at',
        'meta',
        'sources',
        'fk_workspace_id',
      ],
      mappings: {
        name: 'title',
        isMeta: 'is_meta',
        source: 'sources',
        fk_workspace_id: 'workspace_id',
      },
      meta: {
        snakeCase: true,
        metaProps: ['meta'],
      },
    });
    this.sourceBuilder = builderGenerator({
      allowed: [
        'id',
        'alias',
        'type',
        'is_schema_readonly',
        'is_data_readonly',
        'integration_id',
      ],
      mappings: {
        alias: 'title',
        isMeta: 'is_meta',
        source: 'sources',
      },
    });
  }

  protected async getBaseList(
    context: NcContext,
    param: {
      user: { id: string; roles?: string | Record<string, boolean> };
      query?: any;
    },
  ) {
    return extractRolesObj(param.user?.roles)[OrgUserRoles.SUPER_ADMIN]
      ? await Base.list()
      : await BaseUser.getProjectsList(param.user.id, param.query);
  }

  async baseList(
    context: NcContext,
    param: {
      user: { id: string; roles?: string | Record<string, boolean> };
      query?: any;
      workspaceId: string;
    },
  ) {
    const bases = await this.getBaseList(context, param);

    for (const base of bases) {
      const sources = this.sourceBuilder().build(
        (await new Base(base as Partial<Base>).getSources()).filter(
          (s) => !new Source(s).isMeta(),
        ),
      );
      base.sources = sources.length ? sources : undefined;
    }
    return this.builder().build(bases);
  }

  async getProject(context: NcContext, param: { baseId: string }) {
    const base = await Base.get(context, param.baseId);

    const sources = this.sourceBuilder().build(
      (await new Base(base as Partial<Base>).getSources()).filter(
        (s) => !new Source(s).isMeta(),
      ),
    );
    base.sources = sources.length ? sources : undefined;
    return this.builder().build(base);
  }

  async getProjectWithInfo(
    context: NcContext,
    param: { baseId: string; includeConfig?: boolean },
  ) {
    const base = await this.basesService.getProjectWithInfo(context, param);

    // filter non-meta sources
    const sources = base.sources.filter((s) => !new Source(s).isMeta());

    return {
      ...this.builder().build(base),
      sources: sources?.length
        ? this.sourceBuilder().build(sources)
        : undefined,
    };
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
    const meta = param.base.meta as unknown as Record<string, unknown>;

    if (meta?.icon_color) {
      meta.iconColor = meta.icon_color;
      meta.icon_color = undefined;
    }

    await this.basesService.baseUpdate(context, param);
    return this.getProjectWithInfo(context, { baseId: param.baseId });
  }

  async baseCreate(param: {
    base: ProjectReqType;
    user: any;
    req: any;
    workspaceId: string;
  }) {
    const base = {
      ...param.base,
      fk_workspace_id: param.workspaceId,
      type: 'database',
    } as ProjectReqType;

    const meta = param.base.meta as unknown as Record<string, unknown>;

    if (meta?.icon_color) {
      meta.iconColor = meta.icon_color;
      meta.icon_color = undefined;
    }

    const res = await this.basesService.baseCreate({
      ...param,
      base,
    });
    return this.getProjectWithInfo(
      { workspace_id: res.fk_workspace_id, base_id: RootScopes.WORKSPACE },
      { baseId: res.id },
    );
  }

  async baseSoftDelete(
    context: NcContext,
    param: { baseId: any; user: UserType; req: NcRequest },
  ) {
    await this.basesService.baseSoftDelete(context, param);
    return {};
  }
}
