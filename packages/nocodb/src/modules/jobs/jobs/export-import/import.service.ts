import {
  isAIPromptCol,
  isLinksOrLTAR,
  isVirtualCol,
  NcApiVersion,
  RelationTypes,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import { Injectable, Logger } from '@nestjs/common';
import papaparse from 'papaparse';
import debug from 'debug';
import { elapsedTime, initTime } from '../../helpers';
import type { UserType, ViewCreateReqType } from 'nocodb-sdk';
import type { Readable } from 'stream';
import type {
  CalendarView,
  LinksColumn,
  LinkToAnotherRecordColumn,
  User,
  View,
} from '~/models';
import type { NcContext, NcRequest } from '~/interface/config';
import { Comment, Hook } from '~/models';
import { Base, Column, Model, Source } from '~/models';
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
import { TablesService } from '~/services/tables.service';
import { ColumnsService } from '~/services/columns.service';
import { FiltersService } from '~/services/filters.service';
import { SortsService } from '~/services/sorts.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { GridColumnsService } from '~/services/grid-columns.service';
import { FormColumnsService } from '~/services/form-columns.service';
import { GridsService } from '~/services/grids.service';
import { FormsService } from '~/services/forms.service';
import { CalendarsService } from '~/services/calendars.service';
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
  protected readonly debugLog = debug('nc:jobs:import');
  protected readonly logger = new Logger(ImportService.name);

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
    private calendarsService: CalendarsService,
    private kanbansService: KanbansService,
    private bulkDataService: BulkDataAliasService,
    private hooksService: HooksService,
    private viewsService: ViewsService,
  ) {}

  async importModels(
    context: NcContext,
    param: {
      user: User;
      baseId: string;
      sourceId: string;
      data:
        | {
            models: {
              model: any;
              views: any[];
              hooks?: any[];
              comments?: any[];
            }[];
          }
        | { model: any; views: any[]; hooks?: any[]; comments?: any[] }[];
      req: NcRequest;
      externalModels?: Model[];
      existingModel?: Model;
      importColumnIds?: string[];
    },
  ) {
    const hrTime = initTime();

    // structured id to db id
    const idMap = new Map<string, string>();
    const externalIdMap = new Map<string, string>();

    const getIdOrExternalId = (k: string) => {
      return idMap.get(k) || externalIdMap.get(k);
    };

    const base = await Base.get(context, param.baseId);

    if (!base) return NcError.baseNotFound(param.baseId);

    const source = await Source.get(context, param.sourceId);

    if (!source) return NcError.sourceNotFound(param.sourceId);

    const tableReferences = new Map<string, Model>();
    const linkMap = new Map<string, string>();

    param.data = Array.isArray(param.data) ? param.data : param.data.models;

    // allow existing model to be linked
    if (param.existingModel)
      param.externalModels = [param.existingModel, ...param.externalModels];

    // allow existing models to be linked
    if (param.externalModels) {
      for (const model of param.externalModels) {
        externalIdMap.set(
          `${model.base_id}::${model.source_id}::${model.id}`,
          model.id,
        );

        await model.getColumns(context);
        await model.getViews(context);

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

        for (const view of model.views) {
          externalIdMap.set(
            `${model.base_id}::${model.source_id}::${model.id}::${view.id}`,
            view.id,
          );
        }

        const hooks = await Hook.list(context, {
          fk_model_id: model.id,
        });

        for (const hook of hooks) {
          externalIdMap.set(
            `${model.base_id}::${model.source_id}::${model.id}::${hook.id}`,
            hook.id,
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
          !isVirtualCol(a) &&
          a.uidt !== UITypes.ForeignKey &&
          !isAIPromptCol(a) &&
          (param.importColumnIds
            ? param.importColumnIds.includes(getEntityIdentifier(a.id))
            : true),
      );

      // create table with static columns
      const table =
        param.existingModel ||
        (await this.tablesService.tableCreate(context, {
          baseId: base.id,
          sourceId: source.id,
          user: param.user,
          table: withoutId({
            ...modelData,
            columns: reducedColumnSet.map((a) => withoutId(a)),
          }),
          req: param.req,
        }));

      idMap.set(modelData.id, table.id);

      if (param.existingModel) {
        if (reducedColumnSet.length) {
          for (const col of reducedColumnSet) {
            const freshModelData = (await this.columnsService.columnAdd(
              context,
              {
                tableId: getIdOrExternalId(getParentIdentifier(col.id)),
                column: withoutId({
                  ...col,
                }) as any,
                req: param.req,
                user: param.user,
              },
            )) as Model;

            for (const nColumn of freshModelData.columns) {
              if (nColumn.title === col.title) {
                idMap.set(col.id, nColumn.id);
                break;
              }
            }
          }
        }
      } else {
        // map column id's with new created column id's
        for (const col of table.columns) {
          const colRef = modelData.columns.find(
            (a) =>
              a.column_name &&
              sanitizeColumnName(a.column_name, source.type) ===
                col.column_name,
          );

          // if column is not found, it means not present in the import data and should be skipped
          if (colRef) {
            idMap.set(colRef.id, col.id);
          }

          // setval for auto increment column in pg
          if (source.type === 'pg') {
            if (modelData.pgSerialLastVal) {
              if (col.ai) {
                const baseModel = await Model.getBaseModelSQL(context, {
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
      }

      tableReferences.set(modelData.id, table);
    }

    // create hooks
    for (const data of param.data) {
      if (param.existingModel) break;
      if (!data?.hooks) break;
      const modelData = data.model;
      const hookData = data.hooks;

      const table = tableReferences.get(modelData.id);

      for (const hook of hookData) {
        const { filters, ...rest } = hook;

        const hookData = withoutId({
          ...rest,
        });

        const hk = await this.hooksService.hookCreate(context, {
          tableId: table.id,
          hook: {
            ...hookData,
          } as any,
          req: param.req,
        });

        if (!hk) continue;

        idMap.set(hook.id, hk.id);
      }
    }

    // create comments
    for (const data of param.data) {
      if (param.existingModel) break;
      if (!data?.comments) break;
      const modelData = data.model;
      const commentsData = data.comments;

      const table = tableReferences.get(modelData.id);

      for (const commentD of commentsData) {
        const comment = await Comment.insert(
          context,
          withoutId({
            ...commentD,
            fk_model_id: table.id,
            parent_comment_id: idMap.get(commentD.parent_comment_id),
          }),
        );

        idMap.set(commentD.id, comment.id);
      }
    }

    elapsedTime(hrTime, 'create tables with static columns', 'importModels');

    const referencedColumnSet = [];

    const ltarFilterCreateCbks: (() => Promise<any>)[] = [];

    // create LTAR columns
    for (const data of param.data) {
      const modelData = data.model;
      const table = tableReferences.get(modelData.id);

      const linkedColumnSet = modelData.columns.filter(
        (a) =>
          isLinksOrLTAR(a) &&
          !a.system &&
          (param.importColumnIds
            ? param.importColumnIds.includes(getEntityIdentifier(a.id))
            : true),
      );

      for (const col of linkedColumnSet) {
        if (col.colOptions) {
          const colOptions = col.colOptions as LinksColumn;
          if (idMap.has(colOptions.fk_related_model_id)) {
            if (colOptions.type === 'mm') {
              if (!linkMap.has(colOptions.fk_mm_model_id)) {
                // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
                delete col.column_name;

                const freshModelData = (await this.columnsService.columnAdd(
                  context,
                  {
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
                        childViewId:
                          colOptions.fk_target_view_id &&
                          getIdOrExternalId(colOptions.fk_target_view_id),
                      },
                    }),
                    req: param.req,
                    user: param.user,
                  },
                )) as Model;

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

                const childModel: Model =
                  getParentIdentifier(colOptions.fk_parent_column_id) ===
                  modelData.id
                    ? freshModelData
                    : await Model.get(
                        context,
                        getIdOrExternalId(
                          getParentIdentifier(colOptions.fk_parent_column_id),
                        ),
                      );

                if (
                  getParentIdentifier(colOptions.fk_parent_column_id) !==
                  modelData.id
                )
                  await childModel.getColumns(context);

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
                      const titleExists = childModel.columns.find(
                        (a) => a.title === childColumn.title,
                      );
                      if (titleExists) {
                        childColumn.title = generateUniqueName(
                          `${childColumn.title} copy`,
                          childModel.columns.map((a) => a.title),
                        );
                      }

                      await this.columnsService.columnUpdate(context, {
                        columnId: nColumn.id,
                        column: {
                          ...nColumn,
                          column_name: childColumn.title,
                          title: childColumn.title,
                        },
                        user: param.user,
                        req: param.req,
                      });
                    }
                    break;
                  }
                }
              }
            } else if (
              colOptions.type === RelationTypes.HAS_MANY ||
              (colOptions.type === RelationTypes.ONE_TO_ONE && !col.meta?.bt)
            ) {
              // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
              delete col.column_name;

              const freshModelData = (await this.columnsService.columnAdd(
                context,
                {
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
                      childViewId:
                        colOptions.fk_target_view_id &&
                        getIdOrExternalId(colOptions.fk_target_view_id),
                    },
                  }),
                  req: param.req,
                  user: param.user,
                },
              )) as Model;

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

              const childModel: Model =
                colOptions.fk_related_model_id === modelData.id
                  ? freshModelData
                  : await Model.get(
                      context,
                      getIdOrExternalId(colOptions.fk_related_model_id),
                    );

              if (colOptions.fk_related_model_id !== modelData.id)
                await childModel.getColumns(context);

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

                  // Rename child column (link column)
                  if (nColumn.title !== childColumn.title) {
                    const titleExists = childModel.columns.find(
                      (a) => a.title === childColumn.title,
                    );
                    if (titleExists) {
                      childColumn.title = generateUniqueName(
                        `${childColumn.title} copy`,
                        childModel.columns
                          .filter((a) => a.id !== nColumn.id)
                          .map((a) => a.title),
                      );
                    }

                    await this.columnsService.columnUpdate(context, {
                      columnId: nColumn.id,
                      column: {
                        ...nColumn,
                        column_name: childColumn.title,
                        title: childColumn.title,
                      },
                      user: param.user,
                      req: param.req,
                    });
                  }
                }

                // Rename fk child column
                if (
                  nColumn.id ===
                  getIdOrExternalId(colOptions.fk_child_column_id)
                ) {
                  const relatedCol = param.data
                    .find((a) => a.model.id === colOptions.fk_related_model_id)
                    ?.model.columns.find(
                      (a) => a.id === colOptions.fk_child_column_id,
                    );

                  if (relatedCol) {
                    if (nColumn.title !== relatedCol?.title) {
                      const titleExists = childModel.columns.find(
                        (a) => a.title === relatedCol.title,
                      );
                      if (titleExists) {
                        relatedCol.title = generateUniqueName(
                          `${relatedCol.title} copy`,
                          childModel.columns
                            .filter((a) => a.id !== nColumn.id)
                            .map((a) => a.title),
                        );
                      }

                      await this.columnsService.columnUpdate(context, {
                        columnId: nColumn.id,
                        column: {
                          ...nColumn,
                          column_name: relatedCol.column_name,
                          title: relatedCol.title,
                        },
                        user: param.user,
                        req: param.req,
                      });
                    }
                  }
                }
              }
            }
          } else if (externalIdMap.has(colOptions.fk_related_model_id)) {
            if (colOptions.type === 'mm') {
              if (!linkMap.has(colOptions.fk_mm_model_id)) {
                // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
                delete col.column_name;

                const freshModelData = (await this.columnsService.columnAdd(
                  context,
                  {
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
                        childViewId:
                          colOptions.fk_target_view_id &&
                          getIdOrExternalId(colOptions.fk_target_view_id),
                      },
                    }) as any,
                    req: param.req,
                    user: param.user,
                  },
                )) as Model;

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

                const childModel: Model =
                  getParentIdentifier(colOptions.fk_parent_column_id) ===
                  modelData.id
                    ? freshModelData
                    : await Model.get(
                        context,
                        getIdOrExternalId(
                          getParentIdentifier(colOptions.fk_parent_column_id),
                        ),
                      );

                if (
                  getParentIdentifier(colOptions.fk_parent_column_id) !==
                  modelData.id
                )
                  await childModel.getColumns(context);

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

                    if (nColumn.title !== childColumn.title) {
                      const titleExists = childModel.columns.find(
                        (a) => a.title === childColumn.title,
                      );
                      if (titleExists) {
                        childColumn.title = generateUniqueName(
                          `${childColumn.title} copy`,
                          childModel.columns.map((a) => a.title),
                        );
                      }

                      await this.columnsService.columnUpdate(context, {
                        columnId: nColumn.id,
                        column: {
                          ...nColumn,
                          column_name: childColumn.title,
                          title: childColumn.title,
                        },
                        user: param.user,
                        req: param.req,
                      });
                    }
                    break;
                  }
                }
              }
            } else if (
              colOptions.type === RelationTypes.HAS_MANY ||
              (colOptions.type === RelationTypes.ONE_TO_ONE && !col.meta?.bt)
            ) {
              if (
                !linkMap.has(
                  `${colOptions.fk_parent_column_id}::${colOptions.fk_child_column_id}`,
                )
              ) {
                // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
                delete col.column_name;

                const freshModelData = (await this.columnsService.columnAdd(
                  context,
                  {
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
                        childViewId:
                          colOptions.fk_target_view_id &&
                          getIdOrExternalId(colOptions.fk_target_view_id),
                      },
                    }) as any,
                    req: param.req,
                    user: param.user,
                    apiVersion: NcApiVersion.V2,
                  },
                )) as Model;

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

                const childModel: Model =
                  colOptions.fk_related_model_id === modelData.id
                    ? freshModelData
                    : await Model.get(
                        context,
                        getIdOrExternalId(colOptions.fk_related_model_id),
                      );

                if (colOptions.fk_related_model_id !== modelData.id)
                  await childModel.getColumns(context);

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

                    // Rename child column (link column)
                    if (nColumn.title !== childColumn.title) {
                      const titleExists = childModel.columns.find(
                        (a) => a.title === childColumn.title,
                      );
                      if (titleExists) {
                        childColumn.title = generateUniqueName(
                          `${childColumn.title} copy`,
                          childModel.columns
                            .filter((a) => a.id !== nColumn.id)
                            .map((a) => a.title),
                        );
                      }

                      await this.columnsService.columnUpdate(context, {
                        columnId: nColumn.id,
                        column: {
                          ...nColumn,
                          column_name: childColumn.title,
                          title: childColumn.title,
                        },
                        user: param.user,
                        req: param.req,
                      });
                    }

                    // Rename fk child column
                    if (
                      nColumn.id ===
                      getIdOrExternalId(colOptions.fk_child_column_id)
                    ) {
                      const relatedCol = param.data
                        .find(
                          (a) => a.model.id === colOptions.fk_related_model_id,
                        )
                        ?.model.columns.find(
                          (a) => a.id === colOptions.fk_child_column_id,
                        );

                      if (relatedCol) {
                        if (nColumn.title !== relatedCol?.title) {
                          const titleExists = childModel.columns.find(
                            (a) => a.title === relatedCol.title,
                          );
                          if (titleExists) {
                            relatedCol.title = generateUniqueName(
                              `${relatedCol.title} copy`,
                              childModel.columns
                                .filter((a) => a.id !== nColumn.id)
                                .map((a) => a.title),
                            );
                          }

                          await this.columnsService.columnUpdate(context, {
                            columnId: nColumn.id,
                            column: {
                              ...nColumn,
                              column_name: relatedCol.column_name,
                              title: relatedCol.title,
                            },
                            user: param.user,
                            req: param.req,
                          });
                        }
                      }
                    }
                  }
                }
              }
            } else if (
              colOptions.type === RelationTypes.BELONGS_TO ||
              (colOptions.type === RelationTypes.ONE_TO_ONE && col.meta?.bt)
            ) {
              if (
                !linkMap.has(
                  `${colOptions.fk_parent_column_id}::${colOptions.fk_child_column_id}`,
                )
              ) {
                // delete col.column_name as it is not required and will cause ajv error (null for LTAR)
                delete col.column_name;

                const freshModelData = (await this.columnsService.columnAdd(
                  context,
                  {
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
                        childViewId:
                          colOptions.fk_target_view_id &&
                          getIdOrExternalId(colOptions.fk_target_view_id),
                      },
                    }) as any,
                    req: param.req,
                    user: param.user,
                  },
                )) as Model;

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

                const childModel: Model =
                  colOptions.fk_related_model_id === modelData.id
                    ? freshModelData
                    : await Model.get(
                        context,
                        getIdOrExternalId(colOptions.fk_related_model_id),
                      );

                if (colOptions.fk_related_model_id !== modelData.id)
                  await childModel.getColumns(context);

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

                    // Rename child column (link column)
                    if (nColumn.title !== childColumn.title) {
                      const titleExists = childModel.columns.find(
                        (a) => a.title === childColumn.title,
                      );
                      if (titleExists) {
                        childColumn.title = generateUniqueName(
                          `${childColumn.title} copy`,
                          childModel.columns
                            .filter((a) => a.id !== nColumn.id)
                            .map((a) => a.title),
                        );
                      }

                      await this.columnsService.columnUpdate(context, {
                        columnId: nColumn.id,
                        column: {
                          ...nColumn,
                          column_name: childColumn.title,
                          title: childColumn.title,
                        },
                        user: param.user,
                        req: param.req,
                      });
                    }
                  }

                  // Rename fk child column
                  if (
                    nColumn.id ===
                    getIdOrExternalId(colOptions.fk_child_column_id)
                  ) {
                    const relatedCol = param.data
                      .find(
                        (a) => a.model.id === colOptions.fk_related_model_id,
                      )
                      ?.model.columns.find(
                        (a) => a.id === colOptions.fk_child_column_id,
                      );

                    if (relatedCol) {
                      if (nColumn.title !== relatedCol?.title) {
                        const titleExists = childModel.columns.find(
                          (a) => a.title === relatedCol.title,
                        );
                        if (titleExists) {
                          relatedCol.title = generateUniqueName(
                            `${relatedCol.title} copy`,
                            childModel.columns
                              .filter((a) => a.id !== nColumn.id)
                              .map((a) => a.title),
                          );
                        }

                        await this.columnsService.columnUpdate(context, {
                          columnId: nColumn.id,
                          column: {
                            ...nColumn,
                            column_name: relatedCol.column_name,
                            title: relatedCol.title,
                          },
                          user: param.user,
                          req: param.req,
                        });
                      }
                    }
                  }
                }
              }
            }
          }

          // filter creation for LTAR columns
          if (colOptions.filter?.children?.length) {
            ltarFilterCreateCbks.push(async () => {
              // create filters
              const filters = colOptions.filter?.children;

              for (const fl of filters) {
                const fg = await this.filtersService.linkFilterCreate(context, {
                  columnId: getIdOrExternalId(col.id),
                  filter: withoutId({
                    ...fl,
                    fk_value_col_id: getIdOrExternalId(fl.fk_value_col_id),
                    fk_link_col_id: getIdOrExternalId(fl.fk_link_col_id),
                    fk_column_id: getIdOrExternalId(fl.fk_column_id),
                    fk_parent_id: getIdOrExternalId(fl.fk_parent_id),
                  }),
                  user: param.user,
                  req: param.req,
                });
                if (fg) {
                  idMap.set(fl.id, fg.id);
                }
              }
            });
          }
        }
      }

      referencedColumnSet.push(
        ...modelData.columns.filter(
          (a) =>
            (a.uidt === UITypes.Lookup ||
              a.uidt === UITypes.Rollup ||
              a.uidt === UITypes.Formula ||
              a.uidt === UITypes.Button ||
              a.uidt === UITypes.QrCode ||
              a.uidt === UITypes.CreatedTime ||
              a.uidt === UITypes.LastModifiedTime ||
              a.uidt === UITypes.CreatedBy ||
              a.uidt === UITypes.LastModifiedBy ||
              a.uidt === UITypes.Barcode ||
              isAIPromptCol(a)) &&
            (param.importColumnIds
              ? param.importColumnIds.includes(getEntityIdentifier(a.id))
              : true),
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
        const colIds = col.colOptions?.formula.match(/(?<=\{\{).*?(?=\}\})/gm);
        if (colIds && colIds.length > 0) {
          relatedColIds.push(
            ...col.colOptions.formula.match(/(?<=\{\{).*?(?=\}\})/gm),
          );
        }
      }
      if (col.colOptions?.fk_qr_value_column_id) {
        relatedColIds.push(col.colOptions.fk_qr_value_column_id);
      }
      if (col.colOptions?.fk_barcode_value_column_id) {
        relatedColIds.push(col.colOptions.fk_barcode_value_column_id);
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
    // sort the column sets to create the system columns first
    for (const col of sortedReferencedColumnSet) {
      const { colOptions, ...flatCol } = col;
      if (col.uidt === UITypes.Lookup) {
        if (!getIdOrExternalId(colOptions.fk_relation_column_id)) continue;
        const freshModelData = (await this.columnsService.columnAdd(context, {
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
        })) as Model;

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (col.uidt === UITypes.Rollup) {
        if (!getIdOrExternalId(colOptions.fk_relation_column_id)) continue;
        const freshModelData = (await this.columnsService.columnAdd(context, {
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
        })) as Model;

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (col.uidt === UITypes.Formula) {
        const freshModelData = (await this.columnsService.columnAdd(context, {
          tableId: getIdOrExternalId(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              formula: colOptions.formula,
              parsed_tree: colOptions.parsed_tree,
              formula_raw: colOptions.formula_raw,
            },
          }) as any,
          req: param.req,
          user: param.user,
          suppressFormulaError: true,
        })) as Model;

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (col.uidt === UITypes.Button) {
        if (base.fk_workspace_id !== colOptions.fk_workspace_id) {
          colOptions.fk_workspace_id = null;
          colOptions.fk_integration_id = null;
          colOptions.model = null;
        }

        const freshModelData = (await this.columnsService.columnAdd(context, {
          tableId: getIdOrExternalId(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              formula: colOptions?.formula,
              parsed_tree: colOptions?.parsed_tree,
              formula_raw: colOptions?.formula_raw,
              label: colOptions?.label,
              color: colOptions?.color,
              theme: colOptions?.theme,
              icon: colOptions?.icon,
              type: colOptions?.type,
              fk_webhook_id: getIdOrExternalId(colOptions?.fk_webhook_id),
              output_column_ids: (
                colOptions?.output_column_ids?.split(',') || []
              )
                .map((a) => getIdOrExternalId(a))
                .join(','),
              fk_integration_id: colOptions?.fk_integration_id,
              model: colOptions?.model,
            },
          }) as any,
          req: param.req,
          user: param.user,
          suppressFormulaError: true,
        })) as Model;

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (isAIPromptCol(col)) {
        if (base.fk_workspace_id !== colOptions.fk_workspace_id) {
          colOptions.fk_workspace_id = null;
          colOptions.fk_integration_id = null;
          colOptions.model = null;
        }

        const freshModelData = (await this.columnsService.columnAdd(context, {
          tableId: getIdOrExternalId(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              fk_integration_id: colOptions.fk_integration_id,
              model: colOptions.model,
              prompt_raw: colOptions.prompt_raw,
            },
          }) as any,
          req: param.req,
          user: param.user,
        })) as Model;

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (
        col.uidt === UITypes.CreatedTime ||
        col.uidt === UITypes.LastModifiedTime ||
        col.uidt === UITypes.CreatedBy ||
        col.uidt === UITypes.LastModifiedBy
      ) {
        if (col.system) continue;
        const freshModelData = (await this.columnsService.columnAdd(context, {
          tableId: getIdOrExternalId(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            // provide column_name to avoid ajv error
            // it will be ignored by the service
            column_name: 'system',
            system: false,
          }) as any,
          req: param.req,
          user: param.user,
        })) as Model;

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (col.uidt === UITypes.QrCode) {
        const freshModelData = (await this.columnsService.columnAdd(context, {
          tableId: getIdOrExternalId(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              fk_qr_value_column_id: getIdOrExternalId(
                colOptions.fk_qr_value_column_id,
              ),
            },
          }) as any,
          req: param.req,
          user: param.user,
        })) as Model;

        for (const nColumn of freshModelData.columns) {
          if (nColumn.title === col.title) {
            idMap.set(col.id, nColumn.id);
            break;
          }
        }
      } else if (col.uidt === UITypes.Barcode) {
        flatCol.validate = null;
        const freshModelData = (await this.columnsService.columnAdd(context, {
          tableId: getIdOrExternalId(getParentIdentifier(col.id)),
          column: withoutId({
            ...flatCol,
            ...{
              fk_barcode_value_column_id: getIdOrExternalId(
                colOptions.fk_barcode_value_column_id,
              ),
            },
          }) as any,
          req: param.req,
          user: param.user,
        })) as Model;

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
      if (param.existingModel) break;

      const modelData = data.model;
      const viewsData = data.views;

      const table = tableReferences.get(modelData.id);

      // get default view
      await table.getViews(context);

      for (const view of viewsData) {
        const viewData = withoutId({
          ...view,
        });

        const vw = await this.createView(
          context,
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
          const fg = await this.filtersService.filterCreate(context, {
            viewId: vw.id,
            filter: withoutId({
              ...fl,
              fk_parent_column_id: getIdOrExternalId(fl.fk_parent_column_id),
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
          await this.sortsService.sortCreate(context, {
            viewId: vw.id,
            sort: withoutId({
              ...sr,
              fk_column_id: getIdOrExternalId(sr.fk_column_id),
            }),
            req: param.req,
          });
        }

        // update view columns
        const vwColumns = await this.viewColumnsService.columnList(context, {
          viewId: vw.id,
        });

        for (const cl of vwColumns) {
          const fcl = view.columns.find(
            (a) => a.fk_column_id === reverseGet(idMap, cl.fk_column_id),
          );
          if (!fcl) continue;
          const calendarColProperties =
            vw.type === ViewTypes.CALENDAR
              ? {
                  bold: fcl.bold,
                  italic: fcl.italic,
                  underline: fcl.underline,
                }
              : {};
          await this.viewColumnsService.columnUpdate(context, {
            viewId: vw.id,
            columnId: cl.id,
            column: {
              show: fcl.show,
              order: fcl.order,
              ...calendarColProperties,
            },
            internal: true,
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
              await this.gridColumnsService.gridColumnUpdate(context, {
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
              await this.formColumnsService.columnUpdate(context, {
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
          case ViewTypes.CALENDAR:
            break;
        }

        // fix view order (view insert will always put it at the end)
        if (view.order !== vw.order) {
          await this.viewsService.viewUpdate(context, {
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

    // create hook filters for hooks
    for (const data of param.data) {
      if (param.existingModel) break;
      if (!data?.hooks) break;
      const hookData = data.hooks;

      for (const hook of hookData) {
        const { filters } = hook;

        // create filters
        for (const fl of filters) {
          const fg = await this.filtersService.hookFilterCreate(context, {
            hookId: getIdOrExternalId(hook.id),
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

    // create link filter, triggers at the end since it requires all columns to be created
    for (const ltarFilterCreateCbk of ltarFilterCreateCbks) {
      await ltarFilterCreateCbk();
    }

    elapsedTime(hrTime, 'create link filters', 'importModels');

    return idMap;
  }

  async createView(
    context: NcContext,
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
          await this.gridsService.gridViewUpdate(context, {
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
        const gview = await this.gridsService.gridViewCreate(context, {
          tableId: md.id,
          grid: vw as ViewCreateReqType,
          ownedBy: vw.owned_by,
          req,
        });
        const gridData = withoutNull(vw.view);
        if (gridData) {
          await this.gridsService.gridViewUpdate(context, {
            viewId: gview.id,
            grid: gridData,
            req,
          });
        }
        return gview;
      }
      case ViewTypes.FORM: {
        const fview = await this.formsService.formViewCreate(context, {
          tableId: md.id,
          body: vw as ViewCreateReqType,
          user,
          ownedBy: vw.owned_by,
          req,
        });
        const formData = withoutNull(vw.view);
        if (formData) {
          await this.formsService.formViewUpdate(context, {
            formViewId: fview.id,
            form: formData,
            req,
          });
        }
        return fview;
      }
      case ViewTypes.CALENDAR: {
        return await this.calendarsService.calendarViewCreate(context, {
          tableId: md.id,
          ownedBy: vw.owned_by,
          calendar: {
            ...vw,
            calendar_range: (vw.view as CalendarView).calendar_range.map(
              (a) => ({
                fk_from_column_id: idMap.get(a.fk_from_column_id),
                fk_to_column_id: idMap.get((a as any).fk_to_column_id),
              }),
            ),
          } as ViewCreateReqType,
          user,
          req,
        });
      }
      case ViewTypes.GALLERY: {
        const glview = await this.galleriesService.galleryViewCreate(context, {
          tableId: md.id,
          ownedBy: vw.owned_by,
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
          await this.galleriesService.galleryViewUpdate(context, {
            galleryViewId: glview.id,
            gallery: galleryData,
            req,
          });
        }
        return glview;
      }
      case ViewTypes.KANBAN: {
        const kview = await this.kanbansService.kanbanViewCreate(context, {
          tableId: md.id,
          ownedBy: vw.owned_by,
          kanban: vw as ViewCreateReqType,
          user,
          req,
        });
        const kanbanData = withoutNull(vw.view);
        if (kanbanData) {
          const grpCol = await Column.get(context, {
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
                  // copy non-array meta as it is
                  if (!Array.isArray(mv)) {
                    meta[mk] = mv;
                    continue;
                  }

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
          await this.kanbansService.kanbanViewUpdate(context, {
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

  async importBase(
    context: NcContext,
    param: {
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
    },
  ) {
    const hrTime = initTime();

    const { user, baseId, sourceId, src, req } = param;

    const destProject = await Base.get(context, baseId);
    const destBase = await Source.get(context, sourceId);

    if (!destProject) return NcError.baseNotFound(baseId);
    if (!destBase) return NcError.sourceNotFound(sourceId);

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

          const idMap = await this.importModels(context, {
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
                { encoding: 'utf8' },
              );

              const modelId = findWithIdentifier(
                idMap,
                file.replace(/\.csv$/, ''),
              );

              const model = await Model.get(context, modelId);

              this.debugLog(`Importing ${model.title}...`);

              await this.importDataFromCsvStream(context, {
                idMap,
                dataStream: readStream,
                destProject,
                destBase,
                destModel: model,
                req,
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
            ).fileReadByStream(linkFile, {
              encoding: 'utf8',
            });

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            handledLinks = await this.importLinkFromCsvStream(context, {
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

  importDataFromCsvStream(
    context: NcContext,
    param: {
      idMap: Map<string, string>;
      dataStream: Readable;
      destProject: Base;
      destBase: Source;
      destModel: Model;
      req: any;
    },
  ): Promise<void> {
    const { idMap, dataStream, destBase, destProject, destModel, req } = param;

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
                const col = await Column.get(context, {
                  source_id: destBase.id,
                  colId: id,
                });
                if (col) {
                  if (
                    col.colOptions?.type === RelationTypes.BELONGS_TO ||
                    (col.colOptions?.type === RelationTypes.ONE_TO_ONE &&
                      col.meta?.bt)
                  ) {
                    const childCol = await Column.get(context, {
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
                  await this.bulkDataService.bulkDataInsert(context, {
                    baseName: destProject.id,
                    tableName: destModel.id,
                    body: chunk,
                    cookie: req,
                    chunkSize: chunk.length + 1,
                    foreign_key_checks: !!destBase.isMeta(),
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
              await this.bulkDataService.bulkDataInsert(context, {
                baseName: destProject.id,
                tableName: destModel.id,
                body: chunk,
                cookie: req,
                chunkSize: chunk.length + 1,
                foreign_key_checks: !!destBase.isMeta(),
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
  }

  // import links and return handled links
  async importLinkFromCsvStream(
    context: NcContext,
    param: {
      idMap: Map<string, string>;
      linkStream: Readable;
      destProject: Base;
      destBase: Source;
      handledLinks: string[];
    },
  ): Promise<string[]> {
    const { idMap, linkStream, destBase, destProject, handledLinks } = param;

    const lChunks: Record<string, any[]> = {}; // fk_mm_model_id: { rowId, childId }[]

    const insertChunks = async () => {
      for (const [k, v] of Object.entries(lChunks)) {
        try {
          if (v.length === 0) continue;
          await this.bulkDataService.bulkDataInsert(context, {
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
          this.logger.error(e);
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

                  const col = await Column.get(context, {
                    source_id: destBase.id,
                    colId: findWithIdentifier(idMap, columnId),
                  });

                  if (col) {
                    const colOptions =
                      await col.getColOptions<LinkToAnotherRecordColumn>(
                        context,
                      );

                    const vChildCol = await colOptions.getMMChildColumn(
                      context,
                    );
                    const vParentCol = await colOptions.getMMParentColumn(
                      context,
                    );

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
