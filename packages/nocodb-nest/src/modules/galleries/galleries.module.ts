import { Module } from '@nestjs/common';
import { GalleriesService } from './galleries.service';
import { GalleriesController } from './galleries.controller';

@Module({
  controllers: [GalleriesController],
  providers: [GalleriesService],
})
export class GalleriesModule {}
