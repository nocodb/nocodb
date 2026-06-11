import { Test } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import type { TestingModule } from '@nestjs/testing';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import type { MetaService } from '~/meta/meta.service';
import { BasesService } from '~/services/bases.service';
import { UsersService } from '~/services/users/users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { WorkspacesService } from '~/ee/services/workspaces.service';
import { TablesService } from '~/services/tables.service';
import { ColumnsService } from '~/services/columns.service';
import { MetaDiffsService } from '~/services/meta-diffs.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const eventEmitter = mock<IEventEmitter>();
    const metaService = mock<MetaService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppHooksService,
        WorkspacesService,
        BasesService,
        TablesService,
        ColumnsService,
        MetaDiffsService,
        {
          provide: 'IEventEmitter',
          useValue: eventEmitter,
        },
        {
          provide: 'MetaService',
          useValue: metaService,
        },
        {
          provide: 'JobsService',
          useValue: {},
        },
        UsersService,
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
