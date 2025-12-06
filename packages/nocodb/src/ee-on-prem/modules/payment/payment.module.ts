import { Module } from '@nestjs/common';
import { PaymentModuleMetadata } from 'src/ee/modules/payment/payment.module';
import { PaymentService } from '~/modules/payment/payment.service';

@Module({
  ...PaymentModuleMetadata,
  providers: [PaymentService, ...PaymentModuleMetadata.providers],
  exports: [PaymentService, ...PaymentModuleMetadata.exports],
})
export class PaymentModule {}
