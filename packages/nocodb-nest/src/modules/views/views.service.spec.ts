import { Test, TestingModule } from '@nestjs/testing';
import { ViewsService } from './views.service';

describe('ViewsService', () => {
  let service: ViewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ViewsService],
    }).compile();

    service = module.get<ViewsService>(ViewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
