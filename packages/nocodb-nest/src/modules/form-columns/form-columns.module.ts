import { Module } from '@nestjs/common';
import { FormColumnsService } from './form-columns.service';
import { FormColumnsController } from './form-columns.controller';

@Module({
  controllers: [FormColumnsController],
  providers: [FormColumnsService]
})
export class FormColumnsModule {}
