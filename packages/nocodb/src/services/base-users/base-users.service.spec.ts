import { Test } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import type { TestingModule } from '@nestjs/testing';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

describe('BaseUsersService', () => {
  let service: BaseUsersService;

  beforeEach(async () => {
    const eventEmitter = mock<IEventEmitter>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaseUsersService,
        AppHooksService,
        {
          provide: 'IEventEmitter',
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<BaseUsersService>(BaseUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
