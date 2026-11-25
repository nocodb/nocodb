import { Injectable } from '@nestjs/common';

/** Search index jobs are EE; EE shadows this file. CE never queues them. */
@Injectable()
export class SearchIndexBuildProcessor {
  async job() {}

  async flush() {}

  async fieldSync() {}

  async reconcile() {}
}
