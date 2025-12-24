import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import crypto from 'crypto';
import { NO_SCOPE } from 'nocodb-sdk';
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
        .post(
          `/api/v2/internal/${NO_SCOPE}/${NO_SCOPE}?operation=oAuthClientCreate`,
        )
        .set('xc-auth', context.token)
        .send({
          client_name: 'Test Public Client',
          client_type: 'public',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(200);
      expect(response.body).to.have.property('client_id');
      expect(response.body).to.have.property('client_secret').to.be.null;
    });

    it('Create OAuth Client - Confidential', async () => {
      const response = await request(context.app)
        .post(
          `/api/v2/internal/${NO_SCOPE}/${NO_SCOPE}?operation=oAuthClientCreate`,
        )
        .set('xc-auth', context.token)
        .send({
          client_name: 'Test Confidential Client',
          client_type: 'confidential',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(200);

      expect(response.body).to.have.property('client_id');
      expect(response.body).to.have.property('client_secret');
    });

    it('Get OAuth Client by ID', async () => {
      const createResponse = await request(context.app)
        .post(
          `/api/v2/internal/${NO_SCOPE}/${NO_SCOPE}?operation=oAuthClientCreate`,
        )
        .set('xc-auth', context.token)
        .send({
          client_name: 'Test Client',
          client_type: 'public',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(200);

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
        .post(
          `/api/v2/internal/${NO_SCOPE}/${NO_SCOPE}?operation=oAuthClientCreate`,
        )
        .set('xc-auth', context.token)
        .send({
          client_name: 'Test Token Client',
          client_type: 'public',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(200);

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
        .post(
          `/api/v2/internal/${NO_SCOPE}/${NO_SCOPE}?operation=oAuthClientCreate`,
        )
        .set('xc-auth', context.token)
        .send({
          client_name: 'Test Refresh Client',
          client_type: 'public',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(200);

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

  describe('OAuth Authorization Flow', () => {
    let clientId: string;

    beforeEach(async () => {
      const clientResponse = await request(context.app)
        .post(
          `/api/v2/internal/${NO_SCOPE}/${NO_SCOPE}?operation=oAuthClientCreate`,
        )
        .set('xc-auth', context.token)
        .send({
          client_name: 'Test Auth Flow Client',
          client_type: 'public',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(200);

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
        .post(
          `/api/v2/internal/${NO_SCOPE}/${NO_SCOPE}?operation=oAuthClientCreate`,
        )
        .set('xc-auth', context.token)
        .send({
          client_name: 'Test Confidential Client',
          client_type: 'confidential',
          redirect_uris: ['https://example.com/callback'],
        })
        .expect(200);

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

    it('Confidential Client - Token Exchange with PKCE (No Secret Required)', async () => {
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

      // With PKCE, client_secret is optional for confidential clients
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

    it('Confidential Client - Token Exchange without code_verifier (Required)', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      // Create authorization with PKCE
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

      // Try to exchange without code_verifier - should fail (PKCE is mandatory)
      const tokenResponse = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://example.com/callback',
          client_id: clientId,
          client_secret: clientSecret,
        })
        .expect(400);

      expect(tokenResponse.body).to.have.property('error');
      expect(tokenResponse.body.error).to.equal('invalid_request');
      expect(tokenResponse.body.error_description).to.include('code_verifier');
    });

    it('Confidential Client - Token Exchange with PKCE and Secret (Both Valid)', async () => {
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

      // With PKCE, client can optionally provide client_secret for extra security
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

    it('Confidential Client - Token Exchange with PKCE and Wrong Secret', async () => {
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

      // If client_secret is provided with PKCE, it must be valid
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

    it('Confidential Client - Refresh Token Requires Secret', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      // Get initial tokens using PKCE (no secret required)
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
        .expect(200);

      const refreshToken = tokenResponse.body.refresh_token;

      // Try to refresh without client_secret - should fail
      const refreshResponse = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
        })
        .expect(401);

      expect(refreshResponse.body).to.have.property('error');
      expect(refreshResponse.body.error).to.equal('invalid_client');
    });

    it('Confidential Client - Refresh Token with Secret', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      // Get initial tokens
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
        .expect(200);

      const refreshToken = tokenResponse.body.refresh_token;

      // Refresh with client_secret - should succeed
      const refreshResponse = await request(context.app)
        .post('/api/v2/oauth/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        })
        .expect(200);

      expect(refreshResponse.body).to.have.property('access_token');
      expect(refreshResponse.body).to.have.property('refresh_token');
      expect(refreshResponse.body.refresh_token).to.not.equal(refreshToken);
    });
  });
}

export default function () {
  describe('OAuth', oauthTests);
}
