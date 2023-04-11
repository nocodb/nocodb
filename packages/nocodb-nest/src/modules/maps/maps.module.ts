import { Module } from '@nestjs/common';
import { MapsService } from './maps.service';
import { MapsController } from './maps.controller';

@Module({
  controllers: [MapsController],
  providers: [MapsService],
})
export class MapsModule {}
