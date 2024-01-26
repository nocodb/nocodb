import { Injectable } from '@nestjs/common';
import type { SSOClientType } from 'nocodb-sdk';
import SSOClient from '~/models/SSOClient';

@Injectable()
export class SSOClientService {
  constructor() {}

  async clientAdd(param: { client: SSOClientType; req: any }) {
    // check if user is admin

    // validate client

    // add client
    const client = await SSOClient.insert({
      ...param.client,
      fk_user_id: param.req.user.id,
    });

    return client;
  }

  async clientUpdate(param: {
    clientId: string;
    client: SSOClientType;
    req: any;
  }) {
    // check if user is admin

    // validate client

    // update client
    const client = await SSOClient.update(param.clientId, param.client);

    return client;
  }

  async clientDelete(param: { clientId: string; req: any }) {
    // check if user is admin

    // delete client
    const client = await SSOClient.delete(param.clientId);

    return client;
  }

  async clientList(param: { req: any }) {
    // check if user is admin

    // list clients
    const clients = await SSOClient.list({
      // fk_user_id: param.req.user.id,
    });

    return clients;
  }
}
