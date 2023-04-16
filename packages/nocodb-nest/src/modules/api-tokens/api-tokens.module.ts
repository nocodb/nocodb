import { Module } from '@nestjs/common';
import { ApiTokensService } from '../../services/api-tokens.service';
import { ApiTokensController } from '../../controllers/api-tokens.controller';

@Module({
  controllers: [ApiTokensController],
  providers: [ApiTokensService],
})
export class ApiTokensModule {}
