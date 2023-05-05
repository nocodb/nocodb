import { Test } from '@nestjs/testing';
import { PublicMetasService } from '../services/public-metas.service';
import { PublicMetasController } from './public-metas.controller';
import type { TestingModule } from '@nestjs/testing';

describe('PublicMetasController', () => {
  let controller: PublicMetasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicMetasController],
      providers: [PublicMetasService],
    }).compile();

    controller = module.get<PublicMetasController>(PublicMetasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
