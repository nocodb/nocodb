import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ProjectUserReqType } from 'nocodb-sdk';
import { BaseUsersController as BaseUsersControllerCE } from 'src/controllers/base-users.controller';
import { GlobalGuard } from '~/guards/global/global.guard';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { User, WorkspaceUser } from '~/models';
import { NcError } from '~/helpers/catchError';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BaseUsersController extends BaseUsersControllerCE {
  constructor(protected readonly baseUsersService: BaseUsersService) {
    super(baseUsersService);
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/users',
    '/api/v2/meta/bases/:baseId/users',
  ])
  @HttpCode(200)
  @Acl('userInvite')
  async userInvite(
    @Param('baseId') baseId: string,
    @Req() req: Request,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    // todo: move this to a service
    if (!body.email) {
      NcError.badRequest('Email is required');
    }

    const user = await User.getByEmail(body.email);

    if (!user) {
      NcError.badRequest('Only user belonging to the workspace can be invited');
    }

    const workspaceUser = await WorkspaceUser.get(req.ncWorkspaceId, user.id);

    if (!workspaceUser) {
      NcError.badRequest('Only user belonging to the workspace can be invited');
    }

    return await this.baseUsersService.userInvite({
      baseId,
      baseUser: body,
      req,
    });
  }
}
