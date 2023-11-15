import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import type { AppConfig, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';

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

  async createSharedBaseLink(param: {
    baseId: string;
    roles: string;
    password: string;
    siteUrl: string;

    req: NcRequest;
  }): Promise<any> {
    validatePayload('swagger.json#/components/schemas/SharedBaseReq', param);

    const base = await Base.get(param.baseId);

    let roles = param?.roles;
    if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
      roles = 'viewer';
    }

    if (roles === 'editor' && process.env.NC_CLOUD === 'true') {
      NcError.badRequest('Only viewer role is supported');
    }

    if (!base) {
      NcError.badRequest('Invalid base id');
    }

    const data: any = {
      uuid: uuidv4(),
      password: param?.password,
      roles,
    };

    await Base.update(base.id, data);

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

  async updateSharedBaseLink(param: {
    baseId: string;
    roles: string;
    password: string;
    siteUrl: string;
    req: NcRequest;
  }): Promise<any> {
    validatePayload('swagger.json#/components/schemas/SharedBaseReq', param);

    const base = await Base.get(param.baseId);

    let roles = param.roles;
    if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
      roles = 'viewer';
    }

    if (!base) {
      NcError.badRequest('Invalid base id');
    }

    if (roles === 'editor' && process.env.NC_CLOUD === 'true') {
      NcError.badRequest('Only viewer role is supported');
    }

    const data: any = {
      uuid: base.uuid || uuidv4(),
      password: param.password,
      roles,
    };

    await Base.update(base.id, data);

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

  async disableSharedBaseLink(param: {
    baseId: string;
    req: NcRequest;
  }): Promise<any> {
    const base = await Base.get(param.baseId);

    if (!base) {
      NcError.badRequest('Invalid base id');
    }
    const data: any = {
      uuid: null,
    };

    await Base.update(base.id, data);

    this.appHooksService.emit(AppEvents.SHARED_BASE_DELETE_LINK, {
      base,
      req: param.req,
    });
    return { uuid: null };
  }

  async getSharedBaseLink(param: {
    baseId: string;
    siteUrl: string;
  }): Promise<any> {
    const base = await Base.get(param.baseId);

    if (!base) {
      NcError.badRequest('Invalid base id');
    }
    const data: any = {
      uuid: base.uuid,
      roles: base.roles,
    };
    if (data.uuid)
      data.url = `${param.siteUrl}${config.dashboardPath}#/base/${data.shared_base_id}`;

    return data;
  }
}
