import { Module } from '@nestjs/common';
import { FormColumnsService } from '../../services/form-columns.service';
import { FormColumnsController } from '../../controllers/form-columns.controller';

@Module({
  controllers: [FormColumnsController],
  providers: [FormColumnsService],
})
export class FormColumnsModule {}
