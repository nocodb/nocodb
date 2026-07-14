import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { SharedBaseAccessRequestsController } from './shared-base-access-requests.controller';
import { SharedBaseAccessRequestsService } from '~/services/shared-base-access-requests.service';

describe('SharedBaseAccessRequestsController', () => {
  let controller: SharedBaseAccessRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SharedBaseAccessRequestsController],
      providers: [
        {
          provide: SharedBaseAccessRequestsService,
          useValue: {
            create: jest.fn(),
            getMine: jest.fn(),
            list: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(SharedBaseAccessRequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
