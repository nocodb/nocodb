import { ClientType, IntegrationsType } from 'nocodb-sdk';
import { D1_BEST_EFFORT_WRITE_WARNING } from '~/helpers/clientTypes';
import { Integration } from '~/models';
import { IntegrationsService } from './integrations.service';

jest.mock('~/helpers', () => ({
  validatePayload: jest.fn(),
}));

jest.mock('~/helpers/exportImportHelpers', () => ({
  generateUniqueName: jest.fn((title: string) => title),
}));

jest.mock('~/models', () => ({
  Base: {
    get: jest.fn(),
  },
  Integration: {
    createIntegration: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    updateIntegration: jest.fn(),
  },
  IntegrationLink: {
    deleteByIntegration: jest.fn(),
  },
  Source: jest.fn().mockImplementation((source) => source),
}));

jest.mock('~/Noco', () => ({
  __esModule: true,
  default: {
    ncMeta: {},
  },
}));

jest.mock('~/cache/NocoCache', () => ({
  __esModule: true,
  default: {
    update: jest.fn(),
  },
}));

jest.mock('~/utils/common/NcConnectionMgrv2', () => ({
  __esModule: true,
  default: {
    resetSource: jest.fn(),
  },
}));

jest.mock('~/services/sources.service', () => ({
  SourcesService: jest.fn(),
}));

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let appHooksService: { emit: jest.Mock };

  const context = {
    workspace_id: 'workspace-id',
  } as any;

  const req = {
    user: {
      id: 'user-id',
    },
  };

  beforeEach(() => {
    appHooksService = {
      emit: jest.fn(),
    };

    service = new IntegrationsService(appHooksService as any, {} as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates D1 integrations with a best-effort write warning marker and no SQLite duplicate-file check', async () => {
    const createIntegration = jest
      .mocked(Integration.createIntegration)
      .mockResolvedValue({
        id: 'integration-id',
        title: 'Cloudflare D1',
        type: IntegrationsType.Database,
        sub_type: ClientType.D1,
        config: {},
      } as any);
    const listIntegrations = jest.mocked(Integration.list);

    const result = await service.integrationCreate(context, {
      integration: {
        title: ' Cloudflare D1 ',
        type: IntegrationsType.Database,
        sub_type: ClientType.D1,
        config: {
          client: ClientType.D1,
          connection: {
            accountId: 'account-id',
            databaseId: 'database-id',
            apiToken: 'api-token',
          },
        },
      } as any,
      req,
    });

    expect(listIntegrations).not.toHaveBeenCalled();
    expect(createIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cloudflare D1',
        sub_type: ClientType.D1,
        workspaceId: 'workspace-id',
        created_by: 'user-id',
        config: expect.objectContaining({
          client: ClientType.D1,
          warnings: {
            d1: {
              readWrite: true,
              atomicBatch: true,
              interactiveTransactions: false,
              ddlTransactions: false,
              bestEffortInteractiveWrites: true,
              atomicBatches: true,
              bestEffortWrites: true,
              message: D1_BEST_EFFORT_WRITE_WARNING,
            },
          },
        }),
      }),
      expect.anything(),
    );
    expect(result.config).toBeUndefined();
    expect(appHooksService.emit).toHaveBeenCalled();
  });
});
