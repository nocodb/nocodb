import path from 'path';
import debug from 'debug';
import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';

// Maps a HEIC/HEIF file extension to the mimetype the thumbnail processor routes
// on. Set explicitly (instead of relying on a mime lookup) so the processor
// always recognises the file as HEIC and runs codec conversion. `nc_file_references`
// stores no mimetype, so the extension is the only signal we have here.
const HEIC_EXT_TO_MIME: Record<string, string> = {
  heic: 'image/heic',
  heics: 'image/heic-sequence',
  heif: 'image/heif',
  heifs: 'image/heif-sequence',
};

// Backfills thumbnails for HEIC/HEIF attachments uploaded before HEIC support
// existed. Those files were stored fine but never got a thumbnail (the old sharp
// pipeline can't decode HEVC), so they show a broken-image fallback. This re-runs
// each one through the now HEIC-capable thumbnail processor.
@Injectable()
export class HeicThumbnailMigration {
  private readonly debugLog = debug('nc:migration-jobs:heic-thumbnail');

  constructor(
    private readonly thumbnailGeneratorProcessor: ThumbnailGeneratorProcessor,
  ) {}

  log = (...msgs: string[]) => {
    console.log('[nc_job_014_heic_thumbnail]: ', ...msgs);
  };

  async job() {
    try {
      const sharp = Noco.sharp;

      if (!sharp) {
        this.log(
          'Sharp not available, skipping HEIC thumbnail migration for now!',
        );
        return true;
      }

      const ncMeta = Noco.ncMeta;

      const storageAdapter = await NcPluginMgrv2.storageAdapter(ncMeta);
      const storageAdapterName = storageAdapter.name;

      // Distinct HEIC/HEIF files (a file may be referenced by several columns).
      const heicFiles = await ncMeta
        .knexConnection(MetaTable.FILE_REFERENCES)
        .where('deleted', false)
        .andWhere((builder) => {
          for (const ext of Object.keys(HEIC_EXT_TO_MIME)) {
            builder.orWhereRaw('LOWER(file_url) LIKE ?', [`%.${ext}`]);
          }
        })
        .select('file_url', 'storage')
        .groupBy('file_url', 'storage');

      if (!heicFiles.length) {
        this.log('No HEIC attachments found, nothing to backfill');
        return true;
      }

      this.log(`Found ${heicFiles.length} HEIC attachment(s) to process`);

      // HEIC decode is CPU heavy — serialize like the original thumbnail migration.
      const queue = new PQueue({ concurrency: 1 });

      let processed = 0;
      let generated = 0;

      const wrapper = async (file: { file_url: string; storage?: string }) => {
        try {
          // Skip files stored on a different adapter than the active one — we
          // can't read them here (mirrors attachment-clean-up behaviour).
          if (file.storage && file.storage !== storageAdapterName) {
            return;
          }

          const ext = file.file_url
            .split('?')[0]
            .split('.')
            .pop()
            ?.toLowerCase();
          const mimetype = ext ? HEIC_EXT_TO_MIME[ext] : undefined;

          if (!mimetype) {
            return;
          }

          const isUrl = /^https?:\/\//i.test(file.file_url);

          const attachment: { url?: string; path?: string; mimetype: string } =
            {
              mimetype,
            };

          if (isUrl) {
            attachment.url = file.file_url;
          } else {
            // Local file_url is stored as `download/...`; the processor strips
            // that prefix and resolves under `nc/uploads/`.
            attachment.path = file.file_url.startsWith('download/')
              ? file.file_url
              : path.join(
                  'download',
                  file.file_url.replace(/^nc\/uploads\//, ''),
                );
          }

          const result = await this.thumbnailGeneratorProcessor.job({
            data: {
              context: {
                base_id: RootScopes.ROOT,
                workspace_id: RootScopes.ROOT,
              },
              attachments: [attachment],
            },
          } as any);

          if (result?.length > 0) {
            generated += 1;
          } else {
            this.log(`Could not generate thumbnail for ${file.file_url}`);
          }
        } catch (e) {
          this.log(`Error processing ${file.file_url}: ${e?.message}`);
        } finally {
          processed += 1;
          if (processed % 25 === 0 || processed === heicFiles.length) {
            this.log(`Processed ${processed}/${heicFiles.length} HEIC files`);
          }
        }
      };

      for (const file of heicFiles) {
        queue.add(() => wrapper(file));
      }

      await queue.onIdle();

      this.log(
        `HEIC thumbnail backfill completed: ${generated}/${heicFiles.length} thumbnail(s) generated`,
      );

      return true;
    } catch (e) {
      this.log('There was an error while backfilling HEIC thumbnails');
      this.log(e);
      return false;
    }
  }
}
