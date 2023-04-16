import { Module } from '@nestjs/common';
import { PublicMetasService } from '../../services/public-metas.service';
import { PublicMetasController } from '../../controllers/public-metas.controller';

@Module({
  controllers: [PublicMetasController],
  providers: [PublicMetasService],
})
export class PublicMetasModule {}
