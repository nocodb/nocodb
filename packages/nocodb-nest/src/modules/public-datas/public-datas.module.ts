import multer from 'multer';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { NC_ATTACHMENT_FIELD_SIZE } from '../../constants';
import { PublicDatasService } from '../../services/public-datas.service';
import { PublicDatasController } from '../../controllers/public-datas.controller';

@Module({
  imports: [
    MulterModule.register({
      storage: multer.diskStorage({}),
      limits: {
        fieldSize: NC_ATTACHMENT_FIELD_SIZE,
      },
    }),
  ],
  controllers: [PublicDatasController],
  providers: [PublicDatasService],
})
export class PublicDatasModule {}
