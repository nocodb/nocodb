import { Module } from '@nestjs/common';
import { PublicDocsController } from './public-docs.controller';
import { PublicDocsService } from './public-docs.service';

@Module({
  controllers: [PublicDocsController],
  providers: [PublicDocsService],
})
export class PublicDocsModule {}
