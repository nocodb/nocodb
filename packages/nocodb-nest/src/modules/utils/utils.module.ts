import { Module } from '@nestjs/common';
import { UtilsService } from './utils.service';
import { UtilsController } from './utils.controller';

@Module({
  controllers: [UtilsController],
  providers: [UtilsService],
})
export class UtilsModule {}
