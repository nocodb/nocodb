import { Module } from '@nestjs/common';
import { AuditsService } from '../../services/audits.service';
import { AuditsController } from '../../controllers/audits.controller';

@Module({
  controllers: [AuditsController],
  providers: [AuditsService],
})
export class AuditsModule {}
