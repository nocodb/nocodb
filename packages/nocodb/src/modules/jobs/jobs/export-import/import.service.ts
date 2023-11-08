import { UITypes, ViewTypes } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import papaparse from 'papaparse';
import debug from 'debug';
import { isLinksOrLTAR } from 'nocodb-sdk';
import { elapsedTime, initTime } from '../../helpers';
import type { Readable } from 'stream';
import type { UserType, ViewCreateReqType } from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn, User, View } from '~/models';
import type { NcRequest } from '~/interface/config';
import {
  findWithIdentifier,
  generateUniqueName,
  getEntityIdentifier,
  getParentIdentifier,
  reverseGet,
  withoutId,
  withoutNull,
} from '~/helpers/exportImportHelpers';
import { NcError } from '~/helpers/catchError';
import { Base, Column, Model, Source } from '~/models';
import { TablesService } from '~/services/tables.service';
import { ColumnsService } from '~/services/columns.service';
import { FiltersService } from '~/services/filters.service';
import { SortsService } from '~/services/sorts.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { GridColumnsService } from '~/services/grid-columns.service';
import { FormColumnsService } from '~/services/form-columns.service';
import { GridsService } from '~/services/grids.service';
import { FormsService } from '~/services/forms.service';
import { GalleriesService } from '~/services/galleries.service';
import { KanbansService } from '~/services/kanbans.service';
import { HooksService } from '~/services/hooks.service';
import { ViewsService } from '~/services/views.service';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { sanitizeColumnName } from '~/helpers';

@Injectable()
export class ImportService {
  private readonly debugLog = debug('nc:jobs:import');

  constructor(
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
    private bulkDataService: BulkDataAliasService,
    private hooksService: HooksService,
    private viewsService: ViewsService,
  ) {}

  async importModels(param: {
    user: User;
    baseId: string;
    sourceId: string;
    data:
      | { models: { model: any; views: any[]; hooks?: any[] }[] }
      | { model: any; views: any[]; hooks?: any[] }[];
    req: NcRequest;
    externalModels?: Model[];
  }) {
    const hrTime = initTime();

    // structured id to db id
    const idMap = new Map<string, string>();
    const externalIdMap = new Map<string, string>();

    const getIdOrExternalId = (k: string) => {
      return idMap.get(k) || externalIdMap.get(k);
    };

    const base = await Base.get(param.baseId);

    if (!base)
      return NcError.badRequest(`Base not found for id '${param.baseId}'`);

    const source = await Source.get(param.sourceId);

    if (!source)
      return NcError.badRequest(`Source not found for id '${param.sourceId}'`);

    const tableReferences = new Map<string, Model>();
    const linkMap = new Map<string, string>();

    param.data = Array.isArray(param.data) ? param.data : param.data.models;

    // allow existing models to be linked
    if (param.externalModels) {
      for (const model of param.externalModels) {
        externalIdMap.set(
          `${model.base_id}::${model.source_id}::${model.id}`,
          model.id,
        );

        await model.getColumns();

        const primaryKey = model.primaryKey;
        if (primaryKey) {
          idMap.set(
            `${model.base_id}::${model.source_id}::${model.id}::${primaryKey.id}`,
            primaryKey.id,
          );
        }

        for (const col of model.columns) {
          externalIdMap.set(
            `${model.base_id}::${model.source_id}::${model.id}::${col.id}`,
            col.id,
          );
        }
      }
    }

    elapsedTime(hrTime, 'generate id map for external models', 'importModels');

    // create tables with static columns
    for (const data of param.data) {
      const modelData = data.model;

      const reducedColumnSet = modelData.columns.filter(
        (a) =>
          !isLinksOrLTAR(a) &&
          a.uidt !== UITypes.Lookup &&
          a.uidt !== UITypes.Rollup &&
          a.uidt !== UITypes.Formula &&
          a.uidt !== UITypes.ForeignKey,
      );

      // create table with static columns
      const table = await this.tablesService.tableCreate({
        baseId: base.id,
        sourceId: source.id,
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
          (a) => sanitizeColumnName(a.column_name) === col.column_name,
        );
        idMap.set(colRef.id, col.id);

        // setval for auto increment column in pg
        if (source.type === 'pg') {
          if (modelData.pgSerialLastVal) {
            if (col.ai) {
              const baseModel = await Model.getBaseModelSQL({
                id: table.id,
                viewId: null,
                dbDriver: await NcConnectionMgrv2.get(source),
              });
              const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
              await sqlClient.raw(
                `SELECT setval(pg_get_serial_sequence('??', ?), ?);`,
                [
                  baseModel.getTnPath(table.table_name),
                  col.column_name,
                  modelData.pgSerialLastVal,
                ],
              );
            }
          }
        }
      }

      tableReferences.set(modelData.id, table);
    }

    elapsedTime(hrTime, 'create tables with static columns', 'importModels');

    const referencedColumnSet = [];

    // create LTAR columns
    for (const data of param.data) {
      const modelData = data.model;
      const table = tableReferences.get(modelData.id);

      const linkedColumnSet = modelData.columns.filter((a) => isLinksOrLTAR(a));

      for (const col of linkedColumnSet) {
        if (col.colOptions) {
          const colOptions = col.colOptions;
          if (idMap.has(colOptions.fk_related_model_id)) {
            if (colOptions.type === 'mm') {
              if (!linkMap.has(colOptions.fk_mm_model_id)) {
                // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
                delete col.column_name;

                const freshModelData = await this.columnsService.columnAdd({
                  tableId: table.id,
                  column: withoutId({
                    ...col,
                    ...{
                      parentId: getIdOrExternalId(
                        getParentIdentifier(colOptions.fk_child_column_id),
                      ),
                      childId: getIdOrExternalId(
                        getParentIdentifier(colOptions.fk_parent_column_id),
                      ),
                      type: colOptions.type,
                      virtual: colOptions.virtual,
                      ur: colOptions.ur,
                      dr: colOptions.dr,
                    },
                  }),
                  req: param.req,
                  user: param.user,
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
                        getIdOrExternalId(
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
                    nColumn.id !== getIdOrExternalId(col.id)
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
                        user: param.user,
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
                    parentId: getIdOrExternalId(
                      getParentIdentifier(colOptions.fk_parent_column_id),
                    ),
                    childId: getIdOrExternalId(
                      getParentIdentifier(colOptions.fk_child_column_id),
                    ),
                    type: colOptions.type,
                    virtual: colOptions.virtual,
                    ur: colOptions.ur,
                    dr: colOptions.dr,
                  },
                }),
                req: param.req,
                user: param.user,
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
                  : await Model.get(
                      getIdOrExternalId(colOptions.fk_related_model_id),
                    );

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
                  nColumn.id !== getIdOrExternalId(col.id) &&
                  nColumn.colOptions?.fk_parent_column_id ===
                    getIdOrExternalId(colOptions.fk_parent_column_id) &&
                  nColumn.colOptions?.fk_child_column_id ===
                    getIdOrExternalId(colOptions.fk_child_column_id)
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
                      user: param.user,
                    });
                  }
                  break;
                }
              }
            }
          } else if (externalIdMap.has(colOptions.fk_related_model_id)) {
            if (colOptions.type === 'mm') {
              if (!linkMap.has(colOptions.fk_mm_model_id)) {
                // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
                delete col.column_name;

                const freshModelData = await this.columnsService.columnAdd({
                  tableId: table.id,
                  column: withoutId({
                    ...col,
                    ...{
                      parentId: getIdOrExternalId(
                        getParentIdentifier(colOptions.fk_child_column_id),
                      ),
                      childId: getIdOrExternalId(
                        getParentIdentifier(colOptions.fk_parent_column_id),
                      ),
                      type: colOptions.type,
                      virtual: colOptions.virtual,
                      ur: colOptions.ur,
                      dr: colOptions.dr,
                    },
                  }) as any,
                  req: param.req,
                  user: param.user,
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
                        getIdOrExternalId(
                          getParentIdentifier(colOptions.fk_parent_column_id),
                        ),
                      );

                if (
                  getParentIdentifier(colOptions.fk_parent_column_id) !==
                  modelData.id
                )
                  await childModel.getColumns();

                const childColumn = (
                  param.data.find(
                    (a) =>
                      a.model.id ===
                      getParentIdentifier(colOptions.fk_parent_column_id),
                  )?.model ||
                  param.externalModels.find(
                    (a) =>
                      a.id ===
                      getEntityIdentifier(
                        getParentIdentifier(colOptions.fk_parent_column_id),
                      ),
                  )
                ).columns.find(
                  (a) =>
                    (a.colOptions?.fk_mm_model_id ===
                      colOptions.fk_mm_model_id &&
                      a.id !== col.id) ||
                    (a.colOptions?.fk_mm_model_id ===
                      getEntityIdentifier(colOptions.fk_mm_model_id) &&
                      a.id !== getEntityIdentifier(col.id)),
                );

                for (const nColumn of childModel.columns) {
                  if (
                    nColumn?.colOptions?.fk_mm_model_id ===
                      linkMap.get(colOptions.fk_mm_model_id) &&
                    nColumn.id !== getIdOrExternalId(col.id)
                  ) {
                    if (childColumn.id.includes('::')) {
                      idMap.set(childColumn.id, nColumn.id);
                    } else {
                      idMap.set(
                        `${childColumn.base_id}::${childColumn.source_id}::${childColumn.fk_model_id}::${childColumn.id}`,
                        nColumn.id,
                      );
                    }

                    childColumn.title = `${childColumn.title} copy`;

                    childColumn.title = generateUniqueName(
                      childColumn.title,
                      childModel.columns.map((a) => a.title),
                    );

                    if (nColumn.title !== childColumn.title) {
                      await this.columnsService.columnUpdate({
                        columnId: nColumn.id,
                        column: {
                          ...nColumn,
                          column_name: childColumn.title,
                          title: childColumn.title,
                        },
                        user: param.user,
                      });
                    }
                    break;
                  }
                }
              }
            } else if (colOptions.type === 'hm') {
              if (
                !linkMap.has(
                  `${colOptions.fk_parent_column_id}::${colOptions.fk_child_column_id}`,
                )
              ) {
                // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
                delete col.column_name;

                const freshModelData = await this.columnsService.columnAdd({
                  tableId: table.id,
                  column: withoutId({
                    ...col,
                    ...{
                      parentId: getIdOrExternalId(
                        getParentIdentifier(colOptions.fk_parent_column_id),
                      ),
                      childId: getIdOrExternalId(
                        getParentIdentifier(colOptions.fk_child_column_id),
                      ),
                      type: colOptions.type,
                      virtual: colOptions.virtual,
                      ur: colOptions.ur,
                      dr: colOptions.dr,
                    },
                  }) as any,
                  req: param.req,
                  user: param.user,
                });

                linkMap.set(
                  `${colOptions.fk_parent_column_id}::${colOptions.fk_child_column_id}`,
                  `${colOptions.fk_parent_column_id}::${colOptions.fk_child_column_id}`,
                );

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
                    : await Model.get(
                        getIdOrExternalId(colOptions.fk_related_model_id),
                      );

                if (colOptions.fk_related_model_id !== modelData.id)
                  await childModel.getColumns();

                const childColumn = (
                  param.data.find(
                    (a) => a.model.id === colOptions.fk_related_model_id,
                  )?.model ||
                  param.externalModels.find(
                    (a) =>
                      a.id ===
                      getEntityIdentifier(colOptions.fk_related_model_id),
                  )
                ).columns.find(
                  (a) =>
                    (a.colOptions?.fk_parent_column_id ===
                      colOptions.fk_parent_column_id &&
                      a.colOptions?.fk_child_column_id ===
                        colOptions.fk_child_column_id &&
                      a.id !== col.id) ||
                    (a.colOptions?.fk_parent_column_id ===
                      getEntityIdentifier(colOptions.fk_parent_column_id) &&
                      a.colOptions?.fk_child_column_id ===
                        getEntityIdentifier(colOptions.fk_child_column_id) &&
                      a.id !== getEntityIdentifier(col.id)),
                );

                for (const nColumn of childModel.columns) {
                  if (
                    nColumn.id !== getIdOrExternalId(col.id) &&
                    nColumn.colOptions?.fk_parent_column_id ===
                      getIdOrExternalId(colOptions.fk_parent_column_id) &&
                    nColumn.colOptions?.fk_child_column_id ===
                      getIdOrExternalId(colOptions.fk_child_column_id)
                  ) {
                    if (childColumn.id.includes('::')) {
                      idMap.set(childColumn.id, nColumn.id);
                    } else {
                      idMap.set(
                        `${childColumn.base_id}::${childColumn.source_id}::${childColumn.fk_model_id}::${childColumn.id}`,
                        nColumn.id,
                      );
                    }

                    childColumn.title = `${childColumn.title} copy`;

                    childColumn.title = generateUniqueName(
                      childColumn.title,
                      childModel.columns.map((a) => a.title),
                    );

                    if (nColumn.title !== childColumn.title) {
                      await this.columnsService.columnUpdate({
                        columnId: nColumn.id,
                        column: {
                          ...nColumn,
                          column_name: childColumn.title,
                          title: childColumn.title,
                        },
                        user: param.user,
                      });
                    }
                    break;
                  }
                }
              }
            } else if (colOptions.type === 'bt') {
              if (
                !linkMap.has(
                  `${colOptions.fk_parent_column_id}::${colOptions.fk_child_column_id}`,
                )
              ) {
                // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
                delete col.column_name;

                const freshModelData = await this.columnsService.columnAdd({
                  tableId: table.id,
                  column: withoutId({
                    ...col,
                    ...{
                      parentId: getIdOrExternalId(
                        getParentIdentifier(colOptions.fk_parent_column_id),
                      ),
                      childId: getIdOrExternalId(
                        getParentIdentifier(colOptions.fk_child_column_id),
                      ),
                      type: colOptions.type,
                      virtual: colOptions.virtual,
                      ur: colOptions.ur,
                      dr: colOptions.dr,
                    },
                  }) as any,
                  req: param.req,
                  user: param.user,
                });

                linkMap.set(
                  `${colOptions.fk_parent_column_id}::${colOptions.fk_child_column_id}`,
                  `${colOptions.fk_parent_column_id}::${colOptions.fk_child_column_id}`,
                );

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
                    : await Model.get(
                        getIdOrExternalId(colOptions.fk_related_model_id),
                      );

                if (colOptions.fk_related_model_id !== modelData.id)
                  await childModel.getColumns();

                const childColumn = (
                  param.data.find(
                    (a) => a.model.id === colOptions.fk_related_model_id,
                  )?.model ||
                  param.externalModels.find(
                    (a) =>
                      a.id ===
                      getEntityIdentifier(colOptions.fk_related_model_id),
                  )
                ).columns.find(
                  (a) =>
                    (a.colOptions?.fk_parent_column_id ===
                      colOptions.fk_parent_column_id &&
                      a.colOptions?.fk_child_column_id ===
                        colOptions.fk_child_column_id &&
                      a.id !== col.id) ||
                    (a.colOptions?.fk_parent_column_id ===
                      getEntityIdentifier(colOptions.fk_parent_column_id) &&
                      a.colOptions?.fk_child_column_id ===
                        getEntityIdentifier(colOptions.fk_child_column_id) &&
                      a.id !== getEntityIdentifier(col.id)),
                );

                for (const nColumn of childModel.columns) {
                  if (
                    nColumn.id !== getIdOrExternalId(col.id) &&
                    nColumn.colOptions?.fk_parent_column_id ===
                      getIdOrExternalId(colOptions.fk_parent_column_id) &&
                    nColumn.colOptions?.fk_child_column_id ===
                      getIdOrExternalId(colOptions.fk_child_column_id)
                  ) {
                    if (childColumn.id.includes('::')) {
                      idMap.set(childColumn.id, nColumn.id);
                    } else {
                      idMap.set(
                        `${childColumn.base_id}::${childColumn.source_id}::${childColumn.fk_model_id}::${childColumn.id}`,
                        nColumn.id,
                      );
                    }

                    childColumn.title = `${childColumn.title} copy`;

                    childColumn.title = generateUniqueName(
                      childColumn.title,
                      childModel.columns.map((a) => a.title),
                    );

                    if (nColumn.title !== childColumn.title) {
                      await this.columnsService.columnUpdate({
                        columnId: nColumn.id,
                        column: {
                          ...nColumn,
                          column_name: childColumn.title,
                          title: childColumn.title,
                        },
                        user: param.user,
                      });
                    }
                    break;
                  }
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

    elapsedTime(hrTime, 'create LTAR columns', 'importModels');

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
        const colIds = col.colOptions.formula.match(/(?<=\{\{).*?(?=\}\})/gm);
        if (colIds && colIds.length > 0) {
          relatedColIds.push(
            ...col.colOptions.formula.match(/(?<=\{\{).*?(?=\}\})/gm),
          );
        }
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
        if (!getIdOrExternalId(colOptions.fk_relation_column_id)) continue;
        const freshModelData = await this.columnsService.columnAdd({
          tableId: getIdOrExternalId(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              fk_lookup_column_id: getIdOrExternalId(
                colOptions.fk_lookup_column_id,
              ),
              fk_relation_column_id: getIdOrExternalId(
                colOptions.fk_relation_column_id,
              ),
            },
          }) as any,
          req: param.req,
          user: param.user,
        });

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (col.uidt === UITypes.Rollup) {
        if (!getIdOrExternalId(colOptions.fk_relation_column_id)) continue;
        const freshModelData = await this.columnsService.columnAdd({
          tableId: getIdOrExternalId(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              fk_rollup_column_id: getIdOrExternalId(
                colOptions.fk_rollup_column_id,
              ),
              fk_relation_column_id: getIdOrExternalId(
                colOptions.fk_relation_column_id,
              ),
              rollup_function: colOptions.rollup_function,
            },
          }) as any,
          req: param.req,
          user: param.user,
        });

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (col.uidt === UITypes.Formula) {
        const freshModelData = await this.columnsService.columnAdd({
          tableId: getIdOrExternalId(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              formula_raw: colOptions.formula_raw,
            },
          }) as any,
          req: param.req,
          user: param.user,
        });

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      }
    }

    elapsedTime(hrTime, 'create referenced columns', 'importModels');

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

        const vw = await this.createView(
          idMap,
          table,
          viewData,
          table.views,
          param.user,
          param.req,
        );

        if (!vw) continue;

        idMap.set(view.id, vw.id);

        // create filters
        const filters = view.filter.children;

        for (const fl of filters) {
          const fg = await this.filtersService.filterCreate({
            viewId: vw.id,
            filter: withoutId({
              ...fl,
              fk_column_id: getIdOrExternalId(fl.fk_column_id),
              fk_parent_id: getIdOrExternalId(fl.fk_parent_id),
            }),
            user: param.user,
            req: param.req,
          });

          idMap.set(fl.id, fg.id);
        }

        // create sorts
        for (const sr of view.sorts) {
          await this.sortsService.sortCreate({
            viewId: vw.id,
            sort: withoutId({
              ...sr,
              fk_column_id: getIdOrExternalId(sr.fk_column_id),
            }),
            req: param.req,
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
            req: param.req,
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
                req: param.req,
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
                req: param.req,
              });
            }
            break;
          case ViewTypes.GALLERY:
          case ViewTypes.KANBAN:
            break;
        }

        // fix view order (view insert will always put it at the end)
        if (view.order !== vw.order) {
          await this.viewsService.viewUpdate({
            viewId: vw.id,
            view: {
              order: view.order,
            },
            user: param.user,
            req: param.req,
          });
        }
      }
    }

    elapsedTime(hrTime, 'create views', 'importModels');

    // create hooks
    for (const data of param.data) {
      if (!data?.hooks) break;
      const modelData = data.model;
      const hookData = data.hooks;

      const table = tableReferences.get(modelData.id);

      for (const hook of hookData) {
        const { filters, ...rest } = hook;

        const hookData = withoutId({
          ...rest,
        });

        const hk = await this.hooksService.hookCreate({
          tableId: table.id,
          hook: {
            ...hookData,
          } as any,
          req: param.req,
        });

        if (!hk) continue;

        idMap.set(hook.id, hk.id);

        // create filters
        for (const fl of filters) {
          const fg = await this.filtersService.hookFilterCreate({
            hookId: hk.id,
            filter: withoutId({
              ...fl,
              fk_column_id: getIdOrExternalId(fl.fk_column_id),
              fk_parent_id: getIdOrExternalId(fl.fk_parent_id),
            }),
            user: param.user,
            req: param.req,
          });

          idMap.set(fl.id, fg.id);
        }
      }
    }

    elapsedTime(hrTime, 'create hooks', 'importModels');

    return idMap;
  }

  async createView(
    idMap: Map<string, string>,
    md: Model,
    vw: Partial<View>,
    views: View[],
    user: UserType,
    req: NcRequest,
  ): Promise<View> {
    if (vw.is_default) {
      const view = views.find((a) => a.is_default);
      if (view) {
        const gridData = withoutNull(vw.view);
        if (gridData) {
          await this.gridsService.gridViewUpdate({
            viewId: view.id,
            grid: gridData,
            req,
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
          req,
        });
        const gridData = withoutNull(vw.view);
        if (gridData) {
          await this.gridsService.gridViewUpdate({
            viewId: gview.id,
            grid: gridData,
            req,
          });
        }
        return gview;
      }
      case ViewTypes.FORM: {
        const fview = await this.formsService.formViewCreate({
          tableId: md.id,
          body: vw as ViewCreateReqType,
          user,
          req,
        });
        const formData = withoutNull(vw.view);
        if (formData) {
          await this.formsService.formViewUpdate({
            formViewId: fview.id,
            form: formData,
            req,
          });
        }
        return fview;
      }
      case ViewTypes.GALLERY: {
        const glview = await this.galleriesService.galleryViewCreate({
          tableId: md.id,
          gallery: vw as ViewCreateReqType,
          user,
          req,
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
            req,
          });
        }
        return glview;
      }
      case ViewTypes.KANBAN: {
        const kview = await this.kanbansService.kanbanViewCreate({
          tableId: md.id,
          kanban: vw as ViewCreateReqType,
          user,
          req,
        });
        const kanbanData = withoutNull(vw.view);
        if (kanbanData) {
          const grpCol = await Column.get({
            source_id: md.source_id,
            colId: idMap.get(kanbanData['fk_grp_col_id']),
          });
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
                      const id = grpCol.colOptions.options.find(
                        (el) => el.title === vl.title,
                      ).id;
                      tempVal.push({
                        ...vl,
                        fk_column_id: idMap.get(vl.fk_column_id),
                        id,
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
            req,
          });
        }
        return kview;
      }
    }

    return null;
  }

  async importBase(param: {
    user: User;
    baseId: string;
    sourceId: string;
    src: {
      type: 'local' | 'url' | 'file';
      path?: string;
      url?: string;
      file?: any;
    };
    req: NcRequest;
  }) {
    const hrTime = initTime();

    const { user, baseId, sourceId, src, req } = param;

    const destProject = await Base.get(baseId);
    const destBase = await Source.get(sourceId);

    if (!destProject || !destBase) {
      throw NcError.badRequest('Base or Source not found');
    }

    switch (src.type) {
      case 'local': {
        const path = src.path.replace(/\/$/, '');

        const storageAdapter = await NcPluginMgrv2.storageAdapter();

        try {
          const schema = JSON.parse(
            await storageAdapter.fileRead(`${path}/schema.json`),
          );

          elapsedTime(hrTime, 'read schema from file', 'importBase');

          // store fk_mm_model_id (mm) to link once
          let handledLinks = [];

          const idMap = await this.importModels({
            user,
            baseId,
            sourceId,
            data: schema,
            req,
          });

          elapsedTime(hrTime, 'import models schema', 'importBase');

          if (idMap) {
            const files = await (storageAdapter as any).getDirectoryList(
              `${path}/data`,
            );
            const dataFiles = files.filter(
              (file) => !file.match(/links\.csv$/),
            );
            const linkFile = `${path}/data/links.csv`;

            for (const file of dataFiles) {
              const readStream = await (storageAdapter as any).fileReadByStream(
                `${path}/data/${file}`,
              );

              const modelId = findWithIdentifier(
                idMap,
                file.replace(/\.csv$/, ''),
              );

              const model = await Model.get(modelId);

              this.debugLog(`Importing ${model.title}...`);

              await this.importDataFromCsvStream({
                idMap,
                dataStream: readStream,
                destProject,
                destBase,
                destModel: model,
              });

              elapsedTime(
                hrTime,
                `import data for ${model.title}`,
                'importBase',
              );
            }

            // reset timer
            elapsedTime(hrTime);

            const linkReadStream = await (
              storageAdapter as any
            ).fileReadByStream(linkFile);

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            handledLinks = await this.importLinkFromCsvStream({
              idMap,
              linkStream: linkReadStream,
              destProject,
              destBase,
              handledLinks,
            });

            elapsedTime(hrTime, `import links`, 'importBase');
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

  importDataFromCsvStream(param: {
    idMap: Map<string, string>;
    dataStream: Readable;
    destProject: Base;
    destBase: Source;
    destModel: Model;
  }): Promise<void> {
    const { idMap, dataStream, destBase, destProject, destModel } = param;

    const headers: string[] = [];
    let chunk = [];

    return new Promise((resolve) => {
      papaparse.parse(dataStream, {
        newline: '\r\n',
        step: async (results, parser) => {
          if (!headers.length) {
            parser.pause();
            for (const header of results.data as any) {
              const id = idMap.get(header);
              if (id) {
                const col = await Column.get({
                  source_id: destBase.id,
                  colId: id,
                });
                if (col) {
                  if (col.colOptions?.type === 'bt') {
                    const childCol = await Column.get({
                      source_id: destBase.id,
                      colId: col.colOptions.fk_child_column_id,
                    });
                    if (childCol) {
                      headers.push(childCol.column_name);
                    } else {
                      headers.push(null);
                      this.debugLog(
                        `child column not found (${col.colOptions.fk_child_column_id})`,
                      );
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
                  await this.bulkDataService.bulkDataInsert({
                    baseName: destProject.id,
                    tableName: destModel.id,
                    body: chunk,
                    cookie: null,
                    chunkSize: chunk.length + 1,
                    foreign_key_checks: !!destBase.isMeta(),
                    raw: true,
                  });
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
              await this.bulkDataService.bulkDataInsert({
                baseName: destProject.id,
                tableName: destModel.id,
                body: chunk,
                cookie: null,
                chunkSize: chunk.length + 1,
                foreign_key_checks: !!destBase.isMeta(),
                raw: true,
              });
            } catch (e) {
              this.debugLog(e);
            }
            chunk = [];
          }
          resolve(null);
        },
      });
    });
  }

  // import links and return handled links
  async importLinkFromCsvStream(param: {
    idMap: Map<string, string>;
    linkStream: Readable;
    destProject: Base;
    destBase: Source;
    handledLinks: string[];
  }): Promise<string[]> {
    const { idMap, linkStream, destBase, destProject, handledLinks } = param;

    const lChunks: Record<string, any[]> = {}; // fk_mm_model_id: { rowId, childId }[]

    const insertChunks = async () => {
      for (const [k, v] of Object.entries(lChunks)) {
        try {
          if (v.length === 0) continue;
          await this.bulkDataService.bulkDataInsert({
            baseName: destProject.id,
            tableName: k,
            body: v,
            cookie: null,
            chunkSize: 1000,
            foreign_key_checks: !!destBase.isMeta(),
            raw: true,
          });
          lChunks[k] = [];
        } catch (e) {
          this.debugLog(e);
        }
      }
    };

    let headersFound = false;

    let childIndex = -1;
    let parentIndex = -1;
    let columnIndex = -1;

    const mmColumns: Record<string, Column> = {};
    const mmParentChild: any = {};

    return new Promise((resolve) => {
      papaparse.parse(linkStream, {
        newline: '\r\n',
        step: async (results, parser) => {
          if (!headersFound) {
            for (const [i, header] of Object.entries(results.data)) {
              if (header === 'child') {
                childIndex = parseInt(i);
              } else if (header === 'parent') {
                parentIndex = parseInt(i);
              } else if (header === 'column') {
                columnIndex = parseInt(i);
              }
            }
            headersFound = true;
          } else {
            if (results.errors.length === 0) {
              const child = results.data[childIndex];
              const parent = results.data[parentIndex];
              const columnId = results.data[columnIndex];
              if (child && parent && columnId) {
                if (mmColumns[columnId]) {
                  // push to chunk
                  const mmModelId =
                    mmColumns[columnId].colOptions.fk_mm_model_id;
                  const mm = mmParentChild[mmModelId];
                  lChunks[mmModelId].push({
                    [mm.parent]: parent,
                    [mm.child]: child,
                  });
                } else {
                  // get column for the first time
                  parser.pause();

                  await insertChunks();

                  const col = await Column.get({
                    source_id: destBase.id,
                    colId: findWithIdentifier(idMap, columnId),
                  });

                  if (col) {
                    const colOptions =
                      await col.getColOptions<LinkToAnotherRecordColumn>();

                    const vChildCol = await colOptions.getMMChildColumn();
                    const vParentCol = await colOptions.getMMParentColumn();

                    mmParentChild[col.colOptions.fk_mm_model_id] = {
                      parent: vParentCol.column_name,
                      child: vChildCol.column_name,
                    };

                    mmColumns[columnId] = col;

                    handledLinks.push(col.colOptions.fk_mm_model_id);

                    const mmModelId = col.colOptions.fk_mm_model_id;

                    // create chunk
                    lChunks[mmModelId] = [];

                    // push to chunk
                    const mm = mmParentChild[mmModelId];
                    lChunks[mmModelId].push({
                      [mm.parent]: parent,
                      [mm.child]: child,
                    });
                  } else {
                    this.debugLog(`column not found (${columnId})`);
                  }

                  parser.resume();
                }
              }
            }
          }
        },
        complete: async () => {
          await insertChunks();
          resolve(handledLinks);
        },
      });
    });
  }
}
