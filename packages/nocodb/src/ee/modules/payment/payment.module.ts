import { Module } from '@nestjs/common';

import { PaymentController } from '~/modules/payment/payment.controller';
import { PaymentService } from '~/modules/payment/payment.service';

export const PaymentModuleMetadata = {
  imports: [],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
};

@Module(PaymentModuleMetadata)
export class PaymentModule {}
