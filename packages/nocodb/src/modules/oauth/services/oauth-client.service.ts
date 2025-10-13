import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';

@Injectable()
export class OauthClientService {
  async listClients(context: NcContext, req: NcRequest) {
    
  };
}
