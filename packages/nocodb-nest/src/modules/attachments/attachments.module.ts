import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';
import { NC_ATTACHMENT_FIELD_SIZE } from '../../constants';
import { AttachmentsService } from '../../services/attachments.service';
import { AttachmentsController } from '../../controllers/attachments.controller';

@Module({
  imports: [
    MulterModule.register({
      storage: multer.diskStorage({}),
      limits: {
        fieldSize: NC_ATTACHMENT_FIELD_SIZE,
      },
    }),
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
