import { NocoDBBase } from './base';
import type { Base, BaseCreate, BaseUpdate } from './lib/Api';
import type { InternalAPI } from './types';

export class Workspace {
  readonly id: string;
  private readonly internalAPI: InternalAPI;

  constructor(internalApi: InternalAPI, id: string) {
    this.internalAPI = internalApi;
    this.id = id;
  }

  async getInfo(): Promise<Workspace> {
    return this.internalAPI.v3MetaBasesDetail(this.id);
  }

  async listBases(): Promise<Base[]> {
    return this.internalAPI.v3MetaWorkspacesBasesList(this.id);
  }

  async createBase(base: BaseCreate): Promise<Base> {
    return this.internalAPI.v3MetaWorkspacesBasesCreate(this.id, base);
  }

  async updateBase(base: BaseUpdate): Promise<Base> {
    return this.internalAPI.v3MetaBasesPartialUpdate(this.id, base);
  }

  async deleteBase(baseId: string): Promise<void> {
    return this.internalAPI.v3MetaBasesDelete(baseId);
  }

  base(baseId: string): NocoDBBase {
    return new NocoDBBase(this.internalAPI, baseId, this);
  }
}
