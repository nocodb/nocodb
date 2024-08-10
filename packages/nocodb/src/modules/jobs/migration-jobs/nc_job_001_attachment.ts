import path from 'path';
import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { UITypes } from 'nocodb-sdk';
import { forwardRef, Inject } from '@nestjs/common';
import { Source } from '~/models';
import { JOBS_QUEUE, MigrationJobTypes } from '~/interface/Jobs';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { FileReference, Model } from '~/models';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { extractProps } from '~/helpers/extractProps';
import mimetypes from '~/utils/mimeTypes';
import {
  setMigrationJobsStallInterval,
  updateMigrationJobsState,
} from '~/helpers/migrationJobs';

const MIGRATION_JOB_VERSION = '1';

@Processor(JOBS_QUEUE)
export class AttachmentMigrationProcessor {
  private readonly debugLog = debug('nc:migration-jobs:attachment');

  constructor(
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
  ) {}

  log = (...msgs: string[]) => {
    console.log('[nc_job_001_attachment]: ', ...msgs);
  };

  @Process(MigrationJobTypes.Attachment)
  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const interval = setMigrationJobsStallInterval();

    try {
      const ncMeta = Noco.ncMeta;

      const temp_file_references_table = 'nc_temp_file_references';
      const temp_processed_models_table = 'nc_temp_processed_models';

      const fileReferencesTableExists =
        await ncMeta.knexConnection.schema.hasTable(temp_file_references_table);

      const processedModelsTableExists =
        await ncMeta.knexConnection.schema.hasTable(
          temp_processed_models_table,
        );

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
      }

      if (!processedModelsTableExists) {
        // create temp processed models table if not exists
        await ncMeta.knexConnection.schema.createTable(
          temp_processed_models_table,
          (table) => {
            table.increments('id').primary();
            table.string('fk_model_id').notNullable();

            table.index('fk_model_id');
          },
        );
      }

      // get all file references
      const storageAdapter = await NcPluginMgrv2.storageAdapter(ncMeta);

      const fileScanStream = await storageAdapter.scanFiles('nc/uploads/**');

      const fileReferenceBuffer = [];

