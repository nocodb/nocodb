import { Module } from '@nestjs/common';
import { CachesService } from './caches.service';
import { CachesController } from './caches.controller';

@Module({
  controllers: [CachesController],
  providers: [CachesService]
})
export class CachesModule {}
