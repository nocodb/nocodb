import path from 'path';
import debug from 'debug';
import { Injectable } from '@nestjs/common';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import mimetypes from '~/utils/mimeTypes';
import { RootScopes } from '~/utils/globals';
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';

@Injectable()
export class ThumbnailMigration {
  private readonly debugLog = debug('nc:migration-jobs:attachment');

  constructor(
    private readonly thumbnailGeneratorProcessor: ThumbnailGeneratorProcessor,
  ) {}

  log = (...msgs: string[]) => {
    console.log('[nc_job_002_thumbnail]: ', ...msgs);
  };

  async job() {
    try {
      const ncMeta = Noco.ncMeta;

      const storageAdapter = await NcPluginMgrv2.storageAdapter(ncMeta);

      const temp_file_references_table = 'nc_temp_file_references';

      const fileReferencesTableExists =
        await ncMeta.knexConnection.schema.hasTable(temp_file_references_table);

      // fallback scanning all files if temp table is not generated from previous migration
      if (!fileReferencesTableExists) {
        // create temp file references table if not exists
        await ncMeta.knexConnection.schema.createTable(
          temp_file_references_table,
          (table) => {
            table.increments('id').primary();
            table.string('file_path').notNullable();
            table.string('mimetype');
            table.boolean('referenced').defaultTo(false);
            table.boolean('thumbnail_generated').defaultTo(false);

            table.index('file_path');
          },
        );

        const fileScanStream = await storageAdapter.scanFiles('nc/uploads/**');

        const fileReferenceBuffer = [];

        const insertPromises = [];

        let filesCount = 0;

        let err = null;

        fileScanStream.on('data', async (file) => {
          const fileNameWithExt = path.basename(file);

          const mimetype = mimetypes[path.extname(fileNameWithExt).slice(1)];

          fileReferenceBuffer.push({
            file_path: file,
            mimetype,
            referenced: true,
          });

          if (fileReferenceBuffer.length >= 100) {
            try {
              const processBuffer = fileReferenceBuffer.splice(0);

              filesCount += processBuffer.length;

              // skip or insert file references
              const toSkip = await ncMeta
                .knexConnection(temp_file_references_table)
                .whereIn(
                  'file_path',
                  fileReferenceBuffer.map((f) => f.file_path),
                );

              const toSkipPaths = toSkip.map((f) => f.file_path);

              const toInsert = processBuffer.filter(
                (f) => !toSkipPaths.includes(f.file_path),
              );

              if (toInsert.length > 0) {
                insertPromises.push(
                  ncMeta
                    .knexConnection(temp_file_references_table)
                    .insert(toInsert)
                    .catch((e) => {
                      this.log(`Error inserting file references`);
                      this.log(e);
                      err = e;
                    }),
                );
              }

              this.log(`Scanned ${filesCount} files`);
            } catch (e) {
              this.log(`There was an error while scanning files`);
              this.log(e);
              err = e;
            }
          }
        });

        try {
          await new Promise((resolve, reject) => {
            fileScanStream.on('end', resolve);
            fileScanStream.on('error', reject);
          });

          await Promise.all(insertPromises);
        } catch (e) {
          this.log(`There was an error while scanning files`);
          this.log(e);
          throw e;
        }

        filesCount += fileReferenceBuffer.length;
        this.log(`Completed scanning with ${filesCount} files`);

        // throw if there was an async error while scanning files
        if (err) {
          throw err;
        }

        if (fileReferenceBuffer.length > 0) {
          await ncMeta
            .knexConnection(temp_file_references_table)
            .insert(fileReferenceBuffer);
        }
      }

      const limit = 10;
      let offset = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const fileReferences = await ncMeta
          .knexConnection(temp_file_references_table)
          .where('thumbnail_generated', false)
          .andWhere('referenced', true)
          .andWhere('mimetype', 'like', 'image/%')
          .limit(limit)
          .offset(offset);

        offset += limit;

        if (fileReferences.length === 0) {
          break;
        }

        try {
          // check if thumbnails exist
          for (const fileReference of fileReferences) {
            let relativePath;

            const isUrl = /^https?:\/\//i.test(fileReference.file_path);
            if (isUrl) {
              relativePath = getPathFromUrl(fileReference.file_path).replace(
                /^\/+/,
                '',
              );
            } else {
              relativePath = fileReference.file_path;
            }

            const thumbnailRoot = relativePath.replace(
              /nc\/uploads/,
              'nc/thumbnails',
            );

            try {
              const thumbnails = await storageAdapter.getDirectoryList(
                thumbnailRoot,
              );

              if (
                ['card_cover.jpg', 'small.jpg', 'tiny.jpg'].every((t) =>
                  thumbnails.includes(t),
                )
              ) {
                await ncMeta
                  .knexConnection(temp_file_references_table)
                  .where('file_path', fileReference.file_path)
                  .update({
                    thumbnail_generated: true,
                  });

                fileReference.thumbnail_generated = true;
              }
            } catch (e) {
              // ignore error
            }
          }

          // manually call thumbnail generator job to control the concurrency
          await this.thumbnailGeneratorProcessor.job({
            data: {
              context: {
                base_id: RootScopes.ROOT,
                workspace_id: RootScopes.ROOT,
              },
              attachments: fileReferences
                .filter((f) => !f.thumbnail_generated)
                .map((f) => {
                  const isUrl = /^https?:\/\//i.test(f.file_path);
                  if (isUrl) {
                    return {
                      url: f.file_path,
                      mimetype: f.mimetype,
                    };
                  } else {
                    return {
                      path: path.join(
                        'download',
                        f.file_path.replace(/^nc\/uploads\//, ''),
                      ),
                      mimetype: f.mimetype,
                    };
                  }
                }),
            },
          } as any);

          // update the file references
          await ncMeta
            .knexConnection(temp_file_references_table)
            .whereIn(
              'file_path',
              fileReferences.map((f) => f.file_path),
            )
            .update({
              thumbnail_generated: true,
            });
        } catch (e) {
          this.log(`error while generating thumbnail:`, e);
        }
      }
    } catch (e) {
      this.log(
        `There was an error while generating thumbnails for old attachments`,
      );
      this.log(e);
      return false;
    }

    return true;
  }
}
