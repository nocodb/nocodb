import { Module } from '@nestjs/common';
import { ProjectUsersService } from '../project-users/project-users.service';
import { OrgUsersService } from './org-users.service';
import { OrgUsersController } from './org-users.controller';

@Module({
  controllers: [OrgUsersController],
  providers: [OrgUsersService, ProjectUsersService],
})
export class OrgUsersModule {}
