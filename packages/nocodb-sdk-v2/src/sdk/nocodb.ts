import { InternalApi } from './lib/Api.ts';
import type { InternalAPI, NocoDBOptions } from './types';
import { Workspace } from './workspace';

class NocoDB {
  private static _endPointURL = 'https://app.nocodb.com';
  private static _apiKey: string;
  private readonly internalAPI: InternalAPI;

  constructor(
    options: NocoDBOptions = {
      endPointURL: 'https://app.nocodb.com',
    },
  ) {
    const endPointURL = options.endPointURL || NocoDB._endPointURL;
    const apiKey = options.apiKey || NocoDB._apiKey;

    if (!apiKey) {
      throw new Error(
        'apiKey is required. Provide it in the constructor options or use NocoDB.configure().',
      );
    }

    this.internalAPI = new InternalApi({
      baseURL: endPointURL,
      headers: {
        ['xc-token']: apiKey,
      },
    }).api;
  }

  static configure(options: NocoDBOptions): void {
    if (!options) {
      throw new Error(
        'options is required. Provide it in the constructor options or use NocoDB.configure().',
      );
    }

    if (!options.apiKey) {
      throw new Error(
        'apiKey is required. Provide it in the constructor options or use NocoDB.configure().',
      );
    }

    NocoDB._endPointURL = options.endPointURL || NocoDB._endPointURL;
    NocoDB._apiKey = options.apiKey;
  }

  workspace(id: string): Workspace {
    return new Workspace(this.internalAPI, id);
  }
}
