import { OauthDiscoveryService } from './oauth-discovery.service';

describe('OauthDiscoveryService', () => {
  let service: OauthDiscoveryService;

  beforeEach(() => {
    service = new OauthDiscoveryService();
  });

  describe('getMetadata', () => {
    it('returns RFC 8414 compliant metadata', () => {
      const issuer = 'https://my-nocodb.example.com';
      const meta = service.getMetadata(issuer);

      expect(meta.issuer).toBe(issuer);
      expect(meta.authorization_endpoint).toBe(`${issuer}/api/v2/oauth/authorize`);
      expect(meta.token_endpoint).toBe(`${issuer}/api/v2/oauth/token`);
      expect(meta.revocation_endpoint).toBe(`${issuer}/api/v2/oauth/revoke`);
      expect(meta.registration_endpoint).toBe(`${issuer}/api/v2/oauth/register`);
      expect(meta.response_types_supported).toEqual(['code']);
      expect(meta.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
      expect(meta.token_endpoint_auth_methods_supported).toEqual(['client_secret_post', 'none']);
      expect(meta.code_challenge_methods_supported).toEqual(['S256']);
      expect(meta.scopes_supported).toBeDefined();
      expect(meta.scopes_supported.length).toBeGreaterThan(0);
    });

    it('handles issuer with trailing slash', () => {
      const meta = service.getMetadata('https://example.com/');
      expect(meta.issuer).toBe('https://example.com');
      expect(meta.authorization_endpoint).toBe('https://example.com/api/v2/oauth/authorize');
    });
  });

  describe('getResourceMetadata (RFC 9728)', () => {
    it('returns protected resource metadata pointing to MCP endpoint', () => {
      const issuer = 'https://my-nocodb.example.com';
      const meta = service.getResourceMetadata(issuer);

      expect(meta.resource).toBe(`${issuer}/mcp`);
      expect(meta.authorization_servers).toEqual([issuer]);
      expect(meta.bearer_methods_supported).toEqual(['header']);
    });

    it('handles issuer with trailing slash', () => {
      const meta = service.getResourceMetadata('https://example.com/');
      expect(meta.resource).toBe('https://example.com/mcp');
      expect(meta.authorization_servers).toEqual(['https://example.com']);
    });
  });
});
