import { Module } from '@nestjs/common';
import { UtilsService } from '../../services/utils.service';
import { UtilsController } from '../../controllers/utils.controller';

@Module({
  controllers: [UtilsController],
  providers: [UtilsService],
})
export class UtilsModule {}
