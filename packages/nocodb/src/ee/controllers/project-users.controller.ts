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
import { ProjectUsersController as ProjectUsersControllerCE } from 'src/controllers/project-users.controller';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ProjectUsersService } from '~/services/project-users/project-users.service';
import { User, WorkspaceUser } from '~/models';
import { NcError } from '~/helpers/catchError';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@UseGuards(GlobalGuard)
@Controller()
export class ProjectUsersController extends ProjectUsersControllerCE {
  constructor(protected readonly projectUsersService: ProjectUsersService) {
    super(projectUsersService);
  }

  @Post('/api/v1/db/meta/projects/:projectId/users')
  @HttpCode(200)
  @Acl('userInvite')
  async userInvite(
    @Param('projectId') projectId: string,
    @Request() req,
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

    return await this.projectUsersService.userInvite({
      projectId,
      projectUser: body,
      req,
    });
  }
}
