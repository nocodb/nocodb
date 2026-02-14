import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ScimConfigService } from '../scim-config.service';

// ─── Mock Static Model ──────────────────────────────────────────────
// We mock the entire ScimConfig model so the service tests never hit a
// real database.  Each test can override return values via mockImplementation.

const mockScimConfigStore: Record<string, any> = {};

jest.mock('~/ee/models/ScimConfig', () => {
  return {
    __esModule: true,
    default: {
      get: jest.fn((_ctx: any, workspaceId: string) => {
        return Promise.resolve(mockScimConfigStore[workspaceId] ?? null);
      }),
      insert: jest.fn((_ctx: any, data: any) => {
        const id = `scim_cfg_${Date.now()}`;
        const record = { id, ...data };
        mockScimConfigStore[data.fk_workspace_id] = record;
        return Promise.resolve(record);
      }),
      update: jest.fn((_ctx: any, workspaceId: string, data: any) => {
        if (mockScimConfigStore[workspaceId]) {
          Object.assign(mockScimConfigStore[workspaceId], data);
        }
        return Promise.resolve(true);
      }),
      delete: jest.fn((_ctx: any, workspaceId: string) => {
        delete mockScimConfigStore[workspaceId];
        return Promise.resolve(true);
      }),
    },
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws_test_001';
const CONTEXT = { workspace_id: WORKSPACE_ID, base_id: null };

function seedConfig(overrides: Record<string, any> = {}) {
  mockScimConfigStore[WORKSPACE_ID] = {
    id: 'scim_cfg_seed',
    fk_workspace_id: WORKSPACE_ID,
    enabled: true,
    provisioning_token: 'tok_seed_abc123',
    base_url: `http://localhost:8080/api/v3/meta/workspaces/${WORKSPACE_ID}/scim/v2`,
    role_mapping: {},
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('ScimConfigService', () => {
  let service: ScimConfigService;

  beforeEach(async () => {
    // Clear store between tests
    Object.keys(mockScimConfigStore).forEach(
      (k) => delete mockScimConfigStore[k],
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [ScimConfigService],
    }).compile();

    service = module.get<ScimConfigService>(ScimConfigService);
  });

  // ── getConfig ────────────────────────────────────────────────────

  describe('getConfig', () => {
    it('should return config with masked token', async () => {
      seedConfig();

      const result = await service.getConfig(CONTEXT, WORKSPACE_ID);

      expect(result).toBeDefined();
      expect(result.provisioning_token).toBe('******');
      expect(result.token_exists).toBe(true);
      expect(result.fk_workspace_id).toBe(WORKSPACE_ID);
    });

    it('should set token_exists=false when no token', async () => {
      seedConfig({ provisioning_token: null });

      const result = await service.getConfig(CONTEXT, WORKSPACE_ID);

      expect(result.provisioning_token).toBeNull();
      expect(result.token_exists).toBe(false);
    });

    it('should throw notFound when config does not exist', async () => {
      await expect(
        service.getConfig(CONTEXT, 'ws_nonexistent'),
      ).rejects.toThrow();
    });
  });

  // ── initializeConfig ─────────────────────────────────────────────

  describe('initializeConfig', () => {
    it('should create a new config with disabled state and token', async () => {
      const result = await service.initializeConfig(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        siteUrl: 'http://localhost:8080',
      });

      expect(result).toBeDefined();
      expect(result.enabled).toBe(false);
      expect(result.provisioning_token).toBeDefined();
      expect(result.provisioning_token).not.toBe('******');
      // Token should be base64url (no +, /, or =)
      expect(result.provisioning_token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(result.base_url).toContain(WORKSPACE_ID);
      expect(result.base_url).toContain('/scim/v2');
    });

    it('should throw when config already exists', async () => {
      seedConfig();

      await expect(
        service.initializeConfig(CONTEXT, {
          workspaceId: WORKSPACE_ID,
          siteUrl: 'http://localhost:8080',
        }),
      ).rejects.toThrow();
    });

    it('should generate unique tokens per call', async () => {
      const result1 = await service.initializeConfig(CONTEXT, {
        workspaceId: 'ws_a',
        siteUrl: 'http://localhost:8080',
      });

      // Clear for second init
      delete mockScimConfigStore['ws_b'];
      const result2 = await service.initializeConfig(
        { workspace_id: 'ws_b', base_id: null },
        {
          workspaceId: 'ws_b',
          siteUrl: 'http://localhost:8080',
        },
      );

      expect(result1.provisioning_token).not.toBe(
        result2.provisioning_token,
      );
    });
  });

  // ── regenerateToken ──────────────────────────────────────────────

  describe('regenerateToken', () => {
    it('should return a new token', async () => {
      seedConfig();
      const oldToken = mockScimConfigStore[WORKSPACE_ID].provisioning_token;

      const result = await service.regenerateToken(CONTEXT, WORKSPACE_ID);

      expect(result.provisioning_token).toBeDefined();
      expect(result.provisioning_token).not.toBe(oldToken);
      expect(result.provisioning_token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should throw when no config exists', async () => {
      await expect(
        service.regenerateToken(CONTEXT, 'ws_nonexistent'),
      ).rejects.toThrow();
    });
  });

  // ── updateConfig ─────────────────────────────────────────────────

  describe('updateConfig', () => {
    it('should enable SCIM', async () => {
      seedConfig({ enabled: false });

      await service.updateConfig(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        config: { enabled: true },
      });

      expect(mockScimConfigStore[WORKSPACE_ID].enabled).toBe(true);
    });

    it('should update role_mapping', async () => {
      seedConfig();

      await service.updateConfig(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        config: { role_mapping: { admin: 'owner' } },
      });

      expect(mockScimConfigStore[WORKSPACE_ID].role_mapping).toEqual({
        admin: 'owner',
      });
    });

    it('should throw when config does not exist', async () => {
      await expect(
        service.updateConfig(CONTEXT, {
          workspaceId: 'ws_nonexistent',
          config: { enabled: true },
        }),
      ).rejects.toThrow();
    });
  });

  // ── validateToken ────────────────────────────────────────────────

  describe('validateToken', () => {
    it('should return true for correct token + enabled config', async () => {
      seedConfig({ enabled: true, provisioning_token: 'valid_tok' });

      const result = await service.validateToken(
        CONTEXT,
        WORKSPACE_ID,
        'valid_tok',
      );

      expect(result).toBe(true);
    });

    it('should return false for incorrect token', async () => {
      seedConfig({ enabled: true, provisioning_token: 'valid_tok' });

      const result = await service.validateToken(
        CONTEXT,
        WORKSPACE_ID,
        'wrong_tok',
      );

      expect(result).toBe(false);
    });

    it('should return false when SCIM is disabled', async () => {
      seedConfig({ enabled: false, provisioning_token: 'valid_tok' });

      const result = await service.validateToken(
        CONTEXT,
        WORKSPACE_ID,
        'valid_tok',
      );

      expect(result).toBe(false);
    });

    it('should return false when no config exists', async () => {
      const result = await service.validateToken(
        CONTEXT,
        'ws_nonexistent',
        'any_tok',
      );

      expect(result).toBe(false);
    });
  });

  // ── disableScim ──────────────────────────────────────────────────

  describe('disableScim', () => {
    it('should set enabled to false', async () => {
      seedConfig({ enabled: true });

      const result = await service.disableScim(CONTEXT, WORKSPACE_ID);

      expect(result.message).toContain('disabled');
      expect(mockScimConfigStore[WORKSPACE_ID].enabled).toBe(false);
    });
  });

  // ── deleteConfig ─────────────────────────────────────────────────

  describe('deleteConfig', () => {
    it('should remove the config completely', async () => {
      seedConfig();

      const result = await service.deleteConfig(CONTEXT, WORKSPACE_ID);

      expect(result.message).toContain('deleted');
      expect(mockScimConfigStore[WORKSPACE_ID]).toBeUndefined();
    });

    it('should throw when config does not exist', async () => {
      await expect(
        service.deleteConfig(CONTEXT, 'ws_nonexistent'),
      ).rejects.toThrow();
    });
  });
});
