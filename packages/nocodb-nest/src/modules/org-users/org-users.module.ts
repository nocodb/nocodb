import { Module } from '@nestjs/common';
import { OrgUsersService } from './org-users.service';
import { OrgUsersController } from './org-users.controller';

@Module({
  controllers: [OrgUsersController],
  providers: [OrgUsersService]
})
export class OrgUsersModule {}
