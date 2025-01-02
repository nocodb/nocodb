import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import type { AppConfig, NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Base, CustomUrl } from '~/models';

// todo: load from config
const config = {
  dashboardPath: '/nc',
};

@Injectable()
export class SharedBasesService {
  constructor(
    private readonly appHooksService: AppHooksService,
    private configService: ConfigService<AppConfig>,
  ) {}

  async createSharedBaseLink(
    context: NcContext,
    param: {
      baseId: string;
      roles: string;
      password: string;
      siteUrl: string;

      req: NcRequest;
    },
  ): Promise<any> {
    validatePayload('swagger.json#/components/schemas/SharedBaseReq', param);

    const base = await Base.get(context, param.baseId);

    let roles = param?.roles;
    if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
      roles = 'viewer';
    }

    if (roles === 'editor') {
      NcError.badRequest('Only viewer role is supported');
    }

    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    const data: any = {
      uuid: uuidv4(),
      password: param?.password,
      roles,
    };

    await Base.update(context, base.id, data);

    data.url = this.getUrl({
      base,
      siteUrl: param.siteUrl,
    });

    delete data.password;

    this.appHooksService.emit(AppEvents.SHARED_BASE_GENERATE_LINK, {
      link: data.url,
      base,
      req: param.req,
    });

    return data;
  }

  async updateSharedBaseLink(
    context: NcContext,
    param: {
      baseId: string;
      roles: string;
      password: string;
      siteUrl: string;
      req: NcRequest;
      custom_url_path?: string;
      original_url?: string;
    },
  ): Promise<any> {
    validatePayload('swagger.json#/components/schemas/SharedBaseReq', param);

    const base = await Base.get(context, param.baseId);

    let roles = param.roles;
    if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
      roles = 'viewer';
    }

    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    if (roles === 'editor' && process.env.NC_CLOUD === 'true') {
      NcError.badRequest('Only viewer role is supported');
    }

    let customUrl: CustomUrl | undefined = base.fk_custom_url_id
      ? await CustomUrl.get({
          id: base.fk_custom_url_id,
        })
      : undefined;

    // Update an existing custom URL if it exists
    if (customUrl?.id) {
      if (param.custom_url_path || param.original_url) {
        // Prepare updated fields conditionally
        const updates: Partial<CustomUrl> = {};

        if (param.custom_url_path !== undefined) {
          updates.custom_path = param.custom_url_path;
        }

        if (customUrl.original_path !== param.original_url) {
          updates.original_path = param.original_url;
        }

        // Perform the update if there are changes
        if (Object.keys(updates).length > 0) {
          await CustomUrl.update(base.fk_custom_url_id, updates);
        }
      } else if (param.custom_url_path !== undefined) {
        // Delete the custom URL if only the custom path is undefined
        await CustomUrl.delete({ id: base.fk_custom_url_id as string });
        customUrl = undefined;
      }
    } else if (param.custom_url_path) {
      // Insert a new custom URL if it doesn't exist

      customUrl = await CustomUrl.insert({
        fk_workspace_id: base.fk_workspace_id,
        base_id: base.id,
        original_path: param.original_url,
        custom_path: param.custom_url_path,
      });
    }

    const data: any = {
      uuid: base.uuid || uuidv4(),
      password: param.password,
      roles,
      fk_custom_url_id: customUrl?.id ?? null,
    };

    await Base.update(context, base.id, data);

    data.url = this.getUrl({
      base,
      siteUrl: param.siteUrl,
    });

    delete data.password;
    this.appHooksService.emit(AppEvents.SHARED_BASE_GENERATE_LINK, {
      link: data.url,
      base,
      req: param.req,
    });
    return data;
  }

  private getUrl({ base, siteUrl: _siteUrl }: { base: Base; siteUrl: string }) {
    let siteUrl = _siteUrl;

    const baseDomain = process.env.NC_BASE_HOST_NAME;
    const dashboardPath = this.configService.get('dashboardPath', {
      infer: true,
    });

    if (baseDomain) {
      siteUrl = `https://${base['fk_workspace_id']}.${baseDomain}${dashboardPath}`;
    }

    return `${siteUrl}${config.dashboardPath}#/base/${base.uuid}`;
  }

  async disableSharedBaseLink(
    context: NcContext,
    param: {
      baseId: string;
      req: NcRequest;
    },
  ): Promise<any> {
    const base = await Base.get(context, param.baseId);

    if (!base) {
      NcError.baseNotFound(param.baseId);
    }
    const data: any = {
      uuid: null,
      fk_custom_url_id: null,
    };

    await Base.update(context, base.id, data);

    if (base.fk_custom_url_id) {
      await CustomUrl.delete({ id: base.fk_custom_url_id });
    }

    this.appHooksService.emit(AppEvents.SHARED_BASE_DELETE_LINK, {
      base,
      req: param.req,
    });
    return { uuid: null };
  }

  async getSharedBaseLink(
    context: NcContext,
    param: {
      baseId: string;
      siteUrl: string;
    },
  ): Promise<any> {
    const base = await Base.get(context, param.baseId);

    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    const data: any = {
      uuid: base.uuid,
      roles: base.roles,
      fk_custom_url_id: base.fk_custom_url_id,
    };
    if (data.uuid)
      data.url = `${param.siteUrl}${config.dashboardPath}#/base/${data.shared_base_id}`;

    return data;
  }
}
