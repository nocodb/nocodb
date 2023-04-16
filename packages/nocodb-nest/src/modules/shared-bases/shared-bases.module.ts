import { Module } from '@nestjs/common';
import { SharedBasesService } from '../../services/shared-bases.service';
import { SharedBasesController } from '../../controllers/shared-bases.controller';

@Module({
  controllers: [SharedBasesController],
  providers: [SharedBasesService],
})
export class SharedBasesModule {}
