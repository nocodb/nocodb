import { Readable } from 'stream';
import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Column, Model } from 'src/models';
import { Job } from 'bull';
import { ProjectsService } from 'src/services/projects.service';
import boxen from 'boxen';
import papaparse from 'papaparse';
import { findWithIdentifier } from 'src/helpers/exportImportHelpers';
import { BulkDataAliasService } from 'src/services/bulk-data-alias.service';
import { UITypes } from 'nocodb-sdk';
import { forwardRef, Inject } from '@nestjs/common';
import { JobsGateway } from '../jobs.gateway';
import { ExportService } from './export.service';
import { ImportService } from './import.service';
import type { LinkToAnotherRecordColumn } from 'src/models';

const DEBUG = false;

@Processor('jobs')
export class DuplicateProcessor {
  constructor(
    private readonly exportService: ExportService,
    private readonly importService: ImportService,
    private readonly projectsService: ProjectsService,
    private readonly bulkDataService: BulkDataAliasService,
    @Inject(forwardRef(() => JobsGateway))
    private readonly jobsGateway: JobsGateway,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.jobsGateway.jobStatus({
      name: job.name,
      id: job.id.toString(),
      status: 'active',
    });
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    console.error(
      boxen(
        `---- !! JOB FAILED !! ----\nname: ${job.name}\nid:${job.id}\nerror:${error.name} (${error.message})\n\nstack: ${error.stack}`,
        {
          padding: 1,
          borderStyle: 'double',
          borderColor: 'yellow',
        },
      ),
    );

    this.jobsGateway.jobStatus({
      name: job.name,
      id: job.id.toString(),
      status: 'failed',
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.jobsGateway.jobStatus({
      name: job.name,
      id: job.id.toString(),
      status: 'completed',
    });
  }

  @Process('duplicate')
  async duplicateBase(job: Job) {
    const { project, base, dupProject, req } = job.data;

    try {
      let start = process.hrtime();

      const debugLog = function (...args: any[]) {
        if (DEBUG) {
          console.log(...args);
        }
      };

      const elapsedTime = function (label?: string) {
        const elapsedS = process.hrtime(start)[0].toFixed(3);
        const elapsedMs = process.hrtime(start)[1] / 1000000;
        if (label) debugLog(`${label}: ${elapsedS}s ${elapsedMs}ms`);
        start = process.hrtime();
      };

      const user = (req as any).user;

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

      const dupBaseId = dupProject.bases[0].id;

      elapsedTime('projectCreate');

      const idMap = await this.importService.importModels({
        user,
        projectId: dupProject.id,
        baseId: dupBaseId,
        data: exportedModels,
        req: req,
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

        const model = await Model.get(
          findWithIdentifier(idMap, sourceModel.id),
        );

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
                    debugLog('header not found', header);
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
      await this.projectsService.projectUpdate({
        projectId: dupProject.id,
        project: {
          status: null,
        },
      });
    } catch (e) {
      if (dupProject?.id) {
        await this.projectsService.projectSoftDelete({
          projectId: dupProject.id,
        });
      }
      throw e;
    }
  }
}
