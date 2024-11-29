import path from 'path';
import debug from 'debug';
import PQueue from 'p-queue';
import { UITypes } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import mime from 'mime/lite';
import { FileReference, Source } from '~/models';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Model } from '~/models';
import { extractProps } from '~/helpers/extractProps';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';

@Injectable()
export class AttachmentMigration {
  private readonly debugLog = debug('nc:migration-jobs:attachment');

  log = (...msgs: string[]) => {
    console.log('[nc_job_001_attachment]: ', ...msgs);
  };

  async job() {
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
            table.text('file_path').notNullable();
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
            table.integer('offset').defaultTo(0);
            table.boolean('completed').defaultTo(false);

            table.index('fk_model_id');
          },
        );
      }

      // get all file references
      const storageAdapter = await NcPluginMgrv2.storageAdapter(ncMeta);

      const storageAdapterType = storageAdapter.name;

      const fileScanStream = await storageAdapter.scanFiles('nc/uploads/**');

      const fileReferenceBuffer = [];

      const insertPromises = [];

      let filesCount = 0;

      let err = null;

      fileScanStream.on('data', async (file) => {
        fileReferenceBuffer.push({ file_path: file });

        if (fileReferenceBuffer.length >= 100) {
          fileScanStream.pause();

          try {
            const processBuffer = fileReferenceBuffer.splice(
              0,
              fileReferenceBuffer.length,
            );

            filesCount += processBuffer.length;

            // skip or insert file references
            const toSkip = await ncMeta
              .knexConnection(temp_file_references_table)
              .whereIn(
                'file_path',
                processBuffer.map((f) => f.file_path),
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

          fileScanStream.resume();
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

      let processedModelsCount = 0;

      const processModel = async (modelData) => {
        // we increment on start of processing as getting a rough progress is enough
        const { fk_workspace_id, base_id, source_id, fk_model_id } = modelData;

        const context = {
          workspace_id: fk_workspace_id,
          base_id,
        };

        const source = await Source.get(context, source_id);

        if (!source) {
          this.log(`source not found for ${source_id}`);
          return;
        }

        const isExternal = !source.isMeta();

        const model = await Model.get(context, fk_model_id);

        if (!model) {
          this.log(`model not found for ${fk_model_id}`);
          return;
        }

        await model.getColumns(context);

        const attachmentColumns = model.columns.filter(
          (c) => c.uidt === UITypes.Attachment,
        );

        const dbDriver = await NcConnectionMgrv2.get(source);

        if (!dbDriver) {
          this.log(`connection can't achieved for ${source_id}`);
          return;
        }

        const baseModel = await Model.getBaseModelSQL(context, {
          model,
          dbDriver,
        });

        if (isExternal) {
          try {
            this.log(`Checking connection for ${source_id} (${source.alias})`);
            // run SELECT 1 to check if connection is working
            // return if no response in 10 seconds
            await Promise.race([
              baseModel.execAndParse('SELECT 1', null, { raw: true }),
              new Promise((resolve, reject) =>
                setTimeout(() => reject(new Error('timeout')), 10000),
              ),
            ]);

            this.log(
              `External source ${source_id} (${source.alias}) is accessible`,
            );
          } catch (e) {
            this.log(
              `External source ${source_id} (${source.alias}) is not accessible`,
            );
            throw e;
          }
        }

        const processedModel = await ncMeta
          .knexConnection(temp_processed_models_table)
          .where('fk_model_id', fk_model_id)
          .first();

        const dataLimit = 50;
        let dataOffset = 0;

        if (!processedModel) {
          await ncMeta
            .knexConnection(temp_processed_models_table)
            .insert({ fk_model_id, offset: 0 });
        } else {
          dataOffset = processedModel.offset;
        }

        const numRecords = await baseModel.count();

        this.log(
          `Processing model "${model.title}" with ${numRecords} records and ${attachmentColumns.length} attachment columns`,
        );

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
                  try {
                    if ('path' in attachment || 'url' in attachment) {
                      const filePath = `nc/uploads/${
                        attachment.path?.replace(/^download\//, '') ||
                        getPathFromUrl(attachment.url, true)
                      }`;

                      const isReferenced = await ncMeta
                        .knexConnection(temp_file_references_table)
                        .where('file_path', filePath)
                        .first();

                      if (!isReferenced) {
                        // file is from another storage adapter
                        this.log(
                          `file not found in file references table ${
                            attachment.path || attachment.url
                          } | ${filePath} | ${model.fk_workspace_id} - ${
                            model.base_id
                          } - ${model.id}`,
                        );
                      } else if (!isReferenced.referenced) {
                        const fileNameWithExt = path.basename(filePath);

                        const mimetype =
                          attachment.mimetype ||
                          mime.getType(path.extname(fileNameWithExt).slice(1));

                        await ncMeta
                          .knexConnection(temp_file_references_table)
                          .where('file_path', filePath)
                          .update({
                            mimetype,
                            referenced: true,
                          });

                        // insert file reference if not exists
                        const fileReference = await ncMeta
                          .knexConnection(MetaTable.FILE_REFERENCES)
                          .where('file_url', attachment.path || attachment.url)
                          .andWhere('storage', storageAdapterType)
                          .first();

                        if (!fileReference) {
                          await FileReference.insert(
                            {
                              workspace_id: RootScopes.ROOT,
                              base_id: RootScopes.ROOT,
                            },
                            {
                              storage: storageAdapterType,
                              file_url: attachment.path || attachment.url,
                              file_size: attachment.size,
                              deleted: true,
                            },
                          );
                        }
                      }

                      if (!('id' in attachment)) {
                        attachment.id = await FileReference.insert(context, {
                          source_id: source.id,
                          fk_model_id,
                          fk_column_id: column.id,
                          file_url: attachment.path || attachment.url,
                          file_size: attachment.size,
                          is_external: !source.isMeta(),
                          deleted: false,
                        });

                        updateRequired = true;
                      } else {
                        const fileReference = await FileReference.get(
                          context,
                          attachment.id,
                        );

                        if (!fileReference) {
                          await FileReference.insert(context, {
                            id: attachment.id,
                            source_id: source.id,
                            fk_model_id,
                            fk_column_id: column.id,
                            file_url: attachment.path || attachment.url,
                            file_size: attachment.size,
                            is_external: !source.isMeta(),
                            deleted: false,
                          });
                        }
                      }
                    }
                  } catch (e) {
                    this.log(
                      `Error processing attachment ${JSON.stringify(
                        attachment,
                      )}`,
                    );
                    this.log(e);
                    throw e;
                  }
                }
              }

              if (updateRequired) {
                updateData[column.column_name] = JSON.stringify(attachmentArr);
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
                baseModel.extractPksValues(updateData),
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

          // update offset
          await ncMeta
            .knexConnection(temp_processed_models_table)
            .where('fk_model_id', fk_model_id)
            .update({ offset: dataOffset });
        }

        // mark model as processed
        await ncMeta
          .knexConnection(temp_processed_models_table)
          .where('fk_model_id', fk_model_id)
          .update({ completed: true });
      };

      const selectFields = [
        ...(Noco.isEE() ? ['fk_workspace_id'] : []),
        'base_id',
        'source_id',
        'fk_model_id',
      ];

      const numberOfModelsToBeProcessed = (
        await ncMeta.knexConnection
          .from(
            ncMeta
              .knexConnection(MetaTable.COLUMNS)
              .select(selectFields)
              .where('uidt', UITypes.Attachment)
              .whereNotIn(
                'fk_model_id',
                ncMeta
                  .knexConnection(temp_processed_models_table)
                  .select('fk_model_id')
                  .where('completed', true),
              )
              .groupBy(selectFields)
              .as('t'),
          )
          .count('*', { as: 'count' })
          .first()
      )?.count;

      const skipModels = new Set(['placeholder']);
      let processingModels = [{ fk_model_id: 'placeholder', processing: true }];

      const parallelLimit = 2;

      const queue = new PQueue({ concurrency: parallelLimit });

      const wrapper = async (model) => {
        try {
          await processModel(model);

          this.log(
            `Processed ${processedModelsCount} of ${numberOfModelsToBeProcessed} models`,
          );
        } catch (e) {
          this.log(`Error processing model ${model.fk_model_id}`);
          this.log(e);
          skipModels.add(model.fk_model_id);
        } finally {
          const item = processingModels.find(
            (m) => m.fk_model_id === model.fk_model_id,
          );

          if (item) {
            item.processing = false;
          }

          processedModelsCount += 1;

          this.log(
            `Processed ${processedModelsCount} of ${numberOfModelsToBeProcessed} models`,
          );
        }
      };

      // get models that have at least one attachment column, and not processed

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (queue.pending > parallelLimit) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        processingModels = processingModels.filter((m) => m.processing);

        // this will return until all models marked as processed
        const models = await ncMeta
          .knexConnection(MetaTable.COLUMNS)
          .select(selectFields)
          .where('uidt', UITypes.Attachment)
          .whereNotIn(
            'fk_model_id',
            ncMeta
              .knexConnection(temp_processed_models_table)
              .select('fk_model_id')
              .where('completed', true),
          )
          .whereNotIn(
            'fk_model_id',
            Array.from(skipModels)
              .map((m) => m)
              .concat(processingModels.map((m) => m.fk_model_id)),
          )
          .groupBy(selectFields)
          .limit(100);

        if (!models?.length) {
          break;
        }

        for (const model of models) {
          processingModels.push({
            fk_model_id: model.fk_model_id,
            processing: true,
          });

          queue
            .add(() => wrapper(model))
            .catch((e) => {
              this.log(`Error processing model ${model.fk_model_id}`);
              this.log(e);
              skipModels.add(model.fk_model_id);
            });
        }
      }

      await queue.onIdle();

      this.log(
        `Processed total of ${numberOfModelsToBeProcessed} models with attachments`,
      );
    } catch (e) {
      this.log(`There was an error while processing attachment migration job`);
      this.log(e);
      return false;
    }

    return true;
  }
}
