import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
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
  constructor(private readonly appHooksService: AppHooksService) {}

  async createSharedBaseLink(param: {
    baseId: string;
    roles: string;
    password: string;
    siteUrl: string;
  }): Promise<any> {
    validatePayload('swagger.json#/components/schemas/SharedBaseReq', param);

    const base = await Base.get(param.baseId);

    let roles = param?.roles;
    if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
      roles = 'viewer';
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

    data.url = `${param.siteUrl}${config.dashboardPath}#/nc/base/${data.uuid}`;
    delete data.password;

    this.appHooksService.emit(AppEvents.SHARED_BASE_GENERATE_LINK, {
      link: data.url,
      base,
    });

    return data;
  }

  async updateSharedBaseLink(param: {
    baseId: string;
    roles: string;
    password: string;
    siteUrl: string;
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
    const data: any = {
      uuid: base.uuid || uuidv4(),
      password: param.password,
      roles,
    };

    await Base.update(base.id, data);

    data.url = `${param.siteUrl}${config.dashboardPath}#/nc/base/${data.uuid}`;
    delete data.password;
    this.appHooksService.emit(AppEvents.SHARED_BASE_GENERATE_LINK, {
      link: data.url,
      base,
    });
    return data;
  }

  async disableSharedBaseLink(param: { baseId: string }): Promise<any> {
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
      data.url = `${param.siteUrl}${config.dashboardPath}#/nc/base/${data.shared_base_id}`;

    return data;
  }
}
