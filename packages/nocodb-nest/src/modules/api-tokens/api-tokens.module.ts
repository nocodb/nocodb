import { Module } from '@nestjs/common';
import { ApiTokensService } from './api-tokens.service';
import { ApiTokensController } from './api-tokens.controller';

@Module({
  controllers: [ApiTokensController],
  providers: [ApiTokensService]
})
export class ApiTokensModule {}
