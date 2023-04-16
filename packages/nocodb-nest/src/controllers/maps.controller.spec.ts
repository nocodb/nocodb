import { Test } from '@nestjs/testing';
import { MapsController } from './maps.controller';
import { MapsService } from '../services/maps.service';
import type { TestingModule } from '@nestjs/testing';

describe('MapsController', () => {
  let controller: MapsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MapsController],
      providers: [MapsService],
    }).compile();

    controller = module.get<MapsController>(MapsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
