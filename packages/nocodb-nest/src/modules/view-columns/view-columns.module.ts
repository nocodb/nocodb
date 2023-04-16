import { Module } from '@nestjs/common';
import { ViewColumnsService } from '../../services/view-columns.service';
import { ViewColumnsController } from '../../controllers/view-columns.controller';

@Module({
  controllers: [ViewColumnsController],
  providers: [ViewColumnsService],
})
export class ViewColumnsModule {}