      fileScanStream.on('data', async (file) => {
        fileReferenceBuffer.push({ file_path: file });

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

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const modelLimit = 100;

        let modelOffset = 0;

        const modelsWithAttachmentColumns = [];

        // get models that have at least one attachment column, and not processed

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const selectFields = [
            ...(Noco.isEE() ? ['fk_workspace_id'] : []),
            'base_id',
            'source_id',
            'fk_model_id',
          ];

          const models = await ncMeta
            .knexConnection(MetaTable.COLUMNS)
            .select(selectFields)
            .where('uidt', UITypes.Attachment)
            .whereNotIn(
              'fk_model_id',
              ncMeta
                .knexConnection(temp_processed_models_table)
                .select('fk_model_id'),
            )
            .groupBy(selectFields)
            .limit(modelLimit)
            .offset(modelOffset);

          modelOffset += modelLimit;

          if (!models?.length) {
            break;
          }

          modelsWithAttachmentColumns.push(...models);
        }

        if (!modelsWithAttachmentColumns?.length) {
          break;
        }

        for (const modelData of modelsWithAttachmentColumns) {
          const { fk_workspace_id, base_id, source_id, fk_model_id } =
            modelData;

          const context = {
            workspace_id: fk_workspace_id,
            base_id,
          };

          const attachmentColumns = await ncMeta
            .knexConnection(MetaTable.COLUMNS)
            .select('id', 'title', 'column_name')
            .where('uidt', UITypes.Attachment)
            .where('fk_model_id', fk_model_id);

          if (!attachmentColumns?.length) {
            this.log(`no attachment columns found for ${fk_model_id}`);
            continue;
          }

          const source = await Source.get(context, source_id);

          if (!source) {
            this.log(`source not found for ${source_id}`);
            continue;
          }

          const model = await Model.get(context, fk_model_id);

          if (!model) {
            this.log(`model not found for ${fk_model_id}`);
            continue;
          }

          await model.getColumns(context);

          const dbDriver = await NcConnectionMgrv2.get(source);

          if (!dbDriver) {
            this.log(`connection can't achieved for ${source_id}`);
            continue;
          }

          const baseModel = await Model.getBaseModelSQL(context, {
            model,
            dbDriver,
          });

          const dataLimit = 10;
          let dataOffset = 0;

          // eslint-disable-next-line no-constant-condition
          while (true) {
            const data = await baseModel.list(
              {
                fieldsSet: new Set(
                  model.primaryKeys
                    .map((c) => c.title)
                    .concat(attachmentColumns.map((c) => c.title)),
                ),
                sort: model.primaryKeys.map((c) => c.title),
                limit: dataLimit,
                offset: dataOffset,
              },
              {
                ignoreViewFilterAndSort: true,
              },
            );

            dataOffset += dataLimit;

            if (!data?.length) {
              break;
            }

            const updatePayload = [];

            for (const row of data) {
              const updateData = {};

              let updateRequired = false;

              for (const column of attachmentColumns) {
                let attachmentArr = row[column.title];

                if (!attachmentArr?.length) {
                  continue;
                }

                try {
                  if (typeof attachmentArr === 'string') {
                    attachmentArr = JSON.parse(attachmentArr);
                  }
                } catch (e) {
                  this.log(`error parsing attachment data ${attachmentArr}`);
                  continue;
                }

                if (Array.isArray(attachmentArr)) {
                  attachmentArr = attachmentArr.map((a) =>
                    extractProps(a, [
                      'id',
                      'url',
                      'path',
                      'title',
                      'mimetype',
                      'size',
                      'icon',
                      'width',
                      'height',
                    ]),
                  );

                  for (const attachment of attachmentArr) {
                    if ('path' in attachment || 'url' in attachment) {
                      const filePath = `nc/uploads/${
                        attachment.path?.replace(/^download\//, '') ||
                        decodeURI(
                          `${new URL(attachment.url).pathname.replace(
                            /.*?nc\/uploads\//,
                            '',
                          )}`,
                        )
                      }`;

                      const isReferenced = await ncMeta
                        .knexConnection(temp_file_references_table)
                        .where('file_path', filePath)
                        .first();

                      if (!isReferenced) {
                        // file is from another storage adapter
                        this.log(
                          `file not found in file references table ${attachment.path || attachment.url}`,
                        );
                        continue;
                      } else if (isReferenced.referenced === false) {
                        const fileNameWithExt = path.basename(filePath);

                        const mimetype = attachment.mimetype || mimetypes[path.extname(fileNameWithExt).slice(1)];

                        await ncMeta
                          .knexConnection(temp_file_references_table)
                          .where('file_path', filePath)
                          .update({
                            mimetype,
                            referenced: true,
                          });
                      }

                      if (!('id' in attachment)) {
                        attachment.id = await FileReference.insert(context, {
                          fk_model_id,
                          fk_column_id: column.id,
                          file_url: attachment.path || attachment.url,
                          file_size: attachment.size,
                        });
                        updateRequired = true;
                      }
                    }
                  }
                }

                if (updateRequired) {
                  updateData[column.column_name] =
                    JSON.stringify(attachmentArr);
                }
              }

              if (Object.keys(updateData).length === 0) {
                continue;
              }

              for (const pk of model.primaryKeys) {
                updateData[pk.column_name] = row[pk.title];
              }

              updatePayload.push(updateData);
            }

            if (updatePayload.length > 0) {
              for (const updateData of updatePayload) {
                const wherePk = await baseModel._wherePk(
                  baseModel._extractPksValues(updateData),
                );

                if (!wherePk) {
                  this.log(`where pk not found for ${updateData}`);
                  continue;
                }

                await baseModel.execAndParse(
                  baseModel
                    .dbDriver(baseModel.tnPath)
                    .update(updateData)
                    .where(wherePk),
                  null,
                  {
                    raw: true,
                  },
                );
              }
            }
          }

          await ncMeta
            .knexConnection(temp_processed_models_table)
            .insert({ fk_model_id });
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
