import { Module } from '@nestjs/common';
import { ProjectUsersService } from '../project-users/project-users.service';
import { OrgUsersService } from '../../services/org-users.service';
import { OrgUsersController } from '../../controllers/org-users.controller';

@Module({
  controllers: [OrgUsersController],
  providers: [OrgUsersService, ProjectUsersService],
})
export class OrgUsersModule {}
