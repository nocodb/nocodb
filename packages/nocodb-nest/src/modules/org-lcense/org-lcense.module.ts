import { Module } from '@nestjs/common';
import { OrgLcenseService } from './org-lcense.service';
import { OrgLcenseController } from './org-lcense.controller';

@Module({
  controllers: [OrgLcenseController],
  providers: [OrgLcenseService],
})
export class OrgLcenseModule {}
