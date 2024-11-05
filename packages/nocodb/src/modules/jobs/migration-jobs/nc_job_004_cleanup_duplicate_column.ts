import path from 'path';
import debug from 'debug';
import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import mimetypes from '~/utils/mimeTypes';
import { RootScopes } from '~/utils/globals';
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';

@Injectable()
export class CleanupDuplicateColumnMigration {
  private readonly debugLog = debug(
    'nc:migration-jobs:cleanup-duplicate-column',
  );

  constructor(
    private readonly thumbnailGeneratorProcessor: ThumbnailGeneratorProcessor,
  ) {}

  log = (...msgs: string[]) => {
    console.log('[nc_job_004_cleanup_duplicate_column]: ', ...msgs);
  };

  async job() {
    // cloud only migration so keep as empty
    return true;
  }
}
