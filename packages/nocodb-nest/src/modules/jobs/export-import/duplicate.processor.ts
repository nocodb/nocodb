import { Readable } from 'stream';
import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Base, Column, Model, Project } from 'src/models';
import { Job } from 'bull';
import { ProjectsService } from 'src/services/projects.service';
import boxen from 'boxen';
import papaparse from 'papaparse';
import {
  findWithIdentifier,
  generateUniqueName,
} from 'src/helpers/exportImportHelpers';
import { BulkDataAliasService } from 'src/services/bulk-data-alias.service';
import { UITypes } from 'nocodb-sdk';
import { ExportService } from './export.service';
import { ImportService } from './import.service';
import type { LinkToAnotherRecordColumn } from 'src/models';

@Processor('duplicate')
export class DuplicateProcessor {
  constructor(
    private exportService: ExportService,
    private importService: ImportService,
    private projectsService: ProjectsService,
    private bulkDataService: BulkDataAliasService,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    console.log(
      `Processing job ${job.id} of type ${job.name} with data ${job.data}...`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    console.error(
      boxen(
        `---- !! JOB FAILED !! ----\ntype: ${job.name}\nid:${job.id}\nerror:${error.name} (${error.message})\n\nstack: ${error.stack}`,
        {
          padding: 1,
          borderStyle: 'double',
          borderColor: 'yellow',
        },
      ),
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    console.log(`Completed job ${job.id} of type ${job.name}!`);
  }

  @Process('duplicate')
  async duplicateBase(job: Job) {
    console.time('duplicateBase');
    let start = process.hrtime();

    const elapsedTime = function (label?: string) {
      const elapsedS = process.hrtime(start)[0].toFixed(3);
      const elapsedMs = process.hrtime(start)[1] / 1000000;
      if (label) console.log(`${label}: ${elapsedS}s ${elapsedMs}ms`);
      start = process.hrtime();
    };

    const param: { projectId: string; baseId?: string; req: any } = job.data;

    const user = (param.req as any).user;

    const project = await Project.get(param.projectId);

    if (!project) {
      throw new Error(`Base not found for id '${param.baseId}'`);
    }

    const base = param?.baseId
      ? await Base.get(param.baseId)
      : (await project.getBases())[0];

    if (!base) {
      throw new Error(`Base not found!`);
    }

    const models = (await base.getModels()).filter(
      (m) => !m.mm && m.type === 'table',
    );

    const exportedModels = await this.exportService.serializeModels({
      modelIds: models.map((m) => m.id),
    });

    elapsedTime('serializeModels');

    if (!exportedModels) {
      throw new Error(`Export failed for base '${base.id}'`);
    }

    const projects = await Project.list({});

    const uniqueTitle = generateUniqueName(
      `${project.title} copy`,
      projects.map((p) => p.title),
    );

    const dupProject = await this.projectsService.projectCreate({
      project: { title: uniqueTitle },
      user: { id: user.id },
    });

    const dupBaseId = dupProject.bases[0].id;

    elapsedTime('projectCreate');

    const idMap = await this.importService.importModels({
      user,
      projectId: dupProject.id,
      baseId: dupBaseId,
      data: exportedModels,
      req: param.req,
    });

    elapsedTime('importModels');

    if (!idMap) {
      throw new Error(`Import failed for base '${base.id}'`);
    }

    const handledLinks = [];
    const lChunk: Record<string, any[]> = {}; // colId: { rowId, childId }[]

    for (const sourceModel of models) {
      const dataStream = new Readable({
        read() {},
      });

      const linkStream = new Readable({
        read() {},
      });

      this.exportService.streamModelData({
        dataStream,
        linkStream,
        projectId: project.id,
        modelId: sourceModel.id,
      });

      const headers: string[] = [];
      let chunk = [];

      const model = await Model.get(findWithIdentifier(idMap, sourceModel.id));

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
                    base_id: dupBaseId,
                    colId: id,
                  });
                  if (col.colOptions?.type === 'bt') {
                    const childCol = await Column.get({
                      base_id: dupBaseId,
                      colId: col.colOptions.fk_child_column_id,
                    });
                    headers.push(childCol.column_name);
                  } else {
                    headers.push(col.column_name);
                  }
                } else {
                  console.log('header not found', header);
                }
              }
              parser.resume();
            } else {
              if (results.errors.length === 0) {
                const row = {};
                for (let i = 0; i < headers.length; i++) {
                  if (results.data[i] !== '') {
                    row[headers[i]] = results.data[i];
                  }
                }
                chunk.push(row);
                if (chunk.length > 1000) {
                  parser.pause();
                  try {
                    await this.bulkDataService.bulkDataInsert({
                      projectName: dupProject.id,
                      tableName: model.id,
                      body: chunk,
                      cookie: null,
                      chunkSize: chunk.length + 1,
                      foreign_key_checks: false,
                      raw: true,
                    });
                  } catch (e) {
                    console.log(e);
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
                await this.bulkDataService.bulkDataInsert({
                  projectName: dupProject.id,
                  tableName: model.id,
                  body: chunk,
                  cookie: null,
                  chunkSize: chunk.length + 1,
                  foreign_key_checks: false,
                  raw: true,
                });
              } catch (e) {
                console.log(e);
              }
              chunk = [];
            }
            resolve(null);
          },
        });
      });

      const lHeaders: string[] = [];
      const mmParentChild: any = {};

      let pkIndex = -1;

      await new Promise((resolve) => {
        papaparse.parse(linkStream, {
          newline: '\r\n',
          step: async (results, parser) => {
            if (!lHeaders.length) {
              parser.pause();
              for (const header of results.data) {
                if (header === 'pk') {
                  lHeaders.push(null);
                  pkIndex = lHeaders.length - 1;
                  continue;
                }
                const id = idMap.get(header);
                if (id) {
                  const col = await Column.get({
                    base_id: dupBaseId,
                    colId: id,
                  });
                  if (
                    col.uidt === UITypes.LinkToAnotherRecord &&
                    col.colOptions.fk_mm_model_id &&
                    handledLinks.includes(col.colOptions.fk_mm_model_id)
                  ) {
                    lHeaders.push(null);
                  } else {
                    if (
                      col.uidt === UITypes.LinkToAnotherRecord &&
                      col.colOptions.fk_mm_model_id &&
                      !handledLinks.includes(col.colOptions.fk_mm_model_id)
                    ) {
                      const colOptions =
                        await col.getColOptions<LinkToAnotherRecordColumn>();

                      const vChildCol = await colOptions.getMMChildColumn();
                      const vParentCol = await colOptions.getMMParentColumn();

                      mmParentChild[col.colOptions.fk_mm_model_id] = {
                        parent: vParentCol.column_name,
                        child: vChildCol.column_name,
                      };

                      handledLinks.push(col.colOptions.fk_mm_model_id);
                    }
                    lHeaders.push(col.colOptions.fk_mm_model_id);
                    lChunk[col.colOptions.fk_mm_model_id] = [];
                  }
                }
              }
              parser.resume();
            } else {
              if (results.errors.length === 0) {
                for (let i = 0; i < lHeaders.length; i++) {
                  if (!lHeaders[i]) continue;

                  const mm = mmParentChild[lHeaders[i]];

                  for (const rel of results.data[i].split(',')) {
                    if (rel.trim() === '') continue;
                    lChunk[lHeaders[i]].push({
                      [mm.parent]: rel,
                      [mm.child]: results.data[pkIndex],
                    });
                  }
                }
              }
            }
          },
          complete: async () => {
            resolve(null);
          },
        });
      });

      elapsedTime(model.title);
    }

    for (const [k, v] of Object.entries(lChunk)) {
      try {
        await this.bulkDataService.bulkDataInsert({
          projectName: dupProject.id,
          tableName: k,
          body: v,
          cookie: null,
          chunkSize: 1000,
          foreign_key_checks: false,
          raw: true,
        });
      } catch (e) {
        console.log(e);
      }
    }

    elapsedTime('links');
    console.timeEnd('duplicateBase');
  }
}
