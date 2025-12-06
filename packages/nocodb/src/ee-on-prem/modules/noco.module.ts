import { nocoModuleEeMetadata } from 'src/ee/modules/noco.module';
import { type MiddlewareConsumer, Module } from '@nestjs/common';
import { PaymentModule } from '~/modules/payment/payment.module';
import { LicenseCheckMiddleware } from '~/middlewares/license-check/license-check.middleware';

@Module({
  ...nocoModuleEeMetadata,
  imports: [PaymentModule, ...nocoModuleEeMetadata.imports],
  providers: [LicenseCheckMiddleware, ...nocoModuleEeMetadata.providers],
  controllers: [...nocoModuleEeMetadata.controllers],
  exports: [PaymentModule, ...nocoModuleEeMetadata.exports],
})
export class NocoModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply license check middleware to all routes
    consumer.apply(LicenseCheckMiddleware).forRoutes('*');
  }
}
