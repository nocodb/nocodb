import { Test, TestingModule } from '@nestjs/testing';
import { OrgLcenseService } from './org-lcense.service';

describe('OrgLcenseService', () => {
  let service: OrgLcenseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrgLcenseService],
    }).compile();

    service = module.get<OrgLcenseService>(OrgLcenseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
