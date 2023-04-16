import { Module } from '@nestjs/common';
import { BasesService } from '../../services/bases.service';
import { BasesController } from '../../controllers/bases.controller';

@Module({
  controllers: [BasesController],
  providers: [BasesService],
})
export class BasesModule {}
