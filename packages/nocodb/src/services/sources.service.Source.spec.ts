import { ClientType, IntegrationsType } from 'nocodb-sdk';
import * as helpers from '~/helpers';
import * as populateMetaHelpers from '~/helpers/populateMeta';
import * as syncMigrationHelpers from '~/helpers/syncMigration';
import { D1_BEST_EFFORT_WRITE_WARNING } from '~/helpers/clientTypes';
import { Base, Integration, Source } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { SourcesService } from './sources.service';

jest.mock('~/helpers', () => ({
  populateMeta: jest.fn(),
  validatePayload: jest.fn(),
}));

jest.mock('~/helpers/populateMeta', () => ({
  populateRollupColumnAndHideLTAR: jest.fn(),
}));

jest.mock('~/helpers/syncMigration', () => ({
  syncBaseMigration: jest.fn(),
}));

jest.mock('~/models', () => ({
  Base: {
    getWithInfo: jest.fn(),
  },
  Integration: {
    createIntegration: jest.fn(),
    get: jest.fn(),
  },
  Source: {
    createBase: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('~/Noco', () => ({
  __esModule: true,
  default: {
    ncMeta: {},
  },
}));

jest.mock('~/socket/NocoSocket', () => ({
  __esModule: true,
  default: {
    broadcastEvent: jest.fn(),
  },
}));

describe('SourcesService', () => {
  let service: SourcesService;
  let appHooksService: { emit: jest.Mock };

  const context = {
    workspace_id: 'workspace-id',
    base_id: 'base-id',
    socket_id: 'socket-id',
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

    service = new SourcesService(appHooksService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a D1 source from an integration without database/schema overrides and populates metadata', async () => {
    const base = { id: 'base-id' };
    const source = {
      id: 'source-id',
      alias: 'D1 Source',
      type: ClientType.D1,
      config: {},
      integration_config: {},
    };
    const integration = {
      id: 'integration-id',
      type: IntegrationsType.Database,
      sub_type: ClientType.D1,
    };

    jest.mocked(Base.getWithInfo).mockResolvedValue(base as any);
    jest.mocked(Integration.get).mockResolvedValue(integration as any);
    const createBase = jest
      .mocked(Source.createBase)
      .mockResolvedValue(source as any);
    jest.mocked(syncMigrationHelpers.syncBaseMigration).mockResolvedValue();
    const populateMeta = jest
      .mocked(helpers.populateMeta)
      .mockResolvedValue({ tables: [] } as any);
    const populateRollup = jest
      .mocked(populateMetaHelpers.populateRollupColumnAndHideLTAR)
      .mockResolvedValue(undefined);

    const result = await service.baseCreate(context, {
      baseId: 'base-id',
      source: {
        alias: ' D1 Source ',
        fk_integration_id: 'integration-id',
        config: {
          client: ClientType.D1,
          connection: {},
        },
      } as any,
      req,
    });

    expect(createBase).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        alias: 'D1 Source',
        baseId: 'base-id',
        type: ClientType.D1,
        fk_integration_id: 'integration-id',
        config: {
          client: ClientType.D1,
          connection: {},
          warnings: {
            d1: {
              bestEffortWrites: true,
              message: D1_BEST_EFFORT_WRITE_WARNING,
            },
          },
        },
      }),
    );
    expect(populateMeta).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ source, base, user: req.user }),
    );
    expect(populateRollup).toHaveBeenCalledWith(context, source, base);
    expect(result).toEqual({ source, error: undefined });
    expect(source.config).toBeUndefined();
    expect(source.integration_config).toBeUndefined();
    expect(appHooksService.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ context }),
    );
  });
});
