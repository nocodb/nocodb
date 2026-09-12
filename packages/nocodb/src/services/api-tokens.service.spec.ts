import { Test } from '@nestjs/testing';
import { ApiTokensService } from '~/services/api-tokens.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import type { TestingModule } from '@nestjs/testing';
import { ApiToken } from '~/models';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';
import { OrgUserRoles } from 'nocodb-sdk';

jest.mock('~/models', () => ({
  ApiToken: {
    get: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
    list: jest.fn(),
    listForNonSsoUser: jest.fn(),
    listWithCreatedBy: jest.fn(),
    count: jest.fn(),
  },
}));

jest.mock('~/helpers/catchError', () => ({
  NcError: {
    notFound: jest.fn(),
    _: { notFound: jest.fn() },
  },
}));

jest.mock('~/helpers', () => ({
  validatePayload: jest.fn(),
}));

jest.mock('~/services/app-hooks/app-hooks.service', () => ({
  AppHooksService: jest.fn().mockImplementation(() => ({
    emit: jest.fn(),
  })),
}));

describe('ApiTokensService', () => {
  let service: ApiTokensService;
  const notFoundSpy = NcError.notFound as unknown as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    // The real NcError.notFound always throws (return type `never`).
    notFoundSpy.mockImplementation(() => {
      throw new Error('Token not found');
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiTokensService,
        {
          provide: AppHooksService,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ApiTokensService>(ApiTokensService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('apiTokenDelete', () => {
    it('should return 404 (notFound) when the token does not exist', async () => {
      (ApiToken.get as jest.Mock).mockResolvedValue(undefined);

      const user = {
        id: 'user-1',
        roles: JSON.stringify({ [OrgUserRoles.SUPER_ADMIN]: true }),
      };

      await expect(
        service.apiTokenDelete({
          tokenId: 'missing-token',
          user: user as any,
          req: {} as any,
        }),
      ).rejects.toThrow('Token not found');

      expect(notFoundSpy).toHaveBeenCalledWith('Token not found');
      // The ownership check and emit must never dereference an undefined token.
      expect(ApiToken.delete).not.toHaveBeenCalled();
    });

    it('should delete the token when it exists and belongs to the user', async () => {
      (ApiToken.get as jest.Mock).mockResolvedValue({
        id: 'token-1',
        description: 'my token',
        fk_user_id: 'user-1',
      });
      (ApiToken.delete as jest.Mock).mockResolvedValue({ id: 'token-1' });

      const user = {
        id: 'user-1',
        roles: JSON.stringify({ [OrgUserRoles.VIEWER]: true }),
      };

      const res = await service.apiTokenDelete({
        tokenId: 'token-1',
        user: user as any,
        req: {} as any,
      });

      expect(notFoundSpy).not.toHaveBeenCalled();
      expect(ApiToken.delete).toHaveBeenCalledWith('token-1');
      expect(res).toEqual({ id: 'token-1' });
    });
  });
});
