import { Module } from '@nestjs/common';
import { BasesService } from './bases.service';
import { BasesController } from './bases.controller';

@Module({
  controllers: [BasesController],
  providers: [BasesService],
})
export class BasesModule {}
