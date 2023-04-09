import { Test, TestingModule } from '@nestjs/testing';
import { FormColumnsService } from './form-columns.service';

describe('FormColumnsService', () => {
  let service: FormColumnsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FormColumnsService],
    }).compile();

    service = module.get<FormColumnsService>(FormColumnsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
