import path from 'path';
import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { forwardRef, Inject } from '@nestjs/common';
import { JOBS_QUEUE, MigrationJobTypes } from '~/interface/Jobs';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import {
  setMigrationJobsStallInterval,
  updateMigrationJobsState,
} from '~/helpers/migrationJobs';
import mimetypes from '~/utils/mimeTypes';
import { RootScopes } from '~/utils/globals';
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';

const MIGRATION_JOB_VERSION = '2';

@Processor(JOBS_QUEUE)
export class ThumbnailMigrationProcessor {
  private readonly debugLog = debug('nc:migration-jobs:attachment');

  constructor(
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
    private readonly thumbnailGeneratorProcessor: ThumbnailGeneratorProcessor,
  ) {}

  log = (...msgs: string[]) => {
    console.log('[nc_job_002_thumbnail]: ', ...msgs);
  };

  @Process(MigrationJobTypes.Attachment)
  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const interval = setMigrationJobsStallInterval();

    try {
      const ncMeta = Noco.ncMeta;

      const temp_file_references_table = 'nc_temp_file_references';

      const fileReferencesTableExists =
        await ncMeta.knexConnection.schema.hasTable(temp_file_references_table);

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

        // fallback scanning all files if temp table is not generated from previous migration
        const storageAdapter = await NcPluginMgrv2.storageAdapter(ncMeta);

        const fileScanStream = await storageAdapter.scanFiles('nc/uploads/**');

        const fileReferenceBuffer = [];

        fileScanStream.on('data', async (file) => {
          const fileNameWithExt = path.basename(file);

          const mimetype = mimetypes[path.extname(fileNameWithExt).slice(1)];

          fileReferenceBuffer.push({
            file_path: file,
            mimetype,
            referenced: true,
          });

          if (fileReferenceBuffer.length >= 100) {
            fileScanStream.pause();

            const processBuffer = fileReferenceBuffer.splice(0);

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
              await ncMeta
                .knexConnection(temp_file_references_table)
                .insert(toInsert);
            }

            fileScanStream.resume();
          }
        });

        await new Promise((resolve, reject) => {
          fileScanStream.on('end', resolve);
          fileScanStream.on('error', reject);
        });

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
          // manually call thumbnail generator job to control the concurrency
          await this.thumbnailGeneratorProcessor.job({
            data: {
              context: {
                base_id: RootScopes.ROOT,
                workspace_id: RootScopes.ROOT,
              },
              attachments: fileReferences.map((f) => {
                const isUrl = /^https?:\/\//i.test(f.file_path);
                if (isUrl) {
                  return {
                    url: f.file_path,
                    mimetype: f.mimetype,
                  };
                } else {
                  return {
                    path: path.join('download', f.file_path),
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

      // bump the version
      await updateMigrationJobsState({
        version: MIGRATION_JOB_VERSION,
      });
    } catch (e) {
      this.log(`error processing attachment migration job:`, e);
    }

    clearInterval(interval);

    await updateMigrationJobsState({
      locked: false,
      stall_check: Date.now(),
    });

    // call init migration job again
    await this.jobsService.add(MigrationJobTypes.InitMigrationJobs, {});

    this.debugLog(`job completed for ${job.id}`);
  }
}
