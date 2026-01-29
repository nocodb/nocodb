import { Octokit } from 'octokit';
import { AuthType } from '~/integrations/auth/auth.helpers';
import GithubAuthIntegration from '../entry';

jest.mock('octokit', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      // Mock Octokit instance methods if needed
    })),
  };
});

jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({
    data: {
      access_token: 'mock-oauth-token',
    },
  }),
}));

describe('GithubAuthIntegration', () => {
  let githubAuth: GithubAuthIntegration;

  beforeEach(() => {
    githubAuth = new GithubAuthIntegration();
  });

  describe('authenticate', () => {
    it('should authenticate with API key', async () => {
      const mockToken = 'test-api-token';
      const result = await githubAuth.authenticate({
        type: AuthType.ApiKey,
        token: mockToken,
      });

      expect(result.custom).toBeInstanceOf(Octokit);
    });

    it('should authenticate with OAuth token', async () => {
      const mockOAuthToken = 'test-oauth-token';
      const result = await githubAuth.authenticate({
        type: AuthType.OAuth,
        oauth_token: mockOAuthToken,
      });

      expect(result.custom).toBeInstanceOf(Octokit);
    });

    it('should throw error for unsupported auth type', async () => {
      await expect(
        githubAuth.authenticate({
          type: 'unsupported' as AuthType,
          token: 'test-token',
        }),
      ).rejects.toThrow('Not implemented');
    });
  });

  describe('exchangeToken', () => {
    it('should exchange code for OAuth token', async () => {
      const mockCode = 'test-code';
      const result = await githubAuth.exchangeToken({ code: mockCode });

      expect(result).toHaveProperty('oauth_token');
      expect(result.oauth_token).toBe('mock-oauth-token');
    });
  });
}); 