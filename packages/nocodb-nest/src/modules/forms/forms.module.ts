import { Module } from '@nestjs/common';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';

@Module({
  controllers: [FormsController],
  providers: [FormsService],
})
export class FormsModule {}
