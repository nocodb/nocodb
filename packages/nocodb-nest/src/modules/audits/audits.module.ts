import { Module } from '@nestjs/common';
import { AuditsService } from './audits.service';
import { AuditsController } from './audits.controller';

@Module({
  controllers: [AuditsController],
  providers: [AuditsService],
})
export class AuditsModule {}
