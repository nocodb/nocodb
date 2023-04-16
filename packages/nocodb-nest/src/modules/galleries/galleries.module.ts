import { Module } from '@nestjs/common';
import { GalleriesService } from '../../services/galleries.service';
import { GalleriesController } from '../../controllers/galleries.controller';

@Module({
  controllers: [GalleriesController],
  providers: [GalleriesService],
})
export class GalleriesModule {}
