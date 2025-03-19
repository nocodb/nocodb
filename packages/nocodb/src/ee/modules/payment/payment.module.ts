import { forwardRef, Module } from '@nestjs/common';

import { PaymentController } from '~/modules/payment/payment.controller';
import { PaymentService } from '~/modules/payment/payment.service';
import { NocoModule } from '~/modules/noco.module';

export const PaymentModuleMetadata = {
  imports: [forwardRef(() => NocoModule)],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
};

@Module(PaymentModuleMetadata)
export class PaymentModule {}
