import { Readable } from 'stream';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import papaparse from 'papaparse';
import { UITypes } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import { Base, Column, Model, Project } from '../../../models';
import { ProjectsService } from '../../../services/projects.service';
import { findWithIdentifier } from '../../../helpers/exportImportHelpers';
import { BulkDataAliasService } from '../../../services/bulk-data-alias.service';
import { JOBS_QUEUE, JobTypes } from '../../../interface/Jobs';
import { elapsedTime, initTime } from '../helpers';
import { ExportService } from './export.service';
import { ImportService } from './import.service';

@Processor(JOBS_QUEUE)
export class DuplicateProcessor {
  private readonly logger = new Logger(
    `${JOBS_QUEUE}:${DuplicateProcessor.name}`,
  );

  constructor(
    private readonly exportService: ExportService,
    private readonly importService: ImportService,
    private readonly projectsService: ProjectsService,
    private readonly bulkDataService: BulkDataAliasService,
  ) {}

  @Process(JobTypes.DuplicateBase)
  async duplicateBase(job: Job) {
    const hrTime = initTime();

    const { projectId, baseId, dupProjectId, req, options } = job.data;

    const excludeData = options?.excludeData || false;
    const excludeHooks = options?.excludeHooks || false;
    const excludeViews = options?.excludeViews || false;

    const project = await Project.get(projectId);
    const dupProject = await Project.get(dupProjectId);
    const base = await Base.get(baseId);

    try {
      if (!project || !dupProject || !base) {
        throw new Error(`Project or base not found!`);
      }

      const user = (req as any).user;

      const models = (await base.getModels()).filter(
        // TODO revert this when issue with cache is fixed
        (m) => m.base_id === base.id && !m.mm && m.type === 'table',
      );

      const exportedModels = await this.exportService.serializeModels({
        modelIds: models.map((m) => m.id),
        excludeViews,
        excludeHooks,
      });

      elapsedTime(
        hrTime,
        `serialize models schema for ${base.project_id}::${base.id}`,
        'duplicateBase',
      );

      if (!exportedModels) {
        throw new Error(`Export failed for base '${base.id}'`);
      }

      await dupProject.getBases();

      const dupBase = dupProject.bases[0];

      const idMap = await this.importService.importModels({
        user,
        projectId: dupProject.id,
        baseId: dupBase.id,
        data: exportedModels,
        req: req,
      });

      elapsedTime(hrTime, `import models schema`, 'duplicateBase');

      if (!idMap) {
        throw new Error(`Import failed for base '${base.id}'`);
      }

      if (!excludeData) {
        await this.importModelsData({
          idMap,
          sourceProject: project,
          sourceModels: models,
          destProject: dupProject,
          destBase: dupBase,
          hrTime,
        });
      }

      await this.projectsService.projectUpdate({
        projectId: dupProject.id,
        project: {
          status: null,
        },
        user: req.user,
      });
    } catch (e) {
      if (dupProject?.id) {
        await this.projectsService.projectSoftDelete({
          projectId: dupProject.id,
          user: req.user,
        });
      }
      throw e;
    }
  }

  @Process(JobTypes.DuplicateModel)
  async duplicateModel(job: Job) {
    const hrTime = initTime();

    const { projectId, baseId, modelId, title, req, options } = job.data;

    const excludeData = options?.excludeData || false;
    const excludeHooks = options?.excludeHooks || false;
    const excludeViews = options?.excludeViews || false;

    const project = await Project.get(projectId);
    const base = await Base.get(baseId);

    const user = (req as any).user;

    const models = (await base.getModels()).filter(
      (m) => !m.mm && m.type === 'table',
    );

    const sourceModel = models.find((m) => m.id === modelId);

    await sourceModel.getColumns();

    const relatedModelIds = sourceModel.columns
      .filter((col) => col.uidt === UITypes.LinkToAnotherRecord)
      .map((col) => col.colOptions.fk_related_model_id)
      .filter((id) => id);

    const relatedModels = models.filter((m) => relatedModelIds.includes(m.id));

    const exportedModel = (
      await this.exportService.serializeModels({
        modelIds: [modelId],
        excludeViews,
        excludeHooks,
      })
    )[0];

    elapsedTime(
      hrTime,
      `serialize model schema for ${modelId}`,
      'duplicateModel',
    );

    if (!exportedModel) {
      throw new Error(`Export failed for base '${base.id}'`);
    }

    exportedModel.model.title = title;
    exportedModel.model.table_name = title.toLowerCase().replace(/ /g, '_');

    const idMap = await this.importService.importModels({
      projectId,
      baseId,
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
              c.uidt === UITypes.LinkToAnotherRecord &&
              c.colOptions.type === 'bt' &&
              c.colOptions.fk_related_model_id === modelId,
          )
          .map((c) => c.id);

        if (bts.length > 0) {
          fields[md.id] = [md.primaryKey.id];
          fields[md.id].push(...bts);
        }
      }

      await this.importModelsData({
        idMap,
        sourceProject: project,
        sourceModels: [sourceModel],
        destProject: project,
        destBase: base,
        hrTime,
        modelFieldIds: fields,
        externalModels: relatedModels,
      });

      elapsedTime(hrTime, 'import model data', 'duplicateModel');
    }

