import { AuthIntegration, createAxiosInstance } from '@noco-integrations/core'
import { getApiBaseUrl } from './config'
import type { FreshdeskConfig } from './types'
import type { RateLimitOptions , TestConnectionResponse } from '@noco-integrations/core'
import type { AxiosInstance } from 'axios'


export class FreshdeskAuthIntegration extends AuthIntegration<FreshdeskConfig, AxiosInstance> {
  // https://support.freshdesk.com/support/solutions/articles/225439-what-are-the-rate-limits-for-the-api-calls-to-freshdesk-
  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 200,
        perMilliseconds: 60000, // 1 minute
      },
      perEndpoint: {
        '/api/v2/tickets$': {
          maxRequests: 80,
          perMilliseconds: 60000
        },
        '/api/v2/tickets/\\d+': {
          maxRequests: 80,
          perMilliseconds: 60000
        },
        '/api/v2/tickets\\?': {
          maxRequests: 20,
          perMilliseconds: 60000
        },
        '/api/v2/contacts\\?': {
          maxRequests: 20,
          perMilliseconds: 60000
        },
      },
    }
  }


  public async authenticate(): Promise<AxiosInstance> {
    if (!this.config.domain) {
      throw new Error('Missing required Freshdesk domain')
    }

    if (!this.config.api_key) {
      throw new Error('Missing required Freshdesk API key')
    }

    const apiBaseUrl = getApiBaseUrl(this.config.domain)
    const auth = Buffer.from(`${this.config.api_key}:X`).toString('base64')

    this.client = createAxiosInstance({
      baseURL: apiBaseUrl,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    }, this.getRateLimitConfig());


    return this.client;
  }

  /**
   * Test connection to Freshdesk API
   * Verifies credentials by fetching current agent information
   */
  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const response = await this.use(async (client) => {
        return await client.get('/agents/me')
      })

      if (response.data && response.data.contact) {
        return {
          success: true,
          message: `Connected as ${response.data.contact.name || 'agent'}`,
        }
      }

      return {
        success: false,
        message: 'Failed to verify Freshdesk connection',
      }
    } catch (error: any) {
      // Handle specific error cases
      if (error?.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid API key or unauthorized access',
        }
      }

      if (error?.response?.status === 403) {
        return {
          success: false,
          message: 'Access forbidden - check API key permissions',
        }
      }

      if (error?.response?.status === 404) {
        return {
          success: false,
          message: 'Invalid Freshdesk domain',
        }
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Clean up resources
   */
  public async destroy(): Promise<void> {
    this.client = null
  }
}