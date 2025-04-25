import { Module } from '@nestjs/common';
import { ApiVersionNotFoundController } from '~/controllers/api-version-not-found.controller';
import { NotFoundV3Controller } from '~/controllers/v3/not-found-v3.controller';

@Module({
  controllers: [NotFoundV3Controller, ApiVersionNotFoundController],
})
export class NotFoundHandlerModule {}
