import { Injectable } from '@nestjs/common';
import { extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
import type {
  BaseUpdateV3Type,
  BaseV3Type,
  ProjectReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Base, BaseUser, Source } from '~/models';
import { BasesService } from '~/services/bases.service';
import { RootScopes } from '~/utils/globals';
import { validatePayload } from '~/helpers';
import { baseBuilder, sourceBuilder } from '~/utils/builders/base';

@Injectable()
export class BasesV3Service {
  constructor(protected readonly basesService: BasesService) {}

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

    const formattedBases: BaseV3Type[] = [];

    for (const base of bases) {
      const sources = sourceBuilder().build(
        (await new Base(base as Partial<Base>).getSources()).filter(
          (s) => !new Source(s).isMeta(),
        ),
      );
      formattedBases.push({
        ...baseBuilder().build(base),
        sources: sources.length ? sources : undefined,
      });
    }
    return formattedBases;
  }

  async getProject(context: NcContext, param: { baseId: string }) {
    const base: Base | BaseV3Type = await Base.get(context, param.baseId);

    const sources = sourceBuilder().build(
      (await new Base(base as Partial<Base>).getSources()).filter(
        (s) => !new Source(s).isMeta(),
      ),
    );
    return {
      ...baseBuilder().build(base),
      sources: sources.length ? sources : undefined,
    } as BaseV3Type;
  }

  async getProjectWithInfo(
    context: NcContext,
    param: { baseId: string; includeConfig?: boolean },
  ) {
    const base = await this.basesService.getProjectWithInfo(context, param);

    if (!base) NcError.notFound('Base not found');

    // filter non-meta sources
    const sources = base.sources.filter((s) => !new Source(s).isMeta());

    return {
      ...baseBuilder().build(base),
      sources: sources?.length ? sourceBuilder().build(sources) : undefined,
    } as BaseV3Type;
  }

  async baseUpdate(
    context: NcContext,
    param: {
      baseId: string;
      base: BaseUpdateV3Type;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseUpdate',
      param.base,
      true,
    );
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
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseCreate',
      param.base,
      true,
    );

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
