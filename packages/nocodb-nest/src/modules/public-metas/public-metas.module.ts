import { Module } from '@nestjs/common';
import { PublicMetasService } from './public-metas.service';
import { PublicMetasController } from './public-metas.controller';

@Module({
  controllers: [PublicMetasController],
  providers: [PublicMetasService],
})
export class PublicMetasModule {}
