import axios from 'axios';
import { AuthIntegration } from '@noco-integrations/core';
import { getApiBaseUrl } from './config';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';
import type { AxiosInstance } from 'axios';

/**
 * Freshdesk Authentication Integration
 * 
 * Implements API key authentication for Freshdesk API.
 * Uses HTTP Basic Auth with API key as username and 'X' as password.
 * 
 * @see https://developers.freshdesk.com/api/#authentication
 */
export class FreshdeskAuthIntegration extends AuthIntegration {
  public client: AxiosInstance | null = null

  /**
   * Authenticate with Freshdesk API
   * Creates an axios client with Basic Auth headers
   */
  public async authenticate(): Promise<AuthResponse<AxiosInstance>> {
    if (!this.config.domain) {
      throw new Error('Missing required Freshdesk domain');
    }

    if (!this.config.api_key) {
      throw new Error('Missing required Freshdesk API key');
    }

    const apiBaseUrl = getApiBaseUrl(this.config.domain);

    const auth = Buffer.from(`${this.config.api_key}:X`).toString('base64');

    this.client = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    return this.client;
  }

  /**
   * Test connection to Freshdesk API
   * Verifies credentials by fetching current agent information
   */
  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const client = await this.authenticate();

      if (!client) {
        return {
          success: false,
          message: 'Missing Freshdesk client',
        };
      }

      try {
        // Test connection by fetching current agent information
        // This endpoint requires authentication and returns agent details
        const response = await client.get('/agents/me');

        if (response.data && response.data.contact) {
          return {
            success: true,
            message: `Connected as ${response.data.contact.name || 'agent'}`,
          };
        }

        return {
          success: false,
          message: 'Failed to verify Freshdesk connection',
        };
      } catch (error: any) {
        // Handle specific error cases
        if (error?.response?.status === 401) {
          return {
            success: false,
            message: 'Invalid API key or unauthorized access',
          };
        }

        if (error?.response?.status === 403) {
          return {
            success: false,
            message: 'Access forbidden - check API key permissions',
          };
        }

        if (error?.response?.status === 404) {
          return {
            success: false,
            message: 'Invalid Freshdesk domain',
          };
        }

        throw error;
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up resources
   */
  public async destroy(): Promise<void> {
    this.client = null;
  }
}
