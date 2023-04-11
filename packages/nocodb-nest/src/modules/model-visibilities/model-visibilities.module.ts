import { Module } from '@nestjs/common';
import { ModelVisibilitiesService } from './model-visibilities.service';
import { ModelVisibilitiesController } from './model-visibilities.controller';

@Module({
  controllers: [ModelVisibilitiesController],
  providers: [ModelVisibilitiesService],
})
export class ModelVisibilitiesModule {}
