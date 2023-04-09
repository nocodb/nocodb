import { Test, TestingModule } from '@nestjs/testing';
import { PublicMetasService } from './public-metas.service';

describe('PublicMetasService', () => {
  let service: PublicMetasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicMetasService],
    }).compile();

    service = module.get<PublicMetasService>(PublicMetasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
