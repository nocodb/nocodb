import { Module } from '@nestjs/common';
import { PagesService } from './page/pages.service';
import { PagesController } from './page/pages.controller';

@Module({
  controllers: [PagesController],
  providers: [PagesService],
})
export class DocsModule {}
