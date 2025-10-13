import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import crypto from 'crypto';
import { OAuthClientType } from 'nocodb-sdk';
import init from '../../init';
import { createProject } from '../../factory/base';
import type { IInitContext } from '../../init';

// Helper functions
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function oauthTests() {
  let context: IInitContext;
  let baseId: string;
  let workspaceId: string;

  beforeEach(async function () {
    console.time('#### oauthTests');
    context = await init();

    const base = await createProject(context);
    baseId = base.id;

    if (process.env.EE === 'true') {
      workspaceId = context.fk_workspace_id;
    }
  });

  describe('OAuth Client Management', () => {
    it('Create OAuth Client - Public', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Test Public Client',
          client_type: 'public',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
      expect(response.body).to.not.have.property('client_secret');
    });

    it('Create OAuth Client - Confidential', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Test Confidential Client',
          client_type: 'confidential',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
      expect(response.body).to.have.property('client_secret');
    });

    it('Get OAuth Client by ID', async () => {
      const createResponse = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Test Client',
          client_type: 'public',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      const clientId = createResponse.body.client_id;

      const getResponse = await request(context.app)
        .get(`/api/v2/public/oauth/client/${clientId}`)
        .expect(200);

      expect(getResponse.body).to.have.property('client_id', clientId);
    });
  });

  describe('OAuth Token Exchange', () => {
    let clientId: string;
    let authCode: string;
    let codeVerifier: string;

    beforeEach(async () => {
      const clientResponse = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Test Token Client',
          client_type: 'public',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      clientId = clientResponse.body.client_id;
      codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      const authResponse = await request(context.app)
        .post('/api/v2/oauth/authorize')
        .set('xc-auth', context.token)
        .send({
          client_id: clientId,
          redirect_uri: 'https://example.com/callback',
          approved: true,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          base_id: baseId,
          ...(workspaceId && { workspace_id: workspaceId }),
        })
        .expect(201);

      const redirectUrl = new URL(authResponse.body.redirect_url);
      authCode = redirectUrl.searchParams.get('code');
    });

    it('Token Exchange - Valid Code', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          code_verifier: codeVerifier,
          client_id: clientId,
        })
        .expect(200);

      expect(response.body).to.have.property('access_token');
      expect(response.body).to.have.property('refresh_token');
      expect(response.body).to.have.property('token_type', 'Bearer');
      expect(response.body).to.have.property('expires_in');
      expect(response.body).to.have.property('refresh_expires_in');
    });

    it('Token Exchange - Invalid Code', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: 'invalid_code',
          redirect_uri: 'https://example.com/callback',
          code_verifier: codeVerifier,
          client_id: clientId,
        })
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('Token Exchange - Wrong PKCE Verifier', async () => {
      const wrongVerifier = generateCodeVerifier();
      const response = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          code_verifier: wrongVerifier,
          client_id: clientId,
        })
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_grant');
    });

    it('Token Exchange - Missing PKCE Verifier', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          client_id: clientId,
        })
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_request');
    });

    it('Token Exchange - Wrong Redirect URI', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://different.com/callback',
          code_verifier: codeVerifier,
          client_id: clientId,
        })
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_grant');
    });

    it('Token Exchange - Reuse Authorization Code', async () => {
      // First exchange - should succeed
      await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          code_verifier: codeVerifier,
          client_id: clientId,
        })
        .expect(200);

      // Second exchange with same code - should fail
      const response = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          code_verifier: codeVerifier,
          client_id: clientId,
        })
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_grant');
    });
  });

  describe('OAuth Token Refresh', () => {
    let clientId: string;
    let refreshToken: string;

    beforeEach(async () => {
      const clientResponse = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Test Refresh Client',
          client_type: 'public',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      clientId = clientResponse.body.client_id;
      const codeVerifier = generateCodeVerifier();

      const authResponse = await request(context.app)
        .post('/api/v2/oauth/authorize')
        .set('xc-auth', context.token)
        .send({
          client_id: clientId,
          redirect_uri: 'https://example.com/callback',
          approved: true,
          code_challenge: generateCodeChallenge(codeVerifier),
          code_challenge_method: 'S256',
          base_id: baseId,
          ...(workspaceId && { workspace_id: workspaceId }),
        })
        .expect(201);

      const authCode = new URL(authResponse.body.redirect_url).searchParams.get(
        'code',
      );

      const tokenResponse = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          code_verifier: codeVerifier,
          client_id: clientId,
        })
        .expect(200);

      refreshToken = tokenResponse.body.refresh_token;
    });

    it('Token Refresh - Valid Token', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
        })
        .expect(200);

      expect(response.body).to.have.property('access_token');
      expect(response.body).to.have.property('refresh_token');
      expect(response.body.refresh_token).to.not.equal(refreshToken);
    });

    it('Token Refresh - Invalid Token', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'refresh_token',
          refresh_token: 'invalid_refresh_token',
          client_id: clientId,
        })
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_grant');
    });

    it('Token Refresh - Reuse Old Refresh Token', async () => {
      const oldRefreshToken = refreshToken;

      // First refresh - should succeed
      const firstResponse = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'refresh_token',
          refresh_token: oldRefreshToken,
          client_id: clientId,
        })
        .expect(200);

      expect(firstResponse.body).to.have.property('refresh_token');

      // Try to reuse old refresh token - should fail
      const secondResponse = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'refresh_token',
          refresh_token: oldRefreshToken,
          client_id: clientId,
        })
        .expect(400);

      expect(secondResponse.body).to.have.property('error', 'invalid_grant');
    });
  });

  describe('OAuth Metadata', () => {
    it('Authorization Server Metadata', async () => {
      const response = await request(context.app)
        .get('/.well-known/oauth-authorization-server')
        .expect(200);

      expect(response.body).to.have.property('authorization_endpoint');
      expect(response.body).to.have.property('token_endpoint');
      expect(response.body).to.have.property(
        'code_challenge_methods_supported',
      );
    });

    it('Protected Resource Metadata', async () => {
      const response = await request(context.app)
        .get('/.well-known/oauth-protected-resource')
        .expect(200);

      expect(response.body).to.have.property('resource');
      expect(response.body).to.have.property('authorization_servers');
      expect(response.body.authorization_servers).to.be.an('array');
    });
  });

  describe('Dynamic Client Registration (DCR)', () => {
    it('Register Public Client - Minimal', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Minimal Public Client',
          client_type: OAuthClientType.PUBLIC,
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
      expect(response.body).to.have.property(
        'client_name',
        'Minimal Public Client',
      );
      expect(response.body).to.not.have.property('client_secret');
      expect(response.body).to.have.property('redirect_uris');
      expect(response.body.redirect_uris).to.include(
        'https://example.com/callback',
      );
    });

    it('Register Public Client - Full Metadata', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Full Metadata Client',
          redirect_uris: [
            'https://example.com/callback',
            'https://example.com/callback2',
          ],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          client_type: 'public',
          client_uri: 'https://example.com',
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
      expect(response.body).to.have.property(
        'client_name',
        'Full Metadata Client',
      );
      expect(response.body).to.have.property(
        'client_uri',
        'https://example.com',
      );
      expect(response.body).to.have.property('client_type', 'public');
      expect(response.body.redirect_uris).to.be.an('array');
      expect(response.body.redirect_uris).to.have.lengthOf(2);
    });

    it('Register Confidential Client', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Confidential Client',
          redirect_uris: ['https://example.com/callback'],
          client_type: 'confidential',
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
      expect(response.body).to.have.property('client_secret');
      expect(response.body).to.have.property('client_type', 'confidential');
      expect(response.body.client_secret).to.be.a('string');
      expect(response.body.client_secret.length).to.be.greaterThan(20);
    });

    it('Register Client - Multiple Redirect URIs', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Multi Redirect Client',
          redirect_uris: [
            'https://app1.example.com/callback',
            'https://app2.example.com/callback',
            'https://localhost:3000/callback',
          ],
        })
        .expect(201);

      expect(response.body.redirect_uris).to.be.an('array');
      expect(response.body.redirect_uris).to.have.lengthOf(3);
    });

    it('Register Client - Localhost Redirect URI', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Localhost Client',
          redirect_uris: ['http://localhost:8080/callback'],
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
      expect(response.body.redirect_uris).to.include(
        'http://localhost:8080/callback',
      );
    });

    it('Register Client - 127.0.0.1 Redirect URI', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Local IP Client',
          redirect_uris: ['http://127.0.0.1:3000/callback'],
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
    });

    it('Register Client - Missing Client Name (Uses Default)', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
      expect(response.body).to.have.property(
        'client_name',
        'Dynamically Registered Client',
      );
    });

    it('Register Client - Missing Redirect URIs', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'No Redirect Client',
        })
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_redirect_uri');
    });

    it('Register Client - Empty Redirect URIs', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Empty Redirect Client',
          redirect_uris: [],
        })
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_redirect_uri');
    });

    it('Register Client - HTTP Redirect URI (Not Localhost)', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'HTTP Client',
          redirect_uris: ['http://example.com/callback'],
        })
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_redirect_uri');
    });

    it('Register Client - Invalid URI Format', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Invalid URI Client',
          redirect_uris: ['not-a-valid-uri'],
        })
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_redirect_uri');
    });

    it('Register Client - URI with Fragment', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Fragment URI Client',
          redirect_uris: ['https://example.com/callback#fragment'],
        })
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_redirect_uri');
    });

    it('Register Client - Wrong Content-Type', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('client_name=Test&redirect_uris=https://example.com/callback')
        .expect(400);

      expect(response.body).to.have.property('error', 'invalid_request');
    });

    it('Register Client - Invalid Grant Type', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Invalid Grant Client',
          redirect_uris: ['https://example.com/callback'],
          grant_types: ['password', 'client_credentials'],
        })
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('Register Client - Invalid Response Type', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Invalid Response Client',
          redirect_uris: ['https://example.com/callback'],
          response_types: ['token', 'id_token'],
        })
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('Register Client - Invalid Client Type', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Invalid Type Client',
          redirect_uris: ['https://example.com/callback'],
          client_type: 'invalid_type',
        })
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('Register Client - Long Client Name', async () => {
      const longName = 'A'.repeat(200);
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: longName,
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
      expect(response.body.client_name).to.equal(longName);
    });

    it('Register Client - Special Characters in Name', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Test Client™ 🚀 (v2.0)',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
      expect(response.body.client_name).to.equal('Test Client™ 🚀 (v2.0)');
    });

    it('Register Client - With Logo URI', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Client With Logo',
          redirect_uris: ['https://example.com/callback'],
          client_uri: 'https://example.com',
          logo_uri:
            'https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg',
        })
        .expect(201);

      expect(response.body).to.have.property('client_id');
      expect(response.body).to.have.property(
        'client_uri',
        'https://example.com',
      );
      expect(response.body).to.have.property('logo_uri');
      expect(response.body.logo_uri).to.be.an('object');
      expect(response.body.logo_uri).to.have.property('signedPath');
      expect(response.body.logo_uri).to.have.property('title');
      expect(response.body.logo_uri).to.have.property('mimetype');
    });

    it('Register Client - With Invalid Logo URI', async () => {
      const response = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Client With Invalid Logo',
          redirect_uris: ['https://example.com/callback'],
          logo_uri: 'not-a-valid-url',
        })
        .expect(400);

      expect(response.body).to.have.property(
        'error',
        'invalid_client_metadata',
      );
      expect(response.body.error_description).to.include(
        'Failed to upload logo',
      );
    });

    it('Register and Use Client in Full OAuth Flow', async () => {
      // Register client via DCR
      const registerResponse = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'DCR Flow Test Client',
          redirect_uris: ['https://example.com/callback'],
          client_type: OAuthClientType.PUBLIC,
        })
        .expect(201);

      const clientId = registerResponse.body.client_id;
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      // Use registered client in authorization flow
      const authResponse = await request(context.app)
        .post('/api/v2/oauth/authorize')
        .set('xc-auth', context.token)
        .send({
          client_id: clientId,
          redirect_uri: 'https://example.com/callback',
          approved: true,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          base_id: baseId,
          ...(workspaceId && { workspace_id: workspaceId }),
        })
        .expect(201);

      expect(authResponse.body.redirect_url).to.include('code=');

      // Exchange code for tokens
      const authCode = new URL(authResponse.body.redirect_url).searchParams.get(
        'code',
      );

      const tokenResponse = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          code_verifier: codeVerifier,
          client_id: clientId,
        })
        .expect(200);

      expect(tokenResponse.body).to.have.property('access_token');
      expect(tokenResponse.body).to.have.property('refresh_token');
    });
  });

  describe('OAuth Authorization Flow', () => {
    let clientId: string;

    beforeEach(async () => {
      const clientResponse = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Test Auth Flow Client',
          client_type: 'public',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      clientId = clientResponse.body.client_id;
    });

    it('Authorization - User Denies Access', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      const response = await request(context.app)
        .post('/api/v2/oauth/authorize')
        .set('xc-auth', context.token)
        .send({
          client_id: clientId,
          redirect_uri: 'https://example.com/callback',
          approved: false,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          base_id: baseId,
          ...(workspaceId && { workspace_id: workspaceId }),
        })
        .expect(201);

      expect(response.body.redirect_url).to.include('error=access_denied');
    });

    it('Authorization - Invalid Client ID', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      const response = await request(context.app)
        .post('/api/v2/oauth/authorize')
        .set('xc-auth', context.token)
        .send({
          client_id: 'invalid_client_id',
          redirect_uri: 'https://example.com/callback',
          approved: true,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          base_id: baseId,
          ...(workspaceId && { workspace_id: workspaceId }),
        });

      // Should return error (either in body or redirect_url)
      const hasError =
        response.body.error ||
        (response.body.redirect_url &&
          response.body.redirect_url.includes('error='));
      expect(hasError).to.be.ok;
    });

    it('Authorization - Invalid Redirect URI', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      const response = await request(context.app)
        .post('/api/v2/oauth/authorize')
        .set('xc-auth', context.token)
        .send({
          client_id: clientId,
          redirect_uri: 'https://malicious.com/callback',
          approved: true,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          base_id: baseId,
          ...(workspaceId && { workspace_id: workspaceId }),
        });

      // Should return error (either in body or redirect_url)
      const hasError =
        response.body.error ||
        (response.body.redirect_url &&
          response.body.redirect_url.includes('error='));
      expect(hasError).to.be.ok;
    });

    it('Authorization - Without Base ID (Optional)', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      const response = await request(context.app)
        .post('/api/v2/oauth/authorize')
        .set('xc-auth', context.token)
        .send({
          client_id: clientId,
          redirect_uri: 'https://example.com/callback',
          approved: true,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          ...(workspaceId && { workspace_id: workspaceId }),
        })
        .expect(201);

      // Should succeed - base_id is optional
      expect(response.body).to.have.property('redirect_url');
      expect(response.body.redirect_url).to.include('code=');
    });
  });

  describe('OAuth Confidential Client Flow', () => {
    let clientId: string;
    let clientSecret: string;

    beforeEach(async () => {
      const clientResponse = await request(context.app)
        .post('/api/v2/oauth/register')
        .set('Content-Type', 'application/json')
        .send({
          client_name: 'Test Confidential Client',
          client_type: 'confidential',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(201);

      clientId = clientResponse.body.client_id;
      clientSecret = clientResponse.body.client_secret;
    });

    it('Confidential Client - Token Exchange with Secret', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      const authResponse = await request(context.app)
        .post('/api/v2/oauth/authorize')
        .set('xc-auth', context.token)
        .send({
          client_id: clientId,
          redirect_uri: 'https://example.com/callback',
          approved: true,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          base_id: baseId,
          ...(workspaceId && { workspace_id: workspaceId }),
        })
        .expect(201);

      const authCode = new URL(authResponse.body.redirect_url).searchParams.get(
        'code',
      );

      const tokenResponse = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          code_verifier: codeVerifier,
          client_id: clientId,
          client_secret: clientSecret,
        })
        .expect(200);

      expect(tokenResponse.body).to.have.property('access_token');
      expect(tokenResponse.body).to.have.property('refresh_token');
    });

    it('Confidential Client - Token Exchange with Wrong Secret', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      const authResponse = await request(context.app)
        .post('/api/v2/oauth/authorize')
        .set('xc-auth', context.token)
        .send({
          client_id: clientId,
          redirect_uri: 'https://example.com/callback',
          approved: true,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          base_id: baseId,
          ...(workspaceId && { workspace_id: workspaceId }),
        })
        .expect(201);

      const authCode = new URL(authResponse.body.redirect_url).searchParams.get(
        'code',
      );

      const tokenResponse = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          code_verifier: codeVerifier,
          client_id: clientId,
          client_secret: 'wrong_secret',
        })
        .expect(401);

      expect(tokenResponse.body).to.have.property('error');
      expect(tokenResponse.body.error).to.equal('invalid_client');
    });

    it('Confidential Client - Token Exchange without Secret', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      const authResponse = await request(context.app)
        .post('/api/v2/oauth/authorize')
        .set('xc-auth', context.token)
        .send({
          client_id: clientId,
          redirect_uri: 'https://example.com/callback',
          approved: true,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          base_id: baseId,
          ...(workspaceId && { workspace_id: workspaceId }),
        })
        .expect(201);

      const authCode = new URL(authResponse.body.redirect_url).searchParams.get(
        'code',
      );

      const tokenResponse = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          code_verifier: codeVerifier,
          client_id: clientId,
        })
        .expect(401);

      expect(tokenResponse.body).to.have.property('error');
      expect(tokenResponse.body.error).to.equal('invalid_client');
    });
  });
}

export default function () {
  describe('OAuth', oauthTests);
}
