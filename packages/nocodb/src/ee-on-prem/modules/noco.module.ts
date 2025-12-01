import { nocoModuleEeMetadata } from 'src/ee/modules/noco.module';
import { Module } from '@nestjs/common';
import { PaymentModule } from '~/modules/payment/payment.module';

@Module({
  ...nocoModuleEeMetadata,
  imports: [PaymentModule, ...nocoModuleEeMetadata.imports],
  providers: [...nocoModuleEeMetadata.providers],
  controllers: [...nocoModuleEeMetadata.controllers],
  exports: [PaymentModule, ...nocoModuleEeMetadata.exports],
})
export class NocoModule {}
