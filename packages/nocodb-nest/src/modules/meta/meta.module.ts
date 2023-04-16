import { Module } from '@nestjs/common';
import { ApiDocsController } from '../../controllers/api-docs/api-docs.controller'
import { ApiTokensController } from '../../controllers/api-tokens.controller'
import { ApiTokensService } from '../../services/api-tokens.service'
import { ApiDocsService } from '../api-docs.service'

@Module({})
export class MetaModule {
  controllers: [ApiDocsController, ApiTokensController],
  providers: [ApiDocsService, ApiTokensService],
}
