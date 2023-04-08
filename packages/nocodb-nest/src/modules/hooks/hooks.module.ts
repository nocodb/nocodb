import { Module } from '@nestjs/common';
import { HooksService } from './hooks.service';
import { HooksController } from './hooks.controller';

@Module({
  controllers: [HooksController],
  providers: [HooksService]
})
export class HooksModule {}
