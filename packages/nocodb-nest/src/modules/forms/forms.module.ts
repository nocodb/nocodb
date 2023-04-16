import { Module } from '@nestjs/common';
import { FormsService } from '../../services/forms.service';
import { FormsController } from '../../controllers/forms.controller';

@Module({
  controllers: [FormsController],
  providers: [FormsService],
})
export class FormsModule {}
