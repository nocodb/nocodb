import { Test, TestingModule } from '@nestjs/testing';
import { PublicDatasService } from './public-datas.service';

describe('PublicDatasService', () => {
  let service: PublicDatasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicDatasService],
    }).compile();

    service = module.get<PublicDatasService>(PublicDatasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
