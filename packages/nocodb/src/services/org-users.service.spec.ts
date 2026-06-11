import { Test } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import type { TestingModule } from '@nestjs/testing';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { OrgUsersService } from '~/services/org-users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

describe('OrgUsersService', () => {
  let service: OrgUsersService;

  beforeEach(async () => {
    const eventEmitter = mock<IEventEmitter>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgUsersService,
        AppHooksService,
        {
          provide: 'IEventEmitter',
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<OrgUsersService>(OrgUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