    return await Model.get(findWithIdentifier(idMap, sourceModel.id));
  }

  async importModelsData(param: {
    idMap: Map<string, string>;
    sourceProject: Project;
    sourceModels: Model[];
    destProject: Project;
    destBase: Base;
    hrTime: { hrTime: [number, number] };
    modelFieldIds?: Record<string, string[]>;
    externalModels?: Model[];
  }) {
    const {
      idMap,
      sourceProject,
      sourceModels,
      destProject,
      destBase,
      hrTime,
      modelFieldIds,
      externalModels,
    } = param;

    let handledLinks = [];

    for (const sourceModel of sourceModels) {
      const dataStream = new Readable({
        read() {},
      });

      const linkStream = new Readable({
        read() {},
      });

      this.exportService.streamModelDataAsCsv({
        dataStream,
        linkStream,
        projectId: sourceProject.id,
        modelId: sourceModel.id,
        handledMmList: handledLinks,
      });

      const model = await Model.get(findWithIdentifier(idMap, sourceModel.id));

      await this.importService.importDataFromCsvStream({
        idMap,
        dataStream,
        destProject,
        destBase,
        destModel: model,
      });

      handledLinks = await this.importService.importLinkFromCsvStream({
        idMap,
        linkStream,
        destProject,
        destBase,
        handledLinks,
      });

      elapsedTime(
        hrTime,
        `import data and links for ${model.title}`,
        'importModelsData',
      );
    }

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

        this.exportService.streamModelDataAsCsv({
          dataStream,
          linkStream,
          projectId: sourceProject.id,
          modelId: sourceModel.id,
          handledMmList: handledLinks,
          _fieldIds: fields,
        });

        const headers: string[] = [];
        let chunk = [];

        const model = await Model.get(sourceModel.id);

        await new Promise((resolve) => {
          papaparse.parse(dataStream, {
            newline: '\r\n',
            step: async (results, parser) => {
              if (!headers.length) {
                parser.pause();
                for (const header of results.data) {
                  const id = idMap.get(header);
                  if (id) {
                    const col = await Column.get({
                      base_id: destBase.id,
                      colId: id,
                    });
                    if (col) {
                      if (col.colOptions?.type === 'bt') {
                        const childCol = await Column.get({
                          base_id: destBase.id,
                          colId: col.colOptions.fk_child_column_id,
                        });
                        if (childCol) {
                          headers.push(childCol.column_name);
                        } else {
                          headers.push(null);
                          this.logger.error(`child column not found (${id})`);
                        }
                      } else {
                        headers.push(col.column_name);
                      }
                    } else {
                      headers.push(null);
                      this.logger.error(`column not found (${id})`);
                    }
                  } else {
                    headers.push(null);
                    this.logger.error(`id not found (${header})`);
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
                      await this.bulkDataService.bulkDataUpdate({
                        projectName: destProject.id,
                        tableName: model.id,
                        body: chunk,
                        cookie: null,
                        raw: true,
                      });
                    } catch (e) {
                      this.logger.error(e);
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
                  await this.bulkDataService.bulkDataUpdate({
                    projectName: destProject.id,
                    tableName: model.id,
                    body: chunk,
                    cookie: null,
                    raw: true,
                  });
                } catch (e) {
                  this.logger.error(e);
                }
                chunk = [];
              }
              resolve(null);
            },
          });
        });

        elapsedTime(
          hrTime,
          `map existing links to ${model.title}`,
          'importModelsData',
        );
      }
    }
  }
}
