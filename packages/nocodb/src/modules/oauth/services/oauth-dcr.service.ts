import { Injectable } from '@nestjs/common';
import { OAuthClientType } from 'nocodb-sdk';
import { OAuthClient } from '~/models';
import { NcError } from '~/helpers/ncError';
import { DcrRequestSchema } from '~/modules/oauth/dto/dcr.dto';
import type { DcrRequestDto } from '~/modules/oauth/dto/dcr.dto';

export interface DcrResponse {
  client_id: string;
  client_secret?: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_id_issued_at: number;
  client_secret_expires_at?: number;
}

@Injectable()
export class OauthDcrService {
  async registerClient(body: unknown): Promise<DcrResponse> {
    const parsed = DcrRequestSchema.safeParse(body);

    if (!parsed.success) {
      NcError.badRequest(
        `invalid_client_metadata: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
      );
    }

    const data: DcrRequestDto = parsed.data;

    const authMethod = data.token_endpoint_auth_method ?? 'none';
    const clientType =
      authMethod === 'client_secret_post'
        ? OAuthClientType.CONFIDENTIAL
        : OAuthClientType.PUBLIC;

    // Note: OAuthClient.insert hardcodes allowed_grant_types, response_types,
    // and client_id_issued_at — values passed here are overwritten by the model.
    // allowed_scopes is not persisted (extractProps skips it — TODO in model).
    const client = await OAuthClient.insert({
      client_name: data.client_name,
      client_type: clientType,
      redirect_uris: data.redirect_uris,
      client_uri: data.client_uri,
    });

    const response: DcrResponse = {
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: client.allowed_grant_types,
      response_types: client.response_types,
      token_endpoint_auth_method: authMethod,
      client_id_issued_at: client.client_id_issued_at,
    };

    // OAuthClient.insert returns the plaintext secret for confidential clients
    if (client.client_secret) {
      response.client_secret = client.client_secret;
      response.client_secret_expires_at = 0; // does not expire
    }

    return response;
  }
}
