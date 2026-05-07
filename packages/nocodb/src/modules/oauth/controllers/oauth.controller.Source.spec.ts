// Mock heavy dependencies to avoid ESM-only transitive imports
jest.mock('~/models', () => ({
  OAuthClient: {},
}));
jest.mock('~/Noco', () => ({}));
jest.mock('~/guards/global/global.guard', () => ({
  GlobalGuard: class {
    canActivate() {
      return true;
    }
  },
}));
jest.mock('~/guards/public-api-limiter.guard', () => ({
  PublicApiLimiterGuard: class {
    canActivate() {
      return true;
    }
  },
}));
jest.mock('~/guards/meta-api-limiter.guard', () => ({
  MetaApiLimiterGuard: class {
    canActivate() {
      return true;
    }
  },
}));
jest.mock('~/helpers/ncError', () => ({
  NcError: {
    notFound: jest.fn(),
    badRequest: jest.fn(),
  },
}));

import { Test } from '@nestjs/testing';
import { OAuthController } from './oauth.controller';
import { OauthAuthorizationService } from '~/modules/oauth/services/oauth-authorization.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';
import { OauthDiscoveryService } from '~/modules/oauth/services/oauth-discovery.service';
import { OauthDcrService } from '~/modules/oauth/services/oauth-dcr.service';
import type { TestingModule } from '@nestjs/testing';

describe('OAuthController', () => {
  let controller: OAuthController;
  let dcrService: OauthDcrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthController],
      providers: [
        OauthDiscoveryService,
        {
          provide: OauthAuthorizationService,
          useValue: {},
        },
        {
          provide: OauthTokenService,
          useValue: {},
        },
        {
          provide: OauthDcrService,
          useValue: {
            registerClient: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OAuthController>(OAuthController);
    dcrService = module.get<OauthDcrService>(OauthDcrService);
  });

  describe('discovery', () => {
    it('returns metadata with correct endpoints', async () => {
      const req = {
        headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'app.nocodb.com' },
        protocol: 'http',
        get: () => 'localhost:8080',
        ncSiteUrl: 'https://app.nocodb.com',
      } as any;

      const result = await controller.discovery(req);

      expect(result.issuer).toBe('https://app.nocodb.com');
      expect(result.registration_endpoint).toBe('https://app.nocodb.com/api/v2/oauth/register');
      expect(result.code_challenge_methods_supported).toEqual(['S256']);
    });
  });

  describe('register', () => {
    it('returns 201 with client data on successful registration', async () => {
      const mockClient = {
        client_id: 'abc123',
        client_name: 'Test',
        redirect_uris: ['https://example.com/cb'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        client_id_issued_at: Date.now(),
      };

      (dcrService.registerClient as jest.Mock).mockResolvedValue(mockClient);

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as any;

      await controller.register(
        { client_name: 'Test', redirect_uris: ['https://example.com/cb'] },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockClient);
    });
  });
});
