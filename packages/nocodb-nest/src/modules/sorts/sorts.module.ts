import { Module } from '@nestjs/common';
import { SortsService } from './sorts.service';
import { SortsController } from './sorts.controller';

@Module({
  controllers: [SortsController],
  providers: [SortsService],
})
export class SortsModule {}
