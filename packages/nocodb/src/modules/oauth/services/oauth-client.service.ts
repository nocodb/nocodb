import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  CreateOAuthClientDto,
  UpdateOAuthClientDto,
} from '~/modules/oauth/dto';
import {
  CreateOAuthClientSchema,
  UpdateOAuthClientSchema,
} from '~/modules/oauth/dto';
import { OAuthAuthorizationCode, OAuthClient, OAuthToken } from '~/models';
import { NcError } from '~/helpers/ncError';

@Injectable()
export class OauthClientService {
  async listClients(context: NcContext, req: NcRequest) {
    if (!req.user?.id) {
      NcError.get(context).badRequest('User not found');
    }
    const clients = await OAuthClient.list(req.user.id);

    return clients.map((client) => {
      return {
        ...client,
        client_secret: null,
      };
    });
  }

  async getClient(
    context: NcContext,
    {
      clientId,
      req,
    }: {
      clientId: string;
      req: NcRequest;
    },
  ) {
    if (!clientId || !req.user?.id) {
      NcError.get(context).badRequest('Client ID or user not found');
    }

    const client = await OAuthClient.getByClientId(clientId);

    if (!clientId || client.fk_user_id !== req.user.id) {
      NcError.get(context).notFound(clientId);
    }

    return client;
  }

  async createClient(
    context: NcContext,
    body: CreateOAuthClientDto,
    req: NcRequest,
  ) {
    const validatedBody = CreateOAuthClientSchema.safeParse(body);

    if (validatedBody.error) {
      NcError.get(context).zodError({
        message: 'Request body is invalid',
        errors: validatedBody.error,
      });
    }

    body.fk_user_id = req.user.id;

    return await OAuthClient.insert(body);
  }

  async updateClient(
    context: NcContext,
    {
      clientId,
      body,
      req,
    }: {
      clientId: string;
      body: UpdateOAuthClientDto;
      req: NcRequest;
    },
  ) {
    const validatedBody = UpdateOAuthClientSchema.safeParse(body);

    if (validatedBody.error) {
      NcError.get(context).zodError({
        message: 'Request body is invalid',
        errors: validatedBody.error,
      });
    }

    const client = await OAuthClient.getByClientId(clientId);

    if (!client || client.fk_user_id !== req.user.id) {
      NcError.get(context).apiClientNotFound(clientId);
    }

    return await OAuthClient.update(clientId, body);
  }

  async deleteClient(
    context: NcContext,
    { clientId, req }: { clientId: string; req: NcRequest },
  ) {
    await this.getClient(context, {
      clientId,
      req,
    });

    await OAuthToken.deleteAllByClient(clientId);

    await OAuthAuthorizationCode.deleteAllByClient(clientId);

    return await OAuthClient.delete(clientId);
  }

  async regenerateClientSecret(
    context: NcContext,
    { clientId, req }: { clientId: string; req: NcRequest },
  ) {
    const client = await this.getClient(context, {
      clientId,
      req,
    });

    if (!client || client.fk_user_id !== req.user.id) {
      NcError.get(context).apiClientNotFound(clientId);
    }

    if (client.client_type !== 'confidential') {
      NcError.get(context).badRequest(
        'Only confidential clients can have secrets',
      );
    }

    return await OAuthClient.regenerateSecret(clientId);
  }
}
