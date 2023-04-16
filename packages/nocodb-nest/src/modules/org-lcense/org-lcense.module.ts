import { Module } from '@nestjs/common';
import { OrgLcenseService } from '../../services/org-lcense.service';
import { OrgLcenseController } from '../../controllers/org-lcense.controller';

@Module({
  controllers: [OrgLcenseController],
  providers: [OrgLcenseService],
})
export class OrgLcenseModule {}
