import { Module } from '@nestjs/common';
import { MetaDiffsService } from './meta-diffs.service';
import { MetaDiffsController } from './meta-diffs.controller';

@Module({
  controllers: [MetaDiffsController],
  providers: [MetaDiffsService]
})
export class MetaDiffsModule {}
