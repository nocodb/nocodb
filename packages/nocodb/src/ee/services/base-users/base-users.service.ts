import { BaseUsersService as BaseUsersServiceCE } from 'src/services/base-users/base-users.service';
import { Injectable } from '@nestjs/common';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Base, BaseUser } from '~/models';

@Injectable()
export class BaseUsersService extends BaseUsersServiceCE {
  constructor(protected appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async userList(param: { baseId: string; query: any }) {
    const base = await Base.get(param.baseId);

    const baseUsers = await BaseUser.getUsersList({
      ...param.query,
      base_id: param.baseId,
      workspace_id: (base as Base).fk_workspace_id,
    });

    return new PagedResponseImpl(baseUsers, {
      ...param.query,
      count: baseUsers.length,
    });
  }
}
