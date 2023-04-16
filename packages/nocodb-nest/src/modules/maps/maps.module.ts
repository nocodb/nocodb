import { Module } from '@nestjs/common';
import { MapsService } from '../../services/maps.service';
import { MapsController } from '../../controllers/maps.controller';

@Module({
  controllers: [MapsController],
  providers: [MapsService],
})
export class MapsModule {}
