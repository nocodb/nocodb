import type { Base } from '../lib/Api';
import type { InternalAPI } from './types';
import type { Workspace } from './workspace';

export class NocoDBBase implements Base {
  readonly id: string;
  private workspace: Workspace;
  private readonly internalAPI: InternalAPI;

  constructor(internalApi: InternalAPI, id: string, workspace: Workspace) {
    this.internalAPI = internalApi;
    this.id = id;
    this.workspace = workspace;
  }
}
