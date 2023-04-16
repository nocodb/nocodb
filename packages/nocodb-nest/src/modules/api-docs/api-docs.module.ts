import { Module } from '@nestjs/common';
import { ApiDocsService } from '../api-docs.service';
import { ApiDocsController } from '../../controllers/api-docs/api-docs.controller';

@Module({
  controllers: [ApiDocsController],
  providers: [ApiDocsService],
})
export class ApiDocsModule {}
