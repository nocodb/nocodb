import { Module } from '@nestjs/common';
import { MetaDiffsService } from '../../services/meta-diffs.service';
import { MetaDiffsController } from '../../controllers/meta-diffs.controller';

@Module({
  controllers: [MetaDiffsController],
  providers: [MetaDiffsService],
})
export class MetaDiffsModule {}
