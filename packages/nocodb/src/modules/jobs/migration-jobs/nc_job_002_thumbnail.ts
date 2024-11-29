import path from 'path';
import debug from 'debug';
import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import mime from 'mime/lite';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
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
      const sharp = Noco.sharp;

      if (!sharp) {
        this.log(
          `Thumbnail generation is not supported in this platform at the moment. Skipping thumbnail migration for now!`,
        );
        return true;
      }

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

          const mimetype = mime.getType(path.extname(fileNameWithExt).slice(1));

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

      const numberOfImagesToBeProcessed = (
        await ncMeta
          .knexConnection(temp_file_references_table)
          .where('thumbnail_generated', false)
          .andWhere('referenced', true)
          .andWhere('mimetype', 'like', 'image/%')
          .count('*', { as: 'count' })
          .first()
      )?.count;

      let processedImages = 0;

      const limit = 10;
      const parallelLimit = 1;

      const skipImages = [];
      let processingImages: {
        id: string;
        processed: boolean;
      }[] = [];

      const queue = new PQueue({ concurrency: parallelLimit });

      this.log(
        `Starting thumbnail generation for ${numberOfImagesToBeProcessed} images`,
      );

      const wrapper = async (
        fileReference: {
          id: string;
          file_path: string;
          mimetype: string;
        },
        isUrl: boolean,
      ) => {
        try {
          const attachment: {
            url?: string;
            path?: string;
            mimetype?: string;
          } = {};

          if (isUrl) {
            attachment.url = fileReference.file_path;
            attachment.mimetype = fileReference.mimetype;
          } else {
            attachment.path = path.join(
              'download',
              fileReference.file_path.replace(/^nc\/uploads\//, ''),
            );
            attachment.mimetype = fileReference.mimetype;
          }

          // manually call thumbnail generator job to control the concurrency
          const thumbnailGenerated = await this.thumbnailGeneratorProcessor.job(
            {
              data: {
                context: {
                  base_id: RootScopes.ROOT,
                  workspace_id: RootScopes.ROOT,
                },
                attachments: [attachment],
              },
            } as any,
          );

          if (thumbnailGenerated.length > 0) {
            await ncMeta
              .knexConnection(temp_file_references_table)
              .where('id', fileReference.id)
              .update({
                thumbnail_generated: true,
              });
          } else {
            this.log(
              `Error generating thumbnail for file ${fileReference.file_path}`,
            );
            skipImages.push(fileReference.id);
          }
        } catch (e) {
          this.log(
            `Error generating thumbnail for file ${fileReference.file_path}`,
          );
          this.log(e);
          skipImages.push(fileReference.id);
        } finally {
          processedImages += 1;
          this.log(
            `Processed ${processedImages} out of ${numberOfImagesToBeProcessed} images`,
          );
          const processingImage = processingImages.find(
            (p) => p.id === fileReference.id,
          );

          if (processingImage) {
            processingImage.processed = true;
          }
        }
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (queue.pending > parallelLimit) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        processingImages = processingImages.filter((p) => !p.processed);

        const fileReferences = await ncMeta
          .knexConnection(temp_file_references_table)
          .whereNotIn(
            'id',
            skipImages.concat(processingImages.map((p) => p.id)),
          )
          .andWhere('thumbnail_generated', false)
          .andWhere('referenced', true)
          .andWhere('mimetype', 'like', 'image/%')
          .limit(limit);

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

            if (fileReference.thumbnail_generated) {
              continue;
            }

            processingImages.push({
              id: fileReference.id,
              processed: false,
            });

            queue.add(() => wrapper(fileReference, isUrl));
          }
        } catch (e) {
          this.log(`error while generating thumbnail:`, e);
        }
      }

      await queue.onIdle();
    } catch (e) {
      this.log(
        `There was an error while generating thumbnails for old attachments`,
      );
      this.log(e);
      return false;
    }

    this.log(`Thumbnail generation for old attachments completed successfully`);

    return true;
  }
}
