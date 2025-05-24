import axios from 'axios';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, tokenUri } from './config';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

/**
 * Provider Auth Integration
 * 
 * TODO: Replace with your actual provider:
 * 1. Import your provider's SDK/client library
 * 2. Update the class name to match your provider
 * 3. Implement proper client initialization in authenticate()
 * 4. Update testConnection() to use provider-specific API call
 * 5. Update exchangeToken() for provider-specific OAuth flow
 */
export class ProviderAuthIntegration extends AuthIntegration {
  public client: any | null = null; // TODO: Replace 'any' with your provider's client type

  public async authenticate(): Promise<AuthResponse<any>> {
    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error('Missing required Provider API token');
        }

        // TODO: Replace with your provider's SDK initialization
        // Example for typical SDK:
        // this.client = new ProviderSDK({
        //   apiKey: this.config.token,
        //   baseUrl: 'https://api.provider.com',
        // });
        
        // For template purposes, creating a mock client
        this.client = {
          apiKey: this.config.token,
          // Add your provider's methods here
          getUser: async () => ({ id: 'user123', name: 'Test User' }),
        };

        return this.client;

      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('Missing required Provider OAuth token');
        }

        // TODO: Replace with your provider's SDK initialization
        // Example for typical SDK:
        // this.client = new ProviderSDK({
        //   accessToken: this.config.oauth_token,
        //   baseUrl: 'https://api.provider.com',
        // });
        
        // For template purposes, creating a mock client
        this.client = {
          oauthToken: this.config.oauth_token,
          // Add your provider's methods here
          getUser: async () => ({ id: 'user123', name: 'Test User' }),
        };

        return this.client;

      default:
        throw new Error('Authentication type not supported');
    }
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const client = await this.authenticate();

      if (!client) {
        return {
          success: false,
          message: 'Missing Provider client',
        };
      }

      // TODO: Replace with your provider's test API call
      // Examples:
      // - await client.users.me();
      // - await client.getUser();
      // - await client.getCurrentUser();
      
      // For template purposes, using mock method
      await client.getUser();
      
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async exchangeToken(payload: {
    code: string;
  }): Promise<{ oauth_token: string }> {
    // TODO: Update the token exchange implementation based on your provider's OAuth flow
    // Some providers require different grant_type, headers, or additional parameters
    
    const response = await axios.post(
      tokenUri,
      {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: payload.code,
        // redirect_uri: this.config.redirect_uri, // Include if required by your provider
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', // Some providers use application/json
          Accept: 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
    };
  }
} 