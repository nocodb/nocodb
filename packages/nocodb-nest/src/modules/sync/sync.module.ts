import { Module } from '@nestjs/common';
import { SyncService } from '../../services/sync.service';
import { SyncController } from '../../controllers/sync.controller';

@Module({
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
