import { Readable } from 'stream';
import papaparse from 'papaparse';
import debug from 'debug';
import {
  AppEvents,
  isAIPromptCol,
  isLinksOrLTAR,
  isVirtualCol,
  RelationTypes,
} from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bull';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  DuplicateBaseJobData,
  DuplicateColumnJobData,
  DuplicateModelJobData,
} from '~/interface/Jobs';
import { Base, Column, Model, Source } from '~/models';
import { BasesService } from '~/services/bases.service';
import {
  findWithIdentifier,
  generateUniqueName,
} from '~/helpers/exportImportHelpers';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { ColumnsService } from '~/services/columns.service';
import { JobTypes } from '~/interface/Jobs';
import { elapsedTime, initTime } from '~/modules/jobs/helpers';
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { ImportService } from '~/modules/jobs/jobs/export-import/import.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class DuplicateProcessor {
  private readonly debugLog = debug('nc:jobs:duplicate');

  constructor(
    private readonly exportService: ExportService,
    private readonly importService: ImportService,
    private readonly projectsService: BasesService,
    private readonly bulkDataService: BulkDataAliasService,
    private readonly columnsService: ColumnsService,
    private readonly appHooksService: AppHooksService,
  ) {}

  async duplicateBaseJob({
    sourceBase,
    targetBase,
    dataSource,
    req,
    context,
    options,
    operation,
    targetContext: _targetContext,
  }: {
    sourceBase: Base; // Base to duplicate
    targetBase: Base; // Base to duplicate to
    dataSource: Source; // Data source to duplicate from
    req: NcRequest;
    context: NcContext; // Context of the base to duplicate
    targetContext?: NcContext; // Context of the base to duplicate to
    options: {
      excludeData?: boolean;
      excludeHooks?: boolean;
      excludeViews?: boolean;
      excludeComments?: boolean;
    };
    operation: string;
  }) {
    const hrTime = initTime();

    const targetContext = _targetContext ?? {
      workspace_id: targetBase.fk_workspace_id,
      base_id: targetBase.id,
    };

    try {
      if (!sourceBase || !targetBase || !dataSource) {
        throw new Error(`Base or source not found!`);
      }

      const user = (req as any).user;

      const models = (await dataSource.getModels(context)).filter(
        (m) => m.source_id === dataSource.id && !m.mm && m.type === 'table',
      );

      const exportedModels = await this.exportService.serializeModels(context, {
        modelIds: models.map((m) => m.id),
        ...options,
      });

      elapsedTime(
        hrTime,
        `serialize models schema for ${dataSource.base_id}::${dataSource.id}`,
        operation,
      );

      if (!exportedModels) {
        throw new Error(`Export failed for source '${dataSource.id}'`);
      }

      await targetBase.getSources();

      const targetBaseSource = targetBase.sources[0];

      const idMap = await this.importService.importModels(targetContext, {
        user,
        baseId: targetBase.id,
        sourceId: targetBaseSource.id,
        data: exportedModels,
        req: req,
      });

      elapsedTime(hrTime, `import models schema`, operation);

      if (!idMap) {
        throw new Error(`Import failed for source '${dataSource.id}'`);
      }

      if (!options?.excludeData) {
        await this.importModelsData(targetContext, context, {
          idMap,
          sourceProject: sourceBase,
          sourceModels: models,
          destProject: targetBase,
          destBase: targetBaseSource,
          hrTime,
          req,
        });
      }

      await this.projectsService.baseUpdate(targetContext, {
        baseId: targetBase.id,
        base: {
          status: null,
        },
        user: req.user,
        req,
      });
      this.appHooksService.emit(AppEvents.BASE_DUPLICATE_COMPLETE, {
        sourceBase,
        destBase: targetBase,
        user: req.user,
        req,
        context: targetContext,
      });
    } catch (err) {
      if (targetBase?.id) {
        await this.projectsService.baseSoftDelete(targetContext, {
          baseId: targetBase.id,
          user: req.user,
          req,
        });
      }

      this.appHooksService.emit(AppEvents.BASE_DUPLICATE_FAIL, {
        sourceBase,
        destBase: targetBase,
        user: req.user,
        req,
        context: targetContext,
        error: err.message,
      });

      throw err;
    }
  }

  async duplicateBase(job: Job<DuplicateBaseJobData>) {
    this.debugLog(`job started for ${job.id} (${JobTypes.DuplicateBase})`);

    const { context, sourceId, dupProjectId, req, options } = job.data;

    const baseId = context.base_id;

    // workspace templates placeholder user
    if (req.user?.id === '1') {
      delete req.user;
    }

    const excludeData = options?.excludeData || false;
    const excludeHooks = options?.excludeHooks || false;
    const excludeViews = options?.excludeViews || false;
    const excludeComments = options?.excludeComments || excludeData || false;

    const base = await Base.get(context, baseId);
    const dupProject = await Base.get(context, dupProjectId);
    const source = await Source.get(context, sourceId);

    await this.duplicateBaseJob({
      sourceBase: base,
      targetBase: dupProject,
      dataSource: source,
      req,
      context,
      options: {
        excludeData,
        excludeHooks,
        excludeViews,
        excludeComments,
      },
      operation: JobTypes.DuplicateBase,
    });

    return { id: dupProject.id };
  }

  async duplicateModel(job: Job<DuplicateModelJobData>) {
    this.debugLog(`job started for ${job.id} (${JobTypes.DuplicateModel})`);

    const hrTime = initTime();

    const { context, sourceId, modelId, title, req, options } = job.data;

    const baseId = context.base_id;

    const excludeData = options?.excludeData || false;
    const excludeHooks = options?.excludeHooks || false;
    const excludeViews = options?.excludeViews || false;
    const excludeComments = options?.excludeComments || excludeData || false;

    const base = await Base.get(context, baseId);
    const source = await Source.get(context, sourceId);

    const user = (req as any).user;

    const models = (await source.getModels(context)).filter(
      (m) => !m.mm && m.type === 'table',
    );

    const sourceModel = models.find((m) => m.id === modelId);

    try {
      await sourceModel.getColumns(context);

      const relatedModelIds = sourceModel.columns
        .filter((col) => isLinksOrLTAR(col))
        .map((col) => col.colOptions.fk_related_model_id)
        .filter((id) => id);

      const relatedModels = models.filter((m) =>
        relatedModelIds.includes(m.id),
      );

      const exportedModel = (
        await this.exportService.serializeModels(context, {
          modelIds: [modelId],
          excludeViews,
          excludeHooks,
          excludeData,
          excludeComments,
        })
      )[0];

      elapsedTime(
        hrTime,
        `serialize model schema for ${modelId}`,
        'duplicateModel',
      );

      if (!exportedModel) {
        throw new Error(`Export failed for source '${source.id}'`);
      }

      exportedModel.model.title = title;
      exportedModel.model.table_name = title.toLowerCase().replace(/ /g, '_');

      const idMap = await this.importService.importModels(context, {
        baseId,
        sourceId,
        data: [exportedModel],
        user,
        req,
        externalModels: relatedModels,
      });

      elapsedTime(hrTime, 'import model schema', 'duplicateModel');

      if (!idMap) {
        throw new Error(`Import failed for model '${modelId}'`);
      }

      if (!excludeData) {
        const fields: Record<string, string[]> = {};

        for (const md of relatedModels) {
          const bts = md.columns
            .filter(
              (c) =>
                isLinksOrLTAR(c) &&
                (c.colOptions.type === RelationTypes.BELONGS_TO ||
                  (c.colOptions.type === RelationTypes.ONE_TO_ONE &&
                    c.meta?.bt)) &&
                c.colOptions.fk_related_model_id === sourceModel.id,
            )
            .map((c) => c.id);

          if (bts.length > 0) {
            fields[md.id] = fields[md.id] ? fields[md.id] : [md.primaryKey.id];
            fields[md.id].push(...bts);
          }
        }

        await this.importModelsData(context, context, {
          idMap,
          sourceProject: base,
          sourceModels: [sourceModel],
          destProject: base,
          destBase: source,
          hrTime,
          modelFieldIds: fields,
          externalModels: relatedModels,
          req,
        });

        elapsedTime(hrTime, 'import model data', 'duplicateModel');
      }

      this.debugLog(`job completed for ${job.id} (${JobTypes.DuplicateModel})`);

      const res = { id: findWithIdentifier(idMap, sourceModel.id) };

      this.appHooksService.emit(AppEvents.TABLE_DUPLICATE_COMPLETE, {
        sourceTable: sourceModel,
        destTable: await Model.get(context, res.id),
        user: req.user,
        req,
        context,
      });

      return res;
    } catch (e) {
      this.appHooksService.emit(AppEvents.TABLE_DUPLICATE_FAIL, {
        sourceTable: sourceModel,
        user: req.user,
        req,
        context,
        error: e.message,
      });

      throw e;
    }
  }

  async duplicateColumn(job: Job<DuplicateColumnJobData>) {
    this.debugLog(`job started for ${job.id} (${JobTypes.DuplicateColumn})`);

    const hrTime = initTime();

    const { context, sourceId, columnId, extra, req, options } = job.data;

    const baseId = context.base_id;

    const excludeData = options?.excludeData || false;

    const base = await Base.get(context, baseId);

    const sourceColumn = await Column.get(context, {
      source_id: sourceId,
      colId: columnId,
    });

    const user = (req as any).user;

    const source = await Source.get(context, sourceColumn.source_id);

    const models = (await source.getModels(context)).filter(
      (m) => !m.mm && m.type === 'table',
    );

    const sourceModel = models.find((m) => m.id === sourceColumn.fk_model_id);

    const columns = await sourceModel.getColumns(context);

    const title = generateUniqueName(
      `${sourceColumn.title} copy`,
      columns.map((p) => p.title),
    );

    const relatedModelIds = [sourceColumn]
      .filter((col) => isLinksOrLTAR(col))
      .map((col) => col.colOptions.fk_related_model_id)
      .filter((id) => id);

    const relatedModels = models.filter((m) => relatedModelIds.includes(m.id));

    const exportedModel = (
      await this.exportService.serializeModels(context, {
        modelIds: [sourceModel.id, ...relatedModelIds],
        excludeData,
        excludeHooks: true,
        excludeViews: true,
      })
    )[0];

    elapsedTime(
      hrTime,
      `serialize model schema for ${sourceModel.id}`,
      'duplicateColumn',
    );

    if (!exportedModel) {
      throw new Error(`Export failed for model '${sourceModel.id}'`);
    }

    const replacedColumn = exportedModel.model.columns.find((c) =>
      c.id.includes(columnId),
    );

    try {
      // save old default value
      const oldCdf = replacedColumn.cdf;

      replacedColumn.title = title;
      replacedColumn.column_name = title.toLowerCase().replace(/ /g, '_');

      // remove default value to avoid filling existing empty rows
      replacedColumn.cdf = null;

      Object.assign(replacedColumn, extra);

      const idMap = await this.importService.importModels(context, {
        baseId,
        sourceId: source.id,
        data: [exportedModel],
        user,
        req,
        externalModels: relatedModels,
        existingModel: sourceModel,
        importColumnIds: [columnId],
      });

      elapsedTime(hrTime, 'import model schema', 'duplicateColumn');

      if (!idMap) {
        throw new Error(`Import failed for model '${sourceModel.id}'`);
      }

      if (!excludeData) {
        const fields: Record<string, string[]> = {};

        fields[sourceModel.id] = [sourceModel.primaryKey.id];
        fields[sourceModel.id].push(columnId);

        for (const md of relatedModels) {
          const bts = md.columns
            .filter(
              (c) =>
                isLinksOrLTAR(c) &&
                (c.colOptions.type === RelationTypes.BELONGS_TO ||
                  (c.colOptions.type === RelationTypes.ONE_TO_ONE &&
                    c.meta?.bt)) &&
                c.colOptions.fk_related_model_id === sourceModel.id,
            )
            .map((c) => c.id);

          if (bts.length > 0) {
            fields[md.id] = fields[md.id] ? fields[md.id] : [md.primaryKey.id];
            fields[md.id].push(...bts);
          }
        }

        await this.importModelsData(context, context, {
          idMap,
          sourceProject: base,
          sourceModels: [],
          destProject: base,
          destBase: source,
          hrTime,
          modelFieldIds: fields,
          externalModels: [
            sourceModel,
            ...relatedModels.filter((m) => m.id !== sourceModel.id),
          ],
          req,
        });

        elapsedTime(hrTime, 'import model data', 'duplicateColumn');
      }

      const destColumn = await Column.get(context, {
        source_id: base.id,
        colId: findWithIdentifier(idMap, sourceColumn.id),
      });

      // update cdf
      if (!isVirtualCol(destColumn) && !isAIPromptCol(destColumn)) {
        await this.columnsService.columnUpdate(context, {
          columnId: findWithIdentifier(idMap, sourceColumn.id),
          column: {
            ...destColumn,
            cdf: oldCdf,
          },
          user: req.user,
          req,
        });
      }

      this.debugLog(
        `job completed for ${job.id} (${JobTypes.DuplicateColumn})`,
      );

      const res = { id: findWithIdentifier(idMap, sourceColumn.id) };
      this.appHooksService.emit(AppEvents.COLUMN_DUPLICATE_COMPLETE, {
        table: sourceModel,
        sourceColumn,
        destColumn: await Column.get(context, {
          colId: res.id,
        }),
        user: req.user,
        req,
        context,
      });
      return res;
    } catch (e) {
      this.appHooksService.emit(AppEvents.COLUMN_DUPLICATE_FAIL, {
        table: sourceModel,
        sourceColumn,
        user: req.user,
        req,
        context,
        error: e.message,
      });
      throw e;
    }
  }

  async importModelsData(
    targetContext: NcContext,
    sourceContext: NcContext,
    param: {
      idMap: Map<string, string>;
      sourceProject: Base;
      sourceModels: Model[];
      destProject: Base;
      destBase: Source;
      hrTime: { hrTime: [number, number] };
      modelFieldIds?: Record<string, string[]>;
      externalModels?: Model[];
      req: any;
    },
  ) {
    const {
      idMap,
      sourceProject,
      sourceModels,
      destProject,
      destBase,
      hrTime,
      modelFieldIds,
      externalModels,
      req,
    } = param;

    let handledLinks = [];

    let error = null;

    for (const sourceModel of sourceModels) {
      if (error) break;

      const dataStream = new Readable({
        read() {},
      });

      const linkStream = new Readable({
        read() {},
      });

      this.exportService
        .streamModelDataAsCsv(sourceContext, {
          dataStream,
          linkStream,
          baseId: sourceProject.id,
          modelId: sourceModel.id,
          handledMmList: handledLinks,
        })
        .catch((e) => {
          this.debugLog(e);
          dataStream.push(null);
          linkStream.push(null);
          error = e;
        });

      const model = await Model.get(
        targetContext,
        findWithIdentifier(idMap, sourceModel.id),
      );

      await this.importService.importDataFromCsvStream(targetContext, {
        idMap,
        dataStream,
        destProject,
        destBase,
        destModel: model,
        req,
      });

      handledLinks = await this.importService.importLinkFromCsvStream(
        targetContext,
        {
          idMap,
          linkStream,
          destProject,
          destBase,
          handledLinks,
        },
      );

      elapsedTime(
        hrTime,
        `import data and links for ${model.title}`,
        'importModelsData',
      );
    }

    if (error) throw error;

    // update external models (has bt to this model)
    if (externalModels) {
      for (const sourceModel of externalModels) {
        const fields = modelFieldIds?.[sourceModel.id];

        if (!fields) continue;

        const dataStream = new Readable({
          read() {},
        });

        const linkStream = new Readable({
          read() {},
        });

        let error = null;

        this.exportService
          .streamModelDataAsCsv(targetContext, {
            dataStream,
            linkStream,
            baseId: sourceProject.id,
            modelId: sourceModel.id,
            handledMmList: handledLinks,
            _fieldIds: fields,
          })
          .catch((e) => {
            this.debugLog(e);
            dataStream.push(null);
            linkStream.push(null);
            error = e;
          });

        const headers: string[] = [];
        let chunk = [];

        const model = await Model.get(targetContext, sourceModel.id);

        await new Promise((resolve) => {
          papaparse.parse(dataStream, {
            newline: '\r\n',
            step: async (results, parser) => {
              if (!headers.length) {
                parser.pause();
                for (const header of results.data as any) {
                  const id = idMap.get(header);
                  if (id) {
                    const col = await Column.get(targetContext, {
                      source_id: destBase.id,
                      colId: id,
                    });
                    if (col) {
                      if (
                        col.colOptions?.type === RelationTypes.BELONGS_TO ||
                        (col.colOptions?.type === RelationTypes.ONE_TO_ONE &&
                          col.meta?.bt)
                      ) {
                        const childCol = await Column.get(targetContext, {
                          source_id: destBase.id,
                          colId: col.colOptions.fk_child_column_id,
                        });
                        if (childCol) {
                          headers.push(childCol.column_name);
                        } else {
                          headers.push(null);
                          this.debugLog(`child column not found (${id})`);
                        }
                      } else {
                        headers.push(col.column_name);
                      }
                    } else {
                      headers.push(null);
                      this.debugLog(`column not found (${id})`);
                    }
                  } else {
                    headers.push(null);
                    this.debugLog(`id not found (${header})`);
                  }
                }
                parser.resume();
              } else {
                if (results.errors.length === 0) {
                  const row = {};
                  for (let i = 0; i < headers.length; i++) {
                    if (headers[i]) {
                      if (results.data[i] !== '') {
                        row[headers[i]] = results.data[i];
                      }
                    }
                  }
                  chunk.push(row);
                  if (chunk.length > 1000) {
                    parser.pause();
                    try {
                      // remove empty rows (only pk is present)
                      chunk = chunk.filter((r) => Object.keys(r).length > 1);
                      if (chunk.length > 0) {
                        await this.bulkDataService.bulkDataUpdate(
                          targetContext,
                          {
                            baseName: destProject.id,
                            tableName: model.id,
                            body: chunk,
                            cookie: req,
                            raw: true,
                          },
                        );
                      }
                    } catch (e) {
                      this.debugLog(e);
                    }
                    chunk = [];
                    parser.resume();
                  }
                }
              }
            },
            complete: async () => {
              if (chunk.length > 0) {
                try {
                  // remove empty rows (only pk is present)
                  chunk = chunk.filter((r) => Object.keys(r).length > 1);
                  if (chunk.length > 0) {
                    await this.bulkDataService.bulkDataUpdate(targetContext, {
                      baseName: destProject.id,
                      tableName: model.id,
                      body: chunk,
                      cookie: req,
                      raw: true,
                    });
                  }
                } catch (e) {
                  this.debugLog(e);
                }
                chunk = [];
              }
              resolve(null);
            },
          });
        });

        if (error) throw error;

        handledLinks = await this.importService.importLinkFromCsvStream(
          targetContext,
          {
            idMap,
            linkStream,
            destProject,
            destBase,
            handledLinks,
          },
        );

        elapsedTime(
          hrTime,
          `map existing links to ${model.title}`,
          'importModelsData',
        );
      }
    }
  }
}
