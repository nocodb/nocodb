import axios from 'axios';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, tokenUri } from './config';
import type { AuthResponse } from '@noco-integrations/core';

/**
 * Template Auth Integration class
 * 
 * This template demonstrates how to create an auth integration that returns 
 * service clients (SDKs) for different authentication methods.
 * 
 * NOTE: In actual implementations, you would use a real service client/SDK 
 * by importing and initializing it here.
 */
export class TemplateAuthIntegration extends AuthIntegration {
  /**
   * The authenticate method should return a fully initialized SDK client
   * that can be used by the consumer of this integration.
   * 
   * BEST PRACTICE: Always return an initialized client/SDK rather than just
   * raw credentials, as this makes it easier for the integration consumer.
   */
  public async authenticate(): Promise<AuthResponse<any>> {
    // This method should return an authenticated client or credentials
    // Implementation depends on the type of authentication
    switch (this.config.type) {
      case AuthType.ApiKey:
        // Example implementation for API Key authentication
        return {
          custom: this.createApiKeyClient(this.config.token),
        };

      case AuthType.OAuth:
        // Example implementation for OAuth authentication
        return {
          custom: this.createOAuthClient(this.config.oauth_token),
        };

      case AuthType.Basic:
        // Example implementation for Basic authentication
        return {
          custom: this.createBasicAuthClient(
            this.config.username,
            this.config.password
          ),
        };

      case AuthType.Bearer:
        // Example implementation for Bearer token authentication
        return {
          custom: this.createBearerTokenClient(this.config.bearer_token),
        };

      case AuthType.Custom:
        // Example implementation for Custom authentication
        return {
          custom: this.createCustomClient(this.config),
        };

      default:
        throw new Error('Authentication type not supported');
    }
  }

  /**
   * Create an authenticated client using an API key
   */
  private createApiKeyClient(apiKey: string): any {
    // TODO: Replace with actual client/SDK initialization
    
    // Example implementation:
    // return new ServiceSDK({
    //   apiKey: apiKey,
    //   baseUrl: 'https://api.service.com',
    // });
    
    // For template purposes, returning an object with the SDK methods
    return {
      apiKey,
      
      // Example SDK methods
      getResource: async (id: string) => {
        // Implementation would use the apiKey for authentication
        return { id, name: 'Resource Name' };
      },
      
      createResource: async (data: any) => {
        // Implementation would use the apiKey for authentication
        return { id: '123', ...data };
      }
    };
  }

  /**
   * Create an authenticated client using OAuth token
   */
  private createOAuthClient(oauthToken: string): any {
    // TODO: Replace with actual client/SDK initialization
    
    // Example implementation:
    // return new ServiceSDK({
    //   token: oauthToken,
    //   baseUrl: 'https://api.service.com',
    // });
    
    // For template purposes, returning an object with the SDK methods
    return {
      token: oauthToken,
      
      // Example SDK methods
      getResource: async (id: string) => {
        // Implementation would use the OAuth token for authentication
        return { id, name: 'Resource Name' };
      },
      
      createResource: async (data: any) => {
        // Implementation would use the OAuth token for authentication
        return { id: '123', ...data };
      }
    };
  }

  /**
   * Create an authenticated client using Basic authentication
   */
  private createBasicAuthClient(username: string, password: string): any {
    // TODO: Replace with actual client/SDK initialization
    
    // Example implementation:
    // return new ServiceSDK({
    //   auth: {
    //     username,
    //     password,
    //   },
    //   baseUrl: 'https://api.service.com',
    // });
    
    // For template purposes, returning an object with the SDK methods
    return {
      credentials: { username, password },
      
      // Example SDK methods
      getResource: async (id: string) => {
        // Implementation would use basic auth credentials
        return { id, name: 'Resource Name' };
      },
      
      createResource: async (data: any) => {
        // Implementation would use basic auth credentials
        return { id: '123', ...data };
      }
    };
  }

  /**
   * Create an authenticated client using Bearer token
   */
  private createBearerTokenClient(bearerToken: string): any {
    // TODO: Replace with actual client/SDK initialization
    
    // Example implementation:
    // return new ServiceSDK({
    //   bearer: bearerToken,
    //   baseUrl: 'https://api.service.com',
    // });
    
    // For template purposes, returning an object with the SDK methods
    return {
      bearer: bearerToken,
      
      // Example SDK methods
      getResource: async (id: string) => {
        // Implementation would use the bearer token for authentication
        return { id, name: 'Resource Name' };
      },
      
      createResource: async (data: any) => {
        // Implementation would use the bearer token for authentication
        return { id: '123', ...data };
      }
    };
  }

  /**
   * Create an authenticated client using custom authentication
   */
  private createCustomClient(config: any): any {
    // TODO: Replace with actual client/SDK initialization
    
    // Example implementation:
    // return new ServiceSDK({
    //   customField1: config.custom_field1,
    //   customField2: config.custom_field2,
    //   baseUrl: 'https://api.service.com',
    // });
    
    // For template purposes, returning an object with the SDK methods
    return {
      customConfig: {
        field1: config.custom_field1,
        field2: config.custom_field2,
      },
      
      // Example SDK methods
      getResource: async (id: string) => {
        // Implementation would use the custom configuration
        return { id, name: 'Resource Name' };
      },
      
      createResource: async (data: any) => {
        // Implementation would use the custom configuration
        return { id: '123', ...data };
      }
    };
  }

  /**
   * Exchange an OAuth authorization code for an access token
   * This method is only needed if your integration supports OAuth
   */
  public async exchangeToken(payload: {
    code: string;
  }): Promise<{ oauth_token: string }> {
    // Example implementation:
    const response = await axios.post(
      tokenUri,
      {
        client_id: clientId,
        client_secret: clientSecret,
        code: payload.code,
        grant_type: 'authorization_code',
      },
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
    };
  }
} 