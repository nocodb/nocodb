import { Readable } from 'stream';
import { Injectable } from '@nestjs/common';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import { getViewAndModelByAliasOrId } from 'src/modules/datas/helpers';
import papaparse, { unparse } from 'papaparse';
import {
  clearPrefix,
  findWithIdentifier,
  generateBaseIdMap,
  getParentIdentifier,
  reverseGet,
  withoutId,
  withoutNull,
} from 'src/helpers/exportImportHelpers';
import NcPluginMgrv2 from 'src/helpers/NcPluginMgrv2';
import { NcError } from 'src/helpers/catchError';
import { Base, Column, Model, Project } from 'src/models';
import { DatasService } from './datas.service';
import { TablesService } from './tables.service';
import { ColumnsService } from './columns.service';
import { FiltersService } from './filters.service';
import { SortsService } from './sorts.service';
import { ViewColumnsService } from './view-columns.service';
import { GridColumnsService } from './grid-columns.service';
import { FormColumnsService } from './form-columns.service';
import { GridsService } from './grids.service';
import { FormsService } from './forms.service';
import { GalleriesService } from './galleries.service';
import { KanbansService } from './kanbans.service';
import { BulkDataAliasService } from './bulk-data-alias.service';
import type { ViewCreateReqType } from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn, User, View } from 'src/models';
import type { IStorageAdapterV2 } from 'nc-plugin';

@Injectable()
export class ExportImportService {
  constructor(
    private datasService: DatasService,
    private tablesService: TablesService,
    private columnsService: ColumnsService,
    private filtersService: FiltersService,
    private sortsService: SortsService,
    private viewColumnsService: ViewColumnsService,
    private gridColumnsService: GridColumnsService,
    private formColumnsService: FormColumnsService,
    private gridsService: GridsService,
    private formsService: FormsService,
    private galleriesService: GalleriesService,
    private kanbansService: KanbansService,
    private bulkDatasService: BulkDataAliasService,
  ) {}

  async serializeModels(param: { modelId: string[] }) {
    const serializedModels = [];

    // db id to structured id
    const idMap = new Map<string, string>();

    const projects: Project[] = [];
    const bases: Base[] = [];
    const modelsMap = new Map<string, Model[]>();

    for (const modelId of param.modelId) {
      const model = await Model.get(modelId);

      if (!model)
        return NcError.badRequest(`Model not found for id '${modelId}'`);

      const fndProject = projects.find((p) => p.id === model.project_id);
      const project = fndProject || (await Project.get(model.project_id));

      const fndBase = bases.find((b) => b.id === model.base_id);
      const base = fndBase || (await Base.get(model.base_id));

      if (!fndProject) projects.push(project);
      if (!fndBase) bases.push(base);

      if (!modelsMap.has(base.id)) {
        modelsMap.set(base.id, await generateBaseIdMap(base, idMap));
      }

      await model.getColumns();
      await model.getViews();

      for (const column of model.columns) {
        await column.getColOptions();
        if (column.colOptions) {
          for (const [k, v] of Object.entries(column.colOptions)) {
            switch (k) {
              case 'fk_mm_child_column_id':
              case 'fk_mm_parent_column_id':
              case 'fk_mm_model_id':
              case 'fk_parent_column_id':
              case 'fk_child_column_id':
              case 'fk_related_model_id':
              case 'fk_relation_column_id':
              case 'fk_lookup_column_id':
              case 'fk_rollup_column_id':
                column.colOptions[k] = idMap.get(v as string);
                break;
              case 'options':
                for (const o of column.colOptions['options']) {
                  delete o.id;
                  delete o.fk_column_id;
                }
                break;
              case 'formula':
                column.colOptions[k] = column.colOptions[k].replace(
                  /(?<=\{\{).*?(?=\}\})/gm,
                  (match) => idMap.get(match),
                );
                break;
              case 'id':
              case 'created_at':
              case 'updated_at':
              case 'fk_column_id':
                delete column.colOptions[k];
                break;
            }
          }
        }
      }

      for (const view of model.views) {
        idMap.set(view.id, `${idMap.get(model.id)}::${view.id}`);
        await view.getColumns();
        await view.getFilters();
        await view.getSorts();
        if (view.filter) {
          const export_filters = [];
          for (const fl of view.filter.children) {
            const tempFl = {
              id: `${idMap.get(view.id)}::${fl.id}`,
              fk_column_id: idMap.get(fl.fk_column_id),
              fk_parent_id: fl.fk_parent_id,
              is_group: fl.is_group,
              logical_op: fl.logical_op,
              comparison_op: fl.comparison_op,
              comparison_sub_op: fl.comparison_sub_op,
              value: fl.value,
            };
            if (tempFl.is_group) {
              delete tempFl.comparison_op;
              delete tempFl.comparison_sub_op;
              delete tempFl.value;
            }
            export_filters.push(tempFl);
          }
          view.filter.children = export_filters;
        }

        if (view.sorts) {
          const export_sorts = [];
          for (const sr of view.sorts) {
            const tempSr = {
              fk_column_id: idMap.get(sr.fk_column_id),
              direction: sr.direction,
            };
            export_sorts.push(tempSr);
          }
          view.sorts = export_sorts;
        }

        if (view.view) {
          for (const [k, v] of Object.entries(view.view)) {
            switch (k) {
              case 'fk_column_id':
              case 'fk_cover_image_col_id':
              case 'fk_grp_col_id':
                view.view[k] = idMap.get(v as string);
                break;
              case 'meta':
                if (view.type === ViewTypes.KANBAN) {
                  const meta = JSON.parse(view.view.meta as string) as Record<
                    string,
                    any
                  >;
                  for (const [k, v] of Object.entries(meta)) {
                    const colId = idMap.get(k as string);
                    for (const op of v) {
                      op.fk_column_id = idMap.get(op.fk_column_id);
                      delete op.id;
                    }
                    meta[colId] = v;
                    delete meta[k];
                  }
                  view.view.meta = meta;
                }
                break;
              case 'created_at':
              case 'updated_at':
              case 'fk_view_id':
              case 'project_id':
              case 'base_id':
              case 'uuid':
                delete view.view[k];
                break;
            }
          }
        }
      }

      serializedModels.push({
        entity: 'model',
        model: {
          id: idMap.get(model.id),
          prefix: project.prefix,
          title: model.title,
          table_name: clearPrefix(model.table_name, project.prefix),
          meta: model.meta,
          columns: model.columns.map((column) => ({
            id: idMap.get(column.id),
            ai: column.ai,
            column_name: column.column_name,
            cc: column.cc,
            cdf: column.cdf,
            meta: column.meta,
            pk: column.pk,
            order: column.order,
            rqd: column.rqd,
            system: column.system,
            uidt: column.uidt,
            title: column.title,
            un: column.un,
            unique: column.unique,
            colOptions: column.colOptions,
          })),
        },
        views: model.views.map((view) => ({
          id: idMap.get(view.id),
          is_default: view.is_default,
          type: view.type,
          meta: view.meta,
          order: view.order,
          title: view.title,
          show: view.show,
          show_system_fields: view.show_system_fields,
          filter: view.filter,
          sorts: view.sorts,
          lock_type: view.lock_type,
          columns: view.columns.map((column) => {
            const {
              id,
              fk_view_id,
              fk_column_id,
              project_id,
              base_id,
              created_at,
              updated_at,
              uuid,
              ...rest
            } = column as any;
            return {
              fk_column_id: idMap.get(fk_column_id),
              ...rest,
            };
          }),
          view: view.view,
        })),
      });
    }

    return serializedModels;
  }

  async exportModelData(param: {
    storageAdapter: IStorageAdapterV2;
    path: string;
    projectId: string;
    modelId: string;
    viewId?: string;
  }) {
    const { model, view } = await getViewAndModelByAliasOrId({
      projectName: param.projectId,
      tableName: param.modelId,
      viewName: param.viewId,
    });

    await model.getColumns();

    const hasLink = model.columns.some(
      (c) =>
        c.uidt === UITypes.LinkToAnotherRecord && c.colOptions?.type === 'mm',
    );

    const pkMap = new Map<string, string>();

    for (const column of model.columns.filter(
      (c) =>
        c.uidt === UITypes.LinkToAnotherRecord && c.colOptions?.type !== 'hm',
    )) {
      const relatedTable = await (
        (await column.getColOptions()) as LinkToAnotherRecordColumn
      ).getRelatedTable();

      await relatedTable.getColumns();

      pkMap.set(column.id, relatedTable.primaryKey.title);
    }

    const readableStream = new Readable({
      read() {},
    });

    const readableLinkStream = new Readable({
      read() {},
    });

    readableStream.setEncoding('utf8');

    readableLinkStream.setEncoding('utf8');

    const storageAdapter = param.storageAdapter;

    const uploadPromise = storageAdapter.fileCreateByStream(
      `${param.path}/${model.id}.csv`,
      readableStream,
    );

    const uploadLinkPromise = hasLink
      ? storageAdapter.fileCreateByStream(
          `${param.path}/${model.id}_links.csv`,
          readableLinkStream,
        )
      : Promise.resolve();

    const limit = 100;
    const offset = 0;

    const primaryKey = model.columns.find((c) => c.pk);

    const formatData = (data: any) => {
      const linkData = [];
      for (const row of data) {
        const pkValue = primaryKey ? row[primaryKey.title] : undefined;
        const linkRow = {};
        for (const [k, v] of Object.entries(row)) {
          const col = model.columns.find((c) => c.title === k);
          if (col) {
            if (col.pk) linkRow['pk'] = pkValue;
            const colId = `${col.project_id}::${col.base_id}::${col.fk_model_id}::${col.id}`;
            switch (col.uidt) {
              case UITypes.LinkToAnotherRecord:
                {
                  if (col.system || col.colOptions.type === 'hm') break;

                  const pkList = [];
                  const links = Array.isArray(v) ? v : [v];

                  for (const link of links) {
                    if (link) {
                      for (const [k, val] of Object.entries(link)) {
                        if (k === pkMap.get(col.id)) {
                          pkList.push(val);
                        }
                      }
                    }
                  }

                  if (col.colOptions.type === 'mm') {
                    linkRow[colId] = pkList.join(',');
                  } else {
                    row[colId] = pkList[0];
                  }
                }
                break;
              case UITypes.Attachment:
                try {
                  row[colId] = JSON.stringify(v);
                } catch (e) {
                  row[colId] = v;
                }
                break;
              case UITypes.ForeignKey:
              case UITypes.Formula:
              case UITypes.Lookup:
              case UITypes.Rollup:
              case UITypes.Rating:
              case UITypes.Barcode:
                // skip these types
                break;
              default:
                row[colId] = v;
                break;
            }
            delete row[k];
          }
        }
        linkData.push(linkRow);
      }
      return { data, linkData };
    };

    try {
      await this.recursiveRead(
        formatData,
        readableStream,
        readableLinkStream,
        model,
        view,
        offset,
        limit,
        true,
      );
      await uploadPromise;
      await uploadLinkPromise;
    } catch (e) {
      await storageAdapter.fileDelete(`${param.path}/${model.id}.csv`);
      await storageAdapter.fileDelete(`${param.path}/${model.id}_links.csv`);
      console.error(e);
      throw e;
    }

    return true;
  }

  async recursiveRead(
    formatter: (data: any) => { data: any; linkData: any },
    stream: Readable,
    linkStream: Readable,
    model: Model,
    view: View,
    offset: number,
    limit: number,
    header = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.datasService
        .getDataList({ model, view, query: { limit, offset } })
        .then((result) => {
          try {
            if (!header) {
              stream.push('\r\n');
              linkStream.push('\r\n');
            }
            const { data, linkData } = formatter(result.list);
            stream.push(unparse(data, { header }));
            linkStream.push(unparse(linkData, { header }));
            if (result.pageInfo.isLastPage) {
              stream.push(null);
              linkStream.push(null);
              resolve();
            } else {
              this.recursiveRead(
                formatter,
                stream,
                linkStream,
                model,
                view,
                offset + limit,
                limit,
              ).then(resolve);
            }
          } catch (e) {
            reject(e);
          }
        });
    });
  }

  /*
    async exportBaseSchema(param: { baseId: string }) {
      const base = await Base.get(param.baseId);

      if (!base)
        return NcError.badRequest(`Base not found for id '${param.baseId}'`);

      const project = await Project.get(base.project_id);

      const models = (await base.getModels()).filter(
        (m) => !m.mm && m.type === 'table',
      );

      const exportedModels = await this.serializeModels({
        modelId: models.map((m) => m.id),
      });

      const exportData = {
        id: `${project.id}::${base.id}`,
        entity: 'base',
        models: exportedModels,
      };

      return exportData;
    }
  */

  async exportBase(param: { path: string; baseId: string }) {
    const base = await Base.get(param.baseId);

    if (!base)
      return NcError.badRequest(`Base not found for id '${param.baseId}'`);

    const project = await Project.get(base.project_id);

    const models = (await base.getModels()).filter(
      (m) => !m.mm && m.type === 'table',
    );

    const exportedModels = await this.serializeModels({
      modelId: models.map((m) => m.id),
    });

    const exportData = {
      id: `${project.id}::${base.id}`,
      entity: 'base',
      models: exportedModels,
    };

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    const destPath = `export/${project.id}/${base.id}/${param.path}/schema.json`;

    try {
      const readableStream = new Readable({
        read() {},
      });

      readableStream.setEncoding('utf8');

      readableStream.push(JSON.stringify(exportData));

      readableStream.push(null);

      await storageAdapter.fileCreateByStream(destPath, readableStream);

      for (const model of models) {
        await this.exportModelData({
          storageAdapter,
          path: `export/${project.id}/${base.id}/${param.path}/data`,
          projectId: project.id,
          modelId: model.id,
        });
      }
    } catch (e) {
      console.error(e);
      return NcError.internalServerError('Error while exporting base');
    }

    return true;
  }

  async importModels(param: {
    user: User;
    projectId: string;
    baseId: string;
    data:
      | { models: { model: any; views: any[] }[] }
      | { model: any; views: any[] }[];
    req: any;
  }) {
    // structured id to db id
    const idMap = new Map<string, string>();

    const project = await Project.get(param.projectId);

    if (!project)
      return NcError.badRequest(
        `Project not found for id '${param.projectId}'`,
      );

    const base = await Base.get(param.baseId);

    if (!base)
      return NcError.badRequest(`Base not found for id '${param.baseId}'`);

    const tableReferences = new Map<string, Model>();
    const linkMap = new Map<string, string>();

    param.data = Array.isArray(param.data) ? param.data : param.data.models;

    // create tables with static columns
    for (const data of param.data) {
      const modelData = data.model;

      const reducedColumnSet = modelData.columns.filter(
        (a) =>
          a.uidt !== UITypes.LinkToAnotherRecord &&
          a.uidt !== UITypes.Lookup &&
          a.uidt !== UITypes.Rollup &&
          a.uidt !== UITypes.Formula &&
          a.uidt !== UITypes.ForeignKey,
      );

      // create table with static columns
      const table = await this.tablesService.tableCreate({
        projectId: project.id,
        baseId: base.id,
        user: param.user,
        table: withoutId({
          ...modelData,
          columns: reducedColumnSet.map((a) => withoutId(a)),
        }),
      });

      idMap.set(modelData.id, table.id);

      // map column id's with new created column id's
      for (const col of table.columns) {
        const colRef = modelData.columns.find(
          (a) => a.column_name === col.column_name,
        );
        idMap.set(colRef.id, col.id);
      }

      tableReferences.set(modelData.id, table);
    }

    const referencedColumnSet = [];

    // create columns with reference to other columns
    for (const data of param.data) {
      const modelData = data.model;
      const table = tableReferences.get(modelData.id);

      const linkedColumnSet = modelData.columns.filter(
        (a) => a.uidt === UITypes.LinkToAnotherRecord,
      );

      // create columns with reference to other columns
      for (const col of linkedColumnSet) {
        if (col.colOptions) {
          const colOptions = col.colOptions;
          if (
            col.uidt === UITypes.LinkToAnotherRecord &&
            idMap.has(colOptions.fk_related_model_id)
          ) {
            if (colOptions.type === 'mm') {
              if (!linkMap.has(colOptions.fk_mm_model_id)) {
                // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
                delete col.column_name;

                const freshModelData = await this.columnsService.columnAdd({
                  tableId: table.id,
                  column: withoutId({
                    ...col,
                    ...{
                      parentId: idMap.get(
                        getParentIdentifier(colOptions.fk_child_column_id),
                      ),
                      childId: idMap.get(
                        getParentIdentifier(colOptions.fk_parent_column_id),
                      ),
                      type: colOptions.type,
                      virtual: colOptions.virtual,
                      ur: colOptions.ur,
                      dr: colOptions.dr,
                    },
                  }),
                  req: param.req,
                });

                for (const nColumn of freshModelData.columns) {
                  if (nColumn.title === col.title) {
                    idMap.set(col.id, nColumn.id);
                    linkMap.set(
                      colOptions.fk_mm_model_id,
                      nColumn.colOptions.fk_mm_model_id,
                    );
                    break;
                  }
                }

                const childModel =
                  getParentIdentifier(colOptions.fk_parent_column_id) ===
                  modelData.id
                    ? freshModelData
                    : await Model.get(
                        idMap.get(
                          getParentIdentifier(colOptions.fk_parent_column_id),
                        ),
                      );

                if (
                  getParentIdentifier(colOptions.fk_parent_column_id) !==
                  modelData.id
                )
                  await childModel.getColumns();

                const childColumn = param.data
                  .find(
                    (a) =>
                      a.model.id ===
                      getParentIdentifier(colOptions.fk_parent_column_id),
                  )
                  .model.columns.find(
                    (a) =>
                      a.colOptions?.fk_mm_model_id ===
                        colOptions.fk_mm_model_id && a.id !== col.id,
                  );

                for (const nColumn of childModel.columns) {
                  if (
                    nColumn?.colOptions?.fk_mm_model_id ===
                      linkMap.get(colOptions.fk_mm_model_id) &&
                    nColumn.id !== idMap.get(col.id)
                  ) {
                    idMap.set(childColumn.id, nColumn.id);

                    if (nColumn.title !== childColumn.title) {
                      await this.columnsService.columnUpdate({
                        columnId: nColumn.id,
                        column: {
                          ...nColumn,
                          column_name: childColumn.title,
                          title: childColumn.title,
                        },
                      });
                    }
                    break;
                  }
                }
              }
            } else if (colOptions.type === 'hm') {
              // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
              delete col.column_name;

              const freshModelData = await this.columnsService.columnAdd({
                tableId: table.id,
                column: withoutId({
                  ...col,
                  ...{
                    parentId: idMap.get(
                      getParentIdentifier(colOptions.fk_parent_column_id),
                    ),
                    childId: idMap.get(
                      getParentIdentifier(colOptions.fk_child_column_id),
                    ),
                    type: colOptions.type,
                    virtual: colOptions.virtual,
                    ur: colOptions.ur,
                    dr: colOptions.dr,
                  },
                }),
                req: param.req,
              });

              for (const nColumn of freshModelData.columns) {
                if (nColumn.title === col.title) {
                  idMap.set(col.id, nColumn.id);
                  idMap.set(
                    colOptions.fk_parent_column_id,
                    nColumn.colOptions.fk_parent_column_id,
                  );
                  idMap.set(
                    colOptions.fk_child_column_id,
                    nColumn.colOptions.fk_child_column_id,
                  );
                  break;
                }
              }

              const childModel =
                colOptions.fk_related_model_id === modelData.id
                  ? freshModelData
                  : await Model.get(idMap.get(colOptions.fk_related_model_id));

              if (colOptions.fk_related_model_id !== modelData.id)
                await childModel.getColumns();

              const childColumn = param.data
                .find((a) => a.model.id === colOptions.fk_related_model_id)
                .model.columns.find(
                  (a) =>
                    a.colOptions?.fk_parent_column_id ===
                      colOptions.fk_parent_column_id &&
                    a.colOptions?.fk_child_column_id ===
                      colOptions.fk_child_column_id &&
                    a.id !== col.id,
                );

              for (const nColumn of childModel.columns) {
                if (
                  nColumn.id !== idMap.get(col.id) &&
                  nColumn.colOptions?.fk_parent_column_id ===
                    idMap.get(colOptions.fk_parent_column_id) &&
                  nColumn.colOptions?.fk_child_column_id ===
                    idMap.get(colOptions.fk_child_column_id)
                ) {
                  idMap.set(childColumn.id, nColumn.id);

                  if (nColumn.title !== childColumn.title) {
                    await this.columnsService.columnUpdate({
                      columnId: nColumn.id,
                      column: {
                        ...nColumn,
                        column_name: childColumn.title,
                        title: childColumn.title,
                      },
                    });
                  }
                  break;
                }
              }
            }
          }
        }
      }

      referencedColumnSet.push(
        ...modelData.columns.filter(
          (a) =>
            a.uidt === UITypes.Lookup ||
            a.uidt === UITypes.Rollup ||
            a.uidt === UITypes.Formula,
        ),
      );
    }

    const sortedReferencedColumnSet = [];

    // sort referenced columns to avoid referencing before creation
    for (const col of referencedColumnSet) {
      const relatedColIds = [];
      if (col.colOptions?.fk_lookup_column_id) {
        relatedColIds.push(col.colOptions.fk_lookup_column_id);
      }
      if (col.colOptions?.fk_rollup_column_id) {
        relatedColIds.push(col.colOptions.fk_rollup_column_id);
      }
      if (col.colOptions?.formula) {
        relatedColIds.push(
          ...col.colOptions.formula.match(/(?<=\{\{).*?(?=\}\})/gm),
        );
      }

      // find the last related column in the sorted array
      let fnd = undefined;
      for (let i = sortedReferencedColumnSet.length - 1; i >= 0; i--) {
        if (relatedColIds.includes(sortedReferencedColumnSet[i].id)) {
          fnd = sortedReferencedColumnSet[i];
          break;
        }
      }

      if (!fnd) {
        sortedReferencedColumnSet.unshift(col);
      } else {
        sortedReferencedColumnSet.splice(
          sortedReferencedColumnSet.indexOf(fnd) + 1,
          0,
          col,
        );
      }
    }

    // create referenced columns
    for (const col of sortedReferencedColumnSet) {
      const { colOptions, ...flatCol } = col;
      if (col.uidt === UITypes.Lookup) {
        if (!idMap.get(colOptions.fk_relation_column_id)) continue;
        const freshModelData = await this.columnsService.columnAdd({
          tableId: idMap.get(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              fk_lookup_column_id: idMap.get(colOptions.fk_lookup_column_id),
              fk_relation_column_id: idMap.get(
                colOptions.fk_relation_column_id,
              ),
            },
          }),
          req: param.req,
        });

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (col.uidt === UITypes.Rollup) {
        if (!idMap.get(colOptions.fk_relation_column_id)) continue;
        const freshModelData = await this.columnsService.columnAdd({
          tableId: idMap.get(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              fk_rollup_column_id: idMap.get(colOptions.fk_rollup_column_id),
              fk_relation_column_id: idMap.get(
                colOptions.fk_relation_column_id,
              ),
              rollup_function: colOptions.rollup_function,
            },
          }),
          req: param.req,
        });

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (col.uidt === UITypes.Formula) {
        const freshModelData = await this.columnsService.columnAdd({
          tableId: idMap.get(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              formula_raw: colOptions.formula_raw,
            },
          }),
          req: param.req,
        });

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      }
    }

    // create views
    for (const data of param.data) {
      const modelData = data.model;
      const viewsData = data.views;

      const table = tableReferences.get(modelData.id);

      // get default view
      await table.getViews();

      for (const view of viewsData) {
        const viewData = withoutId({
          ...view,
        });

        const vw = await this.createView(idMap, table, viewData, table.views);

        if (!vw) continue;

        idMap.set(view.id, vw.id);

        // create filters
        const filters = view.filter.children;

        for (const fl of filters) {
          const fg = await this.filtersService.filterCreate({
            viewId: vw.id,
            filter: withoutId({
              ...fl,
              fk_column_id: idMap.get(fl.fk_column_id),
              fk_parent_id: idMap.get(fl.fk_parent_id),
            }),
          });

          idMap.set(fl.id, fg.id);
        }

        // create sorts
        for (const sr of view.sorts) {
          await this.sortsService.sortCreate({
            viewId: vw.id,
            sort: withoutId({
              ...sr,
              fk_column_id: idMap.get(sr.fk_column_id),
            }),
          });
        }

        // update view columns
        const vwColumns = await this.viewColumnsService.columnList({
          viewId: vw.id,
        });

        for (const cl of vwColumns) {
          const fcl = view.columns.find(
            (a) => a.fk_column_id === reverseGet(idMap, cl.fk_column_id),
          );
          if (!fcl) continue;
          await this.viewColumnsService.columnUpdate({
            viewId: vw.id,
            columnId: cl.id,
            column: {
              show: fcl.show,
              order: fcl.order,
            },
          });
        }

        switch (vw.type) {
          case ViewTypes.GRID:
            for (const cl of vwColumns) {
              const fcl = view.columns.find(
                (a) => a.fk_column_id === reverseGet(idMap, cl.fk_column_id),
              );
              if (!fcl) continue;
              const { fk_column_id, ...rest } = fcl;
              await this.gridColumnsService.gridColumnUpdate({
                gridViewColumnId: cl.id,
                grid: {
                  ...withoutNull(rest),
                },
              });
            }
            break;
          case ViewTypes.FORM:
            for (const cl of vwColumns) {
              const fcl = view.columns.find(
                (a) => a.fk_column_id === reverseGet(idMap, cl.fk_column_id),
              );
              if (!fcl) continue;
              const { fk_column_id, ...rest } = fcl;
              await this.formColumnsService.columnUpdate({
                formViewColumnId: cl.id,
                formViewColumn: {
                  ...withoutNull(rest),
                },
              });
            }
            break;
          case ViewTypes.GALLERY:
          case ViewTypes.KANBAN:
            break;
        }
      }
    }

    return idMap;
  }

  async createView(
    idMap: Map<string, string>,
    md: Model,
    vw: Partial<View>,
    views: View[],
  ): Promise<View> {
    if (vw.is_default) {
      const view = views.find((a) => a.is_default);
      if (view) {
        const gridData = withoutNull(vw.view);
        if (gridData) {
          await this.gridsService.gridViewUpdate({
            viewId: view.id,
            grid: gridData,
          });
        }
      }
      return view;
    }

    switch (vw.type) {
      case ViewTypes.GRID: {
        const gview = await this.gridsService.gridViewCreate({
          tableId: md.id,
          grid: vw as ViewCreateReqType,
        });
        const gridData = withoutNull(vw.view);
        if (gridData) {
          await this.gridsService.gridViewUpdate({
            viewId: gview.id,
            grid: gridData,
          });
        }
        return gview;
      }
      case ViewTypes.FORM: {
        const fview = await this.formsService.formViewCreate({
          tableId: md.id,
          body: vw as ViewCreateReqType,
        });
        const formData = withoutNull(vw.view);
        if (formData) {
          await this.formsService.formViewUpdate({
            formViewId: fview.id,
            form: formData,
          });
        }
        return fview;
      }
      case ViewTypes.GALLERY: {
        const glview = await this.galleriesService.galleryViewCreate({
          tableId: md.id,
          gallery: vw as ViewCreateReqType,
        });
        const galleryData = withoutNull(vw.view);
        if (galleryData) {
          for (const [k, v] of Object.entries(galleryData)) {
            switch (k) {
              case 'fk_cover_image_col_id':
                galleryData[k] = idMap.get(v as string);
                break;
            }
          }
          await this.galleriesService.galleryViewUpdate({
            galleryViewId: glview.id,
            gallery: galleryData,
          });
        }
        return glview;
      }
      case ViewTypes.KANBAN: {
        const kview = await this.kanbansService.kanbanViewCreate({
          tableId: md.id,
          kanban: vw as ViewCreateReqType,
        });
        const kanbanData = withoutNull(vw.view);
        if (kanbanData) {
          for (const [k, v] of Object.entries(kanbanData)) {
            switch (k) {
              case 'fk_grp_col_id':
              case 'fk_cover_image_col_id':
                kanbanData[k] = idMap.get(v as string);
                break;
              case 'meta': {
                const meta = {};
                for (const [mk, mv] of Object.entries(v as any)) {
                  const tempVal = [];
                  for (const vl of mv as any) {
                    if (vl.fk_column_id) {
                      tempVal.push({
                        ...vl,
                        fk_column_id: idMap.get(vl.fk_column_id),
                      });
                    } else {
                      delete vl.fk_column_id;
                      tempVal.push({
                        ...vl,
                        id: 'uncategorized',
                      });
                    }
                  }
                  meta[idMap.get(mk)] = tempVal;
                }
                kanbanData[k] = meta;
                break;
              }
            }
          }
          await this.kanbansService.kanbanViewUpdate({
            kanbanViewId: kview.id,
            kanban: kanbanData,
          });
        }
        return kview;
      }
    }

    return null;
  }

  async importBase(param: {
    user: User;
    projectId: string;
    baseId: string;
    src: {
      type: 'local' | 'url' | 'file';
      path?: string;
      url?: string;
      file?: any;
    };
    req: any;
  }) {
    const { user, projectId, baseId, src, req } = param;

    const debug = req.params.debug === 'true';

    const debugLog = (...args: any[]) => {
      if (!debug) return;
      console.log(...args);
    };

    let start = process.hrtime();

    const elapsedTime = function (label?: string) {
      const elapsedS = process.hrtime(start)[0].toFixed(3);
      const elapsedMs = process.hrtime(start)[1] / 1000000;
      if (label) debugLog(`${label}: ${elapsedS}s ${elapsedMs}ms`);
      start = process.hrtime();
    };

    switch (src.type) {
      case 'local': {
        const path = src.path.replace(/\/$/, '');

        const storageAdapter = await NcPluginMgrv2.storageAdapter();

        try {
          const schema = JSON.parse(
            await storageAdapter.fileRead(`${path}/schema.json`),
          );

          elapsedTime('read schema');

          // store fk_mm_model_id (mm) to link once
          const handledLinks = [];

          const idMap = await this.importModels({
            user,
            projectId,
            baseId,
            data: schema,
            req,
          });

          elapsedTime('import models');

          if (idMap) {
            const files = await storageAdapter.getDirectoryList(`${path}/data`);
            const dataFiles = files.filter(
              (file) => !file.match(/_links\.csv$/),
            );
            const linkFiles = files.filter((file) =>
              file.match(/_links\.csv$/),
            );

            for (const file of dataFiles) {
              const readStream = await storageAdapter.fileReadByStream(
                `${path}/data/${file}`,
              );

              const headers: string[] = [];
              let chunk = [];

              const modelId = findWithIdentifier(
                idMap,
                file.replace(/\.csv$/, ''),
              );

              const model = await Model.get(modelId);

              debugLog(`Importing ${model.title}...`);

              await new Promise((resolve) => {
                papaparse.parse(readStream, {
                  newline: '\r\n',
                  step: async function (results, parser) {
                    if (!headers.length) {
                      parser.pause();
                      for (const header of results.data) {
                        const id = idMap.get(header);
                        if (id) {
                          const col = await Column.get({
                            base_id: baseId,
                            colId: id,
                          });
                          if (col.colOptions?.type === 'bt') {
                            const childCol = await Column.get({
                              base_id: baseId,
                              colId: col.colOptions.fk_child_column_id,
                            });
                            headers.push(childCol.column_name);
                          } else {
                            headers.push(col.column_name);
                          }
                        } else {
                          debugLog(header);
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
                        if (chunk.length > 100) {
                          parser.pause();
                          elapsedTime('before import chunk');
                          try {
                            await this.bulkDatasService.bulkDataInsert({
                              projectName: projectId,
                              tableName: modelId,
                              body: chunk,
                              cookie: null,
                              chunkSize: chunk.length + 1,
                              foreign_key_checks: false,
                              raw: true,
                            });
                          } catch (e) {
                            debugLog(`${model.title} import throwed an error!`);
                            console.log(e);
                          }
                          chunk = [];
                          elapsedTime('after import chunk');
                          parser.resume();
                        }
                      }
                    }
                  },
                  complete: async function () {
                    if (chunk.length > 0) {
                      elapsedTime('before import chunk');
                      try {
                        await this.bulkDatasService.bulkDataInsert({
                          projectName: projectId,
                          tableName: modelId,
                          body: chunk,
                          cookie: null,
                          chunkSize: chunk.length + 1,
                          foreign_key_checks: false,
                          raw: true,
                        });
                      } catch (e) {
                        debugLog(chunk);
                        console.log(e);
                      }
                      chunk = [];
                      elapsedTime('after import chunk');
                    }
                    resolve(null);
                  },
                });
              });
            }

            // reset timer
            elapsedTime();

            for (const file of linkFiles) {
              const readStream = await storageAdapter.fileReadByStream(
                `${path}/data/${file}`,
              );

              const headers: string[] = [];
              const mmParentChild: any = {};
              const chunk: Record<string, any[]> = {}; // colId: { rowId, childId }[]

              const modelId = findWithIdentifier(
                idMap,
                file.replace(/_links\.csv$/, ''),
              );
              const model = await Model.get(modelId);

              let pkIndex = -1;

              debugLog(`Linking ${model.title}...`);

              await new Promise((resolve) => {
                papaparse.parse(readStream, {
                  newline: '\r\n',
                  step: async function (results, parser) {
                    if (!headers.length) {
                      parser.pause();
                      for (const header of results.data) {
                        if (header === 'pk') {
                          headers.push(null);
                          pkIndex = headers.length - 1;
                          continue;
                        }
                        const id = idMap.get(header);
                        if (id) {
                          const col = await Column.get({
                            base_id: baseId,
                            colId: id,
                          });
                          if (
                            col.uidt === UITypes.LinkToAnotherRecord &&
                            col.colOptions.fk_mm_model_id &&
                            handledLinks.includes(col.colOptions.fk_mm_model_id)
                          ) {
                            headers.push(null);
                          } else {
                            if (
                              col.uidt === UITypes.LinkToAnotherRecord &&
                              col.colOptions.fk_mm_model_id &&
                              !handledLinks.includes(
                                col.colOptions.fk_mm_model_id,
                              )
                            ) {
                              const colOptions =
                                await col.getColOptions<LinkToAnotherRecordColumn>();

                              const vChildCol =
                                await colOptions.getMMChildColumn();
                              const vParentCol =
                                await colOptions.getMMParentColumn();

                              mmParentChild[col.colOptions.fk_mm_model_id] = {
                                parent: vParentCol.column_name,
                                child: vChildCol.column_name,
                              };

                              handledLinks.push(col.colOptions.fk_mm_model_id);
                            }
                            headers.push(col.colOptions.fk_mm_model_id);
                            chunk[col.colOptions.fk_mm_model_id] = [];
                          }
                        }
                      }
                      parser.resume();
                    } else {
                      if (results.errors.length === 0) {
                        for (let i = 0; i < headers.length; i++) {
                          if (!headers[i]) continue;

                          const mm = mmParentChild[headers[i]];

                          for (const rel of results.data[i].split(',')) {
                            if (rel.trim() === '') continue;
                            chunk[headers[i]].push({
                              [mm.parent]: rel,
                              [mm.child]: results.data[pkIndex],
                            });
                          }
                        }
                      }
                    }
                  },
                  complete: async function () {
                    for (const [k, v] of Object.entries(chunk)) {
                      try {
                        elapsedTime('prepare link chunk');
                        await this.bulkDatasService.bulkDataInsert({
                          projectName: projectId,
                          tableName: k,
                          body: v,
                          cookie: null,
                          chunkSize: 1000,
                          foreign_key_checks: false,
                          raw: true,
                        });
                        elapsedTime('insert link chunk');
                      } catch (e) {
                        console.log(e);
                      }
                    }
                    resolve(null);
                  },
                });
              });
            }
          }
        } catch (e) {
          throw new Error(e);
        }
        break;
      }
      case 'url':
        break;
      case 'file':
        break;
    }
  }
}
