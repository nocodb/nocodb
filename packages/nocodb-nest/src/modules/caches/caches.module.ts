import { Module } from '@nestjs/common';
import { CachesService } from '../../services/caches.service';
import { CachesController } from '../../controllers/caches.controller';

@Module({
  controllers: [CachesController],
  providers: [CachesService],
})
export class CachesModule {}
