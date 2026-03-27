import { OauthDcrService } from './oauth-dcr.service';
import { OAuthClient } from '~/models';
import { DcrRequestSchema } from '~/modules/oauth/dto/dcr.dto';

// Mock the OAuthClient model
jest.mock('~/models', () => ({
  OAuthClient: {
    insert: jest.fn(),
  },
}));

describe('OauthDcrService', () => {
  let service: OauthDcrService;
  const mockInsert = OAuthClient.insert as jest.Mock;

  beforeEach(() => {
    service = new OauthDcrService();
    jest.clearAllMocks();
  });

  describe('registerClient', () => {
    const validRequest = {
      client_name: 'Claude AI',
      redirect_uris: ['https://claude.ai/oauth/callback'],
      token_endpoint_auth_method: 'none' as const,
    };

    it('registers a public client when token_endpoint_auth_method is none', async () => {
      mockInsert.mockResolvedValue({
        client_id: 'test-client-id',
        client_name: 'Claude AI',
        client_type: 'public',
        redirect_uris: ['https://claude.ai/oauth/callback'],
        client_id_issued_at: expect.any(Number),
      });

      const result = await service.registerClient(validRequest);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_name: 'Claude AI',
          client_type: 'public',
          redirect_uris: ['https://claude.ai/oauth/callback'],
        }),
      );
      expect(result.client_id).toBe('test-client-id');
      expect(result.client_secret).toBeUndefined();
    });

    it('registers a confidential client when token_endpoint_auth_method is client_secret_post', async () => {
      const request = {
        ...validRequest,
        token_endpoint_auth_method: 'client_secret_post' as const,
      };

      mockInsert.mockResolvedValue({
        client_id: 'test-client-id',
        client_secret: 'generated-secret',
        client_name: 'My App',
        client_type: 'confidential',
        redirect_uris: ['https://claude.ai/oauth/callback'],
        client_id_issued_at: expect.any(Number),
      });

      const result = await service.registerClient(request);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_type: 'confidential',
        }),
      );
      expect(result.client_id).toBeDefined();
    });

    it('defaults to public client when token_endpoint_auth_method is omitted', async () => {
      const request = {
        client_name: 'Some Agent',
        redirect_uris: ['https://agent.example.com/cb'],
      };

      mockInsert.mockResolvedValue({
        client_id: 'test-id',
        client_name: 'Some Agent',
        client_type: 'public',
        redirect_uris: ['https://agent.example.com/cb'],
        client_id_issued_at: expect.any(Number),
      });

      await service.registerClient(request);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_type: 'public',
        }),
      );
    });

    it('creates confidential client with secret when client_secret_post is sent via DCR', async () => {
      const request = {
        client_name: 'Claude AI',
        redirect_uris: ['https://claude.ai/oauth/callback'],
        token_endpoint_auth_method: 'client_secret_post' as const,
      };

      mockInsert.mockResolvedValue({
        client_id: 'test-id',
        client_secret: 'new-secret',
        client_name: 'Claude AI',
        client_type: 'confidential',
        redirect_uris: ['https://claude.ai/oauth/callback'],
        client_id_issued_at: expect.any(Number),
      });

      const result = await service.registerClient(request);
      expect(result.client_id).toBeDefined();
      expect(result.client_secret).toBe('new-secret');
    });
  });

  describe('DcrRequestSchema validation', () => {
    it('rejects empty redirect_uris', () => {
      const result = DcrRequestSchema.safeParse({
        client_name: 'Test',
        redirect_uris: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid redirect URIs', () => {
      const result = DcrRequestSchema.safeParse({
        client_name: 'Test',
        redirect_uris: ['not-a-url'],
      });
      expect(result.success).toBe(false);
    });

    it('accepts minimal valid request', () => {
      const result = DcrRequestSchema.safeParse({
        client_name: 'Test',
        redirect_uris: ['https://example.com/callback'],
      });
      expect(result.success).toBe(true);
    });
  });
});
