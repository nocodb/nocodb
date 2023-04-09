import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
  controllers: [SyncController],
  providers: [SyncService]
})
export class SyncModule {}
