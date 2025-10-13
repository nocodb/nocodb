import { randomBytes } from 'crypto';
import { promisify } from 'util';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { OAuthClientType } from 'nocodb-sdk';
import type { AttachmentResType } from 'nocodb-sdk';
import type { OAuthClient as IOAuthClient } from 'nocodb-sdk';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';
import { deserializeJSON, serializeJSON } from '~/utils/serialize';
import { PresignedUrl } from '~/models/index';

export default class OAuthClient implements IOAuthClient {
  client_id: string;
  client_secret?: string | null;
  client_type: OAuthClientType;
  client_name: string;
  client_description?: string;
  client_uri?: string;
  logo_uri?: AttachmentResType;
  redirect_uris: string[];
  allowed_grant_types: string[]; // 'refresh token, authorization'
  response_types: string[]; //
  allowed_scopes: string; //
  registration_access_token?: string;
  registration_client_uri?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  fk_user_id?: string;
  created_at: string;
  updated_at: string;

  constructor(client: Partial<IOAuthClient | OAuthClient>) {
    Object.assign(this, client);
  }

  public static async insert(
    clientData: Partial<OAuthClient>,
    ncMeta = Noco.ncMeta,
  ) {
    let insertData = extractProps(clientData, [
      'client_type',
      'client_name',
      'client_uri',
      'client_description',
      'logo_uri',
      'redirect_uris',
      'allowed_grant_types',
      'response_types',
      // 'allowed_scopes', TODO: Implement Scopes
      'registration_client_uri',
      'registration_access_token',
      'client_id_issued_at',
      'client_secret_expires_at',
      'fk_user_id',
    ]);

    insertData.client_id = nanoid(32);

    const clientType = insertData.client_type || OAuthClientType.PUBLIC;

    insertData = {
      ...insertData,
      client_type: clientType,
      allowed_grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_id_issued_at: Date.now(),
    };

    let plaintextSecret;
    if (clientType === OAuthClientType.CONFIDENTIAL) {
      plaintextSecret = randomBytes(32).toString('base64url');
      const salt = await promisify(bcrypt.genSalt)(10);
      insertData.client_secret = await promisify(bcrypt.hash)(
        plaintextSecret,
        salt,
      );
    }

    if (insertData.logo_uri) {
      insertData.logo_uri = this.serializeAttachmentJSON(
        insertData.logo_uri,
      ) as any;
    }

    insertData = prepareForDb(insertData, [
      'redirect_uris',
      'allowed_grant_types',
      'response_types',
    ]);

    const res = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_CLIENTS,
      insertData,
      true,
    );

    return this.getByClientId(res.client_id, ncMeta).then(async (client) => {
      await NocoCache.appendToList(
        CacheScope.OAUTH_CLIENT,
        [],
        `${CacheScope.OAUTH_CLIENT}:${res.client_id}`,
      );
      // Attach plaintext secret to response
      if (plaintextSecret) {
        (client as any).client_secret = plaintextSecret;
      }
      return client;
    });
  }

  static async getByClientId(clientId: string, ncMeta = Noco.ncMeta) {
    let data = await NocoCache.get(
      `${CacheScope.OAUTH_CLIENT}:${clientId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!data) {
      data = await ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.OAUTH_CLIENTS,
        { client_id: clientId },
      );
      if (data) {
        await NocoCache.set(`${CacheScope.OAUTH_CLIENT}:${clientId}`, data);
      }
    }

    if (data && data.logo_uri) {
      const convertedAttachment = await this.convertAttachmentType(
        {
          logo_uri: data.logo_uri,
        },
        ncMeta,
      );

      data.logo_uri = convertedAttachment.logo_uri;
    }

    return data && (await this.castType(data));
  }

  static async list(userId?: string, ncMeta = Noco.ncMeta) {
    const condition = userId ? { fk_user_id: userId } : {};
    const clients = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_CLIENTS,
      { condition },
    );
    return await Promise.all(clients?.map(async (c) => await this.castType(c)));
  }

  static async delete(clientId: string, ncMeta = Noco.ncMeta) {
    if (!clientId) {
      return false;
    }

    await NocoCache.deepDel(
      `${CacheScope.OAUTH_CLIENT}:${clientId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_CLIENTS,
      { client_id: clientId },
    );
  }

  static async regenerateSecret(clientId: string, ncMeta = Noco.ncMeta) {
    if (!clientId) {
      return false;
    }

    // Generate plaintext secret for response
    const plaintextSecret = randomBytes(32).toString('base64url');
    // Hash the secret for storage
    const salt = await promisify(bcrypt.genSalt)(10);
    const hashedSecret = await promisify(bcrypt.hash)(plaintextSecret, salt);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_CLIENTS,
      { client_secret: hashedSecret },
      { client_id: clientId },
    );

    await NocoCache.update(`${CacheScope.OAUTH_CLIENT}:${clientId}`, {
      client_secret: hashedSecret,
    });

    const client = await this.getByClientId(clientId, ncMeta);
    if (client) {
      (client as any).client_secret = plaintextSecret;
    }
    return client;
  }

  static async update(
    clientId: string,
    body: Partial<OAuthClient>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!clientId) {
      return false;
    }

    let updateObj = extractProps(body, [
      'client_name',
      'client_uri',
      'client_description',
      'logo_uri',
      'redirect_uris',
      // 'allowed_scopes', TODO: Implement Scopes
      'registration_client_uri',
      'client_secret_expires_at',
    ]);

    updateObj = prepareForDb(updateObj, [
      'redirect_uris',
      'allowed_grant_types',
      'response_types',
    ]);

    if (updateObj.logo_uri) {
      updateObj.logo_uri = this.serializeAttachmentJSON(
        updateObj.logo_uri,
      ) as any;
    }

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_CLIENTS,
      updateObj,
      { client_id: clientId },
    );

    await NocoCache.update(`${CacheScope.OAUTH_CLIENT}:${clientId}`, updateObj);

    return this.getByClientId(clientId, ncMeta);
  }

  public static async castType(client: any): Promise<OAuthClient> {
    if (!client) return null;

    client = prepareForResponse(client, [
      'redirect_uris',
      'allowed_grant_types',
      'response_types',
    ]);

    if (client && client.logo_uri) {
      const convertedAttachment = await this.convertAttachmentType(
        {
          logo_uri: client.logo_uri,
        },
        client,
      );

      client.logo_uri = convertedAttachment.logo_uri;
    }

    return new OAuthClient(client);
  }

  static serializeAttachmentJSON(attachment): string | null {
    if (attachment) {
      return serializeJSON(
        extractProps(deserializeJSON(attachment), [
          'url',
          'path',
          'title',
          'mimetype',
          'size',
          'icon',
        ]),
      );
    }
    return attachment;
  }

  protected static async convertAttachmentType<K extends Record<string, any>>(
    attachmentObjs: K,
    ncMeta = Noco.ncMeta,
  ): Promise<{ [P in keyof K]: AttachmentResType }> {
    try {
      if (attachmentObjs) {
        const promises = [];

        for (const key in attachmentObjs) {
          if (attachmentObjs[key] && typeof attachmentObjs[key] === 'string') {
            attachmentObjs[key] = deserializeJSON(attachmentObjs[key]);
          }

          promises.push(
            PresignedUrl.signAttachment(
              {
                attachment: attachmentObjs[key],
              },
              ncMeta,
            ),
          );
        }
        await Promise.all(promises);
      }
    } catch {}
    return attachmentObjs;
  }
}
