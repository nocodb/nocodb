import type { AuthType } from '@noco-integrations/core'

export interface ChatwootAuthConfig {
  type: AuthType;
  chatwoot_url: string
  account_id: string
  api_token: string
}