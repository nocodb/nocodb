import { Module } from '@nestjs/common';
import { ModelVisibilitiesService } from '../../services/model-visibilities.service';
import { ModelVisibilitiesController } from '../../controllers/model-visibilities.controller';

@Module({
  controllers: [ModelVisibilitiesController],
  providers: [ModelVisibilitiesService],
})
export class ModelVisibilitiesModule {}
