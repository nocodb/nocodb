import { Module } from '@nestjs/common';
import { KanbansService } from './kanbans.service';
import { KanbansController } from './kanbans.controller';

@Module({
  controllers: [KanbansController],
  providers: [KanbansService],
})
export class KanbansModule {}
