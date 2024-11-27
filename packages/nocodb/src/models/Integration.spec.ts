import { IntegrationsType } from 'nocodb-sdk';
import { Integration } from '~/models';
import { MetaTable } from '~/utils/globals';
import { decryptPropIfRequired, isEE } from '~/utils';

jest.mock('~/Noco');

const knexGenericMock = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  orWhereNull: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  clone: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
};

describe('Integration Model', () => {
  let integration: Integration;
  let mockNcMeta: jest.Mocked<any>;

  beforeEach(() => {
    mockNcMeta = {
      metaList: jest.fn(),
      metaGet2: jest.fn(),
      metaInsert2: jest.fn(),
      metaUpdate: jest.fn(),
      metaDelete: jest.fn(),
      metaGetNextOrder: jest.fn(),
    };
    integration = new Integration({
      id: 'test-id',
      title: 'Test Integration',
      base_id: 'project-1',
      ...(isEE ? { fk_workspace_id: 'workspace-1' } : {}),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should list integrations', async () => {
      const mockIntegrations = [
        { id: '1', title: 'Integration 1' },
        { id: '2', title: 'Integration 2' },
      ];
      // Mock the knex function
      mockNcMeta.knex = jest.fn().mockReturnValue({
        ...knexGenericMock,
        then: jest
          .fn()
          .mockImplementation((callback) =>
            Promise.resolve(callback(mockIntegrations)),
          ),
      });

      const result = await Integration.list(
        {
          userId: 'user-id',
          ...(isEE ? { workspaceId: 'workspace-id' } : {}),
        },
        mockNcMeta,
      );

      expect(result.list).toEqual(
        mockIntegrations.map((i) => expect.objectContaining(i)),
      );

      // Verify that knex was called with the correct table
      expect(mockNcMeta.knex).toHaveBeenCalledWith(MetaTable.INTEGRATIONS);

      // Verify the chain of method calls
      const knexMock = mockNcMeta.knex.mock.results[0].value;
      expect(knexMock.where).toHaveBeenCalled();
      expect(knexMock.orderBy).toHaveBeenCalledWith(
        'nc_integrations_v2.order',
        'asc',
      );
    });
  });

  describe('get', () => {
    it('should get an integration by id', async () => {
      const mockIntegration = { id: 'test-id', title: 'Test Integration' };
      mockNcMeta.metaGet2.mockResolvedValue(mockIntegration);

      const result = await Integration.get(
        {
          workspace_id: null,
        },
        'test-id',
        false,
        mockNcMeta,
      );

      expect(result).toBeInstanceOf(Integration);
      expect(result).toEqual(expect.objectContaining(mockIntegration));
      expect(mockNcMeta.metaGet2).toBeCalledWith(
        'bypass',
        'bypass',
        MetaTable.INTEGRATIONS,
        'test-id',
        null,
        isEE
          ? {
              _and: [
                {
                  _or: [
                    {
                      deleted: {
                        neq: true,
                      },
                    },
                    {
                      deleted: {
                        eq: null,
                      },
                    },
                  ],
                },
              ],
            }
          : { _or: [{ deleted: { neq: true } }, { deleted: { eq: null } }] },
      );
    });
  });

  describe('create', () => {
    it('should create a new integration', async () => {
      const newIntegration = {
        id: 'new-id',
        title: 'New Integration',
        workspaceId: 'workspace-1',
        config: {
          client: 'pg',
        },
      };
      mockNcMeta.metaInsert2.mockResolvedValue({
        ...newIntegration,
      });
      mockNcMeta.metaGet2.mockResolvedValue({
        ...newIntegration,
      });
      mockNcMeta.metaGetNextOrder.mockResolvedValue(2);

      const result = await Integration.createIntegration(
        newIntegration,
        mockNcMeta,
      );

      expect(result).toBeInstanceOf(Integration);
      expect(result).toEqual(
        expect.objectContaining({ id: 'new-id', ...newIntegration }),
      );
      expect(mockNcMeta.metaInsert2).toHaveBeenCalledWith(
        'workspace-1',
        'workspace',
        MetaTable.INTEGRATIONS,
        {
          ...newIntegration,
          order: 2,
          fk_workspace_id: 'workspace-1',
          workspaceId: undefined,
          id: undefined,
          config: JSON.stringify(newIntegration.config),
          is_encrypted: false,
        },
      );
    });
  });

  describe('create with encryption', () => {
    beforeAll(() => {
      process.env.NC_CONNECTION_ENCRYPT_KEY = 'test-secret';
    });

    afterAll(() => {
      process.env.NC_CONNECTION_ENCRYPT_KEY = undefined;
    });

    it('should create a new integration with encrypted config', async () => {
      const newIntegration = {
        id: 'new-id',
        title: 'New Integration',
        workspaceId: 'workspace-1',
        config: {
          client: 'pg',
        },
      };
      mockNcMeta.metaInsert2.mockResolvedValue({
        ...newIntegration,
      });
      mockNcMeta.metaInsert2.mockResolvedValue({
        ...newIntegration,
      });
      mockNcMeta.metaGet2.mockResolvedValue({
        ...newIntegration,
      });
      mockNcMeta.metaGetNextOrder.mockResolvedValue(2);

      const result = await Integration.createIntegration(
        newIntegration,
        mockNcMeta,
      );

      expect(result).toBeInstanceOf(Integration);
      expect(result).toEqual(
        expect.objectContaining({ id: 'new-id', ...newIntegration }),
      );

      // Extract the arguments used in the call
      const calledWithArgs = mockNcMeta.metaInsert2.mock.calls[0][3];

      // veify the 'config' field is encrypted
      expect(calledWithArgs.config).not.toEqual(
        JSON.stringify(newIntegration.config),
      );

      // Decrypt the 'config' field
      const decryptedConfig = decryptPropIfRequired({ data: calledWithArgs });

      // Verify the decrypted config matches the original integration
      expect(decryptedConfig).toEqual(newIntegration.config);
    });
  });

  describe('update', () => {
    it('should update an existing integration', async () => {
      const updateData = {
        title: 'Updated Integration',
        type: IntegrationsType.Database,
      };
      mockNcMeta.metaUpdate.mockResolvedValue({
        id: 'test-id',
        type: IntegrationsType.Database,
        ...updateData,
      });
      mockNcMeta.metaGet2.mockResolvedValue({
        id: 'test-id',
        type: IntegrationsType.Database,
        ...updateData,
      });

      await Integration.updateIntegration(
        isEE
          ? { workspace_id: 'workspace-1' }
          : {
              workspace_id: null,
            },
        'test-id',
        updateData,
        mockNcMeta,
      );

      expect(mockNcMeta.metaUpdate).toHaveBeenCalledWith(
        isEE ? 'workspace-1' : 'workspace',
        'workspace',
        MetaTable.INTEGRATIONS,
        updateData,
        integration.id,
      );
    });
  });

  describe('delete', () => {
    it('should delete an integration', async () => {
      mockNcMeta.knex = jest.fn().mockReturnValue({
        ...knexGenericMock,
        then: jest
          .fn()
          .mockImplementation((callback) => Promise.resolve(callback([]))),
      });

      await integration.delete(mockNcMeta);

      expect(mockNcMeta.metaDelete).toHaveBeenCalledWith(
        isEE ? 'workspace-1' : 'workspace',
        'workspace',
        MetaTable.INTEGRATIONS,
        integration.id,
      );
    });
  });
});
