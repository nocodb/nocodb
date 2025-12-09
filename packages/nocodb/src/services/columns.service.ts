import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { pluralize, singularize } from 'inflection';
import {
  AppEvents,
  ButtonActionsType,
  EventType,
  FormulaDataTypes,
  isAIPromptCol,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isSystemColumn,
  isVirtualCol,
  LongTextAiMetaProp,
  NcApiVersion,
  ncIsNull,
  ncIsUndefined,
  parseProp,
  partialUpdateAllowedTypes,
  ProjectRoles,
  readonlyMetaAllowedTypes,
  RelationTypes,
  SqlUiFactory,
  substituteColumnAliasWithIdInFormula,
  substituteColumnIdWithAliasInFormula,
  UITypes,
  validateFormulaAndExtractTreeWithType,
  WebhookActions,
} from 'nocodb-sdk';
import rfdc from 'rfdc';
import type {
  ColumnReqType,
  LinkToAnotherColumnReqType,
  LinkToAnotherRecordType,
  UserType,
} from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type CustomKnex from '~/db/CustomKnex';
import type SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Base, LinkToAnotherRecordColumn } from '~/models';
import type {
  IColumnsService,
  ReusableParams,
} from '~/services/columns.service.type';
import {
  type ColumnWebhookManager,
  ColumnWebhookManagerBuilder,
} from '~/utils/column-webhook-manager';
import { getBaseModelSqlFromModelId } from '~/helpers/dbHelpers';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import {
  createHmAndBtColumn,
  createOOColumn,
  deleteColumnSystemPropsFromRequest,
  generateFkName,
  getMMColumnNames,
  sanitizeColumnName,
  validateLookupPayload,
  validatePayload,
  validateRequiredField,
  validateRollupPayload,
} from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';
import validateParams from '~/helpers/validateParams';
import { MetaService } from '~/meta/meta.service';
import {
  BaseUser,
  CalendarRange,
  Column,
  Filter,
  FormulaColumn,
  Hook,
  KanbanView,
  Model,
  Script,
  Source,
  User,
  View,
} from '~/models';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { IFormulaColumnTypeChanger } from '~/services/formula-column-type-changer.types';
import { ViewRowColorService } from '~/services/view-row-color.service';
import { FiltersService } from '~/services/filters.service';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  convertAIRecordTypeToValue,
  convertValueToAIRecordType,
} from '~/utils/dataConversion';
import { MetaTable } from '~/utils/globals';
import { parseMetaProp } from '~/utils/modelUtils';
import NocoSocket from '~/socket/NocoSocket';

export type { ReusableParams } from '~/services/columns.service.type';

const deepClone = rfdc();

// todo: move
export enum Altered {
  NEW_COLUMN = 1,
  DELETE_COLUMN = 4,
  UPDATE_COLUMN = 8,
}

async function reuseOrSave(
  tp: 'table',
  params: ReusableParams,
  get: () => Promise<any>,
): Promise<Model>;
async function reuseOrSave(
  tp: 'source',
  params: ReusableParams,
  get: () => Promise<any>,
): Promise<Source>;
async function reuseOrSave(
  tp: 'base',
  params: ReusableParams,
  get: () => Promise<any>,
): Promise<Base>;
async function reuseOrSave(
  tp: 'dbDriver',
  params: ReusableParams,
  get: () => Promise<any>,
): Promise<CustomKnex>;
async function reuseOrSave(
  tp: 'sqlClient',
  params: ReusableParams,
  get: () => Promise<any>,
): Promise<ReturnType<typeof NcConnectionMgrv2.getSqlClient>>;
async function reuseOrSave(
  tp: 'sqlMgr',
  params: ReusableParams,
  get: () => Promise<any>,
): Promise<SqlMgrv2>;
async function reuseOrSave(
  tp: 'baseModel',
  params: ReusableParams,
  get: () => Promise<any>,
): Promise<BaseModelSqlv2>;
async function reuseOrSave(
  tp: string,
  params: ReusableParams,
  get: () => Promise<any>,
): Promise<any> {
  if (params[tp]) {
    return params[tp];
  }

  const res = await get();

  params[tp] = res;

  return res;
}

export async function getJunctionTableName(
  param: {
    base: Base;
  },
  parent: Model,
  child: Model,
) {
  const parentTable = param.base?.prefix
    ? parent.table_name.replace(`${param.base?.prefix}_`, '')
    : parent.table_name;
  const childTable = param.base?.prefix
    ? child.table_name.replace(`${param.base?.prefix}_`, '')
    : child.table_name;

  const tableName = `${param.base?.prefix ?? ''}_nc_m2m_${parentTable.slice(
    0,
    15,
  )}_${childTable.slice(0, 15)}`;
  let suffix: number = null;
  // check table name avail or not, if not then add incremental suffix
  while (
    await Noco.ncMeta.metaGet2(
      (parent as any).fk_workspace_id,
      parent.base_id,
      MetaTable.MODELS,
      {
        table_name: `${tableName}${suffix ?? ''}`,
        source_id: parent.source_id,
      },
    )
  ) {
    suffix = suffix ? suffix + 1 : 1;
  }
  return `${tableName}${suffix ?? ''}`;
}

// todo: move to swagger.json/types
export interface CustomLinkProps {
  column_id: string;
  ref_model_id: string;
  ref_column_id: string;
  junc_model_id: string;
  junc_column_id: string;
  junc_ref_column_id: string;
}

const generateColumnDeleteHandler = (
  columnWebhookManager?: ColumnWebhookManager,
) => {
  if (!columnWebhookManager) {
    return {};
  }
  return {
    beforeRelatedColumnDelete: async (
      context: { base_id: string; workspace_id: string },
      columnId: string,
    ) => {
      await columnWebhookManager.addOldColumnById({
        columnId,
        action: WebhookActions.DELETE,
        context,
      });
    },
    beforeRelatedColumnUpdate: async (
      context: { base_id: string; workspace_id: string },
      columnId: string,
    ) => {
      await columnWebhookManager.addOldColumnById({
        columnId,
        action: WebhookActions.UPDATE,
        context,
      });
    },
  };
};

@Injectable()
export class ColumnsService implements IColumnsService {
  protected logger = new Logger(ColumnsService.name);

  constructor(
    protected readonly metaService: MetaService,
    protected readonly appHooksService: AppHooksService,
    @Inject(forwardRef(() => 'FormulaColumnTypeChanger'))
    protected readonly formulaColumnTypeChanger: IFormulaColumnTypeChanger,
    protected readonly viewRowColorService: ViewRowColorService,
    protected readonly filtersService: FiltersService,
  ) {}

  async updateFormulas(
    context: NcContext,
    args: { oldColumn: any; colBody: any },
  ) {
    const { oldColumn, colBody } = args;

    // update formula if column name or title is changed
    if (
      oldColumn.column_name !== colBody.column_name ||
      oldColumn.title !== colBody.title
    ) {
      const formulas = await Noco.ncMeta
        .knex(MetaTable.COL_FORMULA)
        .where('formula', 'like', `%${oldColumn.id}%`);
      if (formulas) {
        oldColumn.column_name = colBody.column_name;
        oldColumn.title = colBody.title;
        for (const f of formulas) {
          // replace column IDs with alias to get the new formula_raw
          const new_formula_raw = substituteColumnIdWithAliasInFormula(
            f.formula,
            [oldColumn],
          );

          // update the formula_raw and set parsed_tree to null to reparse the formula
          await FormulaColumn.update(context, oldColumn.id, {
            formula_raw: new_formula_raw,
            parsed_tree: null,
          });
        }
      }
    }
  }

  private async updateMetaAndDatabase(
    context: NcContext,
    args: {
      table: Model;
      column: Partial<Column>;
      source: Source;
      reuse: ReusableParams;
      processColumn?: () => Promise<void>;
    },
  ) {
    const { table, column, source, reuse } = args;

    const tableUpdateBody = {
      ...table,
      tn: table.table_name,
      originalColumns: table.columns.map((c) => ({
        ...c,
        cn: c.column_name,
        cno: c.column_name,
      })),
      columns: await Promise.all(
        table.columns.map(async (c) => {
          if (c.id === column.id) {
            const res = {
              ...c,
              ...column,
              cn: column.column_name,
              cno: c.column_name,
              altered: Altered.UPDATE_COLUMN,
            };

            if (args.processColumn) {
              await args.processColumn();
            }

            return Promise.resolve(res);
          } else {
            (c as any).cn = c.column_name;
          }
          return Promise.resolve(c);
        }),
      ),
    };

    const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
      ProjectMgrv2.getSqlMgr(context, {
        id: source.base_id,
      }),
    );
    await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

    await Column.update(context, column.id, {
      ...column,
    });
  }

  async columnUpdate(
    context: NcContext,
    param: {
      req: NcRequest;
      columnId: string;
      column: ColumnReqType & { colOptions?: any };
      user: UserType;
      reuse?: ReusableParams;
      apiVersion?: NcApiVersion;
      forceUpdateSystem?: boolean;
      columnWebhookManager?: ColumnWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model | Column<any>> {
    const reuse = param.reuse || {};

    const { req } = param;

    const column = await Column.get(context, { colId: param.columnId });
    const oldColumn = deepClone(column);

    const table = await reuseOrSave('table', reuse, async () =>
      Model.getWithInfo(context, {
        id: column.fk_model_id,
      }),
    );

    if (table.synced && column.readonly && !param.forceUpdateSystem) {
      NcError.get(context).invalidRequestBody(
        `The column '${
          column.title || column.column_name
        }' is a synced column and cannot be updated.`,
      );
    }

    const source = await reuseOrSave('source', reuse, async () =>
      Source.get(context, table.source_id),
    );

    const columnWebhookManager =
      param.columnWebhookManager ??
      (
        await (
          await new ColumnWebhookManagerBuilder(context, ncMeta).withModelId(
            column.fk_model_id,
          )
        ).addColumnById(column.id)
      ).forUpdate();

    // TODO: Refactor the columnUpdate function to handle metaOnly changes and
    // DB related changes, right now both are mixed up, making this fragile
    if (param.column.description !== column.description) {
      await Column.update(context, param.columnId, {
        description: param.column.description,
      });
    }

    // These are the column types whose meta is allowed to be updated
    // It includes currency, date, datetime where formatting is allowed to update
    const isMetaOnlyUpdateAllowed =
      source?.is_schema_readonly &&
      partialUpdateAllowedTypes.includes(column.uidt);
    // check if source is readonly and column type is not allowed
    if (
      source?.is_schema_readonly &&
      (!readonlyMetaAllowedTypes.includes(column.uidt) ||
        (param.column.uidt &&
          !readonlyMetaAllowedTypes.includes(param.column.uidt as UITypes))) &&
      !partialUpdateAllowedTypes.includes(column.uidt)
    ) {
      /*
      throw error if source is readonly and column type is not allowed
      NcError.sourceMetaReadOnly(source.alias);

      Get all the columns in the table and return
      */
      await table.getColumns(context);

      const updatedColumn = await Column.get(context, {
        colId: param.columnId,
      });

      this.appHooksService.emit(AppEvents.COLUMN_UPDATE, {
        table,
        oldColumn,
        column: updatedColumn,
        columnId: column.id,
        req: param.req,
        context,
        columns: table.columns,
      });

      return table;
    }

    const sqlClient = await reuseOrSave('sqlClient', reuse, async () =>
      NcConnectionMgrv2.getSqlClient(source),
    );

    const sqlClientType = sqlClient.knex.clientType();

    // The maxLength of column name is different for different databases
    // This is the maximum length of column name allowed in the database
    const mxColumnLength = Column.getMaxColumnNameLength(sqlClientType);

    if (
      !isVirtualCol(param.column) &&
      !isMetaOnlyUpdateAllowed &&
      param.column.column_name
    ) {
      param.column.column_name = sanitizeColumnName(
        param.column.column_name,
        source.type,
      );
    }

    // trim leading and trailing spaces from column title as knex trim them by default
    if (param.column.title) {
      param.column.title = param.column.title.trim();
    }

    if (param.column.column_name && !isMetaOnlyUpdateAllowed) {
      // - 5 is a buffer for suffix
      let colName = param.column.column_name.slice(0, mxColumnLength - 5);
      let suffix = 1;
      while (
        !(await Column.checkTitleAvailable(context, {
          column_name: colName,
          fk_model_id: column.fk_model_id,
          exclude_id: param.columnId,
        }))
      ) {
        colName = param.column.column_name.slice(0, mxColumnLength - 5);
        colName += `_${suffix++}`;
      }
      param.column.column_name = colName;
    }

    if (
      !isMetaOnlyUpdateAllowed &&
      !isVirtualCol(param.column) &&
      param.column.column_name &&
      param.column.column_name.length > mxColumnLength
    ) {
      NcError.get(context).invalidRequestBody(
        `Column name ${param.column.column_name} exceeds ${mxColumnLength} characters`,
      );
    }

    if (param.column.title && param.column.title.length > 255) {
      NcError.get(context).invalidRequestBody(
        `Column title ${param.column.title} exceeds 255 characters`,
      );
    }

    if (
      param.column.column_name &&
      !isVirtualCol(param.column) &&
      !isCreatedOrLastModifiedTimeCol(param.column) &&
      !isCreatedOrLastModifiedByCol(param.column) &&
      !(await Column.checkTitleAvailable(context, {
        column_name: param.column.column_name,
        fk_model_id: column.fk_model_id,
        exclude_id: param.columnId,
      }))
    ) {
      NcError.get(context).duplicateAlias({
        type: 'column',
        alias: param.column.column_name,
        base: context.base_id,
        label: 'name',
        additionalTrace: {
          table: column.fk_model_id,
        },
      });
    }
    if (
      param.column.title &&
      !(await Column.checkAliasAvailable(context, {
        title: param.column.title,
        fk_model_id: column.fk_model_id,
        exclude_id: param.columnId,
      }))
    ) {
      // This error will be thrown if there are more than one column linking to the same table. You have to delete one of them
      NcError.get(context).duplicateAlias({
        type: 'column',
        alias: param.column.title,
        base: context.base_id,
        additionalTrace: {
          table: column.fk_model_id,
        },
      });
    }
    const sqlUi = SqlUiFactory.create(await source.getConnectionConfig());

    // for API call, if dt is not supplied
    // but uidt is present
    // and uidt is different, try to get dt from uidt
    if (
      param.column.uidt &&
      param.column.uidt !== column.uidt &&
      !(param.column as Column).dt &&
      // if uidt is invalid, do not try to set default dt
      Object.values(UITypes).includes(param.column.uidt as UITypes)
    ) {
      (param.column as Column).dt = sqlUi.getDataTypeForUiType(
        { uidt: param.column.uidt as UITypes },
        column?.['meta']?.['ag'] ? 'AG' : 'AI',
      )?.dt;
    }
    // for API call, if dt is supplied, try to check if it's valid, otherwise set default
    else if (
      param.column.uidt &&
      param.column.uidt !== column.uidt &&
      (param.column as Column).dt &&
      // if uidt is invalid, do not try to set default dt
      Object.values(UITypes).includes(param.column.uidt as UITypes)
    ) {
      const dtList = sqlUi.getDataTypeListForUiType(param.column as Column);
      if (!dtList.includes((param.column as Column).dt)) {
        (param.column as Column).dt = sqlUi.getDataTypeForUiType(
          { uidt: param.column.uidt as UITypes },
          column?.['meta']?.['ag'] ? 'AG' : 'AI',
        )?.dt;
      }
    }
    // extract missing required props from column to avoid broken column
    param.column = {
      ...extractProps(column, ['column_name', 'uidt', 'dt']),
      ...param.column,
    };

    let colBody = { ...param.column } as Column & {
      formula?: string;
      formula_raw?: string;
      parsed_tree?: any;
      colOptions?: any;
      fk_webhook_id?: string;
      type?: ButtonActionsType;
      fk_script_id?: string;
      prompt?: string;
      prompt_raw?: string;
      fk_integration_id?: string;
    } & Partial<Pick<ColumnReqType, 'column_order'>>;
    sqlUi.adjustLengthAndScale(colBody);

    const { applyRowColorInvolvement } =
      await this.viewRowColorService.checkIfColumnInvolved({
        context,
        existingColumn: oldColumn,
        newColumn: colBody,
        action: 'update',
      });

    if (
      isMetaOnlyUpdateAllowed ||
      isCreatedOrLastModifiedTimeCol(column) ||
      isCreatedOrLastModifiedByCol(column) ||
      [
        UITypes.Lookup,
        UITypes.Rollup,
        UITypes.LinkToAnotherRecord,
        UITypes.Formula,
        UITypes.QrCode,
        UITypes.Barcode,
        UITypes.ForeignKey,
        UITypes.Links,
        UITypes.Button,
      ].includes(column.uidt)
    ) {
      if (column.uidt === colBody.uidt) {
        if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt)) {
          await Column.update(context, column.id, {
            ...column,
            ...colBody,
          } as Column);
        } else if (column.uidt === UITypes.Formula) {
          colBody.formula = await substituteColumnAliasWithIdInFormula(
            colBody.formula_raw || colBody.formula,
            table.columns,
          );
          colBody.parsed_tree = await validateFormulaAndExtractTreeWithType({
            formula: colBody.formula || colBody.formula_raw,
            columns: table.columns,
            column,
            clientOrSqlUi: source.type as any,
            getMeta: async (modelId) => {
              const model = await Model.get(context, modelId);
              await model.getColumns(context);
              return model;
            },
          });

          try {
            const baseModel = await reuseOrSave('baseModel', reuse, async () =>
              Model.getBaseModelSQL(context, {
                id: table.id,
                dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
                  NcConnectionMgrv2.get(source),
                ),
              }),
            );
            await formulaQueryBuilderv2({
              baseModel: baseModel,
              tree: colBody.formula,
              model: table,
              column,
              validateFormula: true,
              parsedTree: colBody.parsed_tree,
            });
          } catch (e) {
            console.error(e);
            throw e;
          }

          await Column.update(context, column.id, {
            // title: colBody.title,
            ...column,
            ...colBody,
          });
        } else if (column.uidt === UITypes.Button) {
          if (colBody.type === ButtonActionsType.Url) {
            colBody.formula = await substituteColumnAliasWithIdInFormula(
              colBody.formula_raw || colBody.formula,
              table.columns,
            );
            colBody.parsed_tree = await validateFormulaAndExtractTreeWithType({
              formula: colBody.formula || colBody.formula_raw,
              columns: table.columns,
              column,
              clientOrSqlUi: source.type as any,
              getMeta: async (modelId) => {
                const model = await Model.get(context, modelId);
                await model.getColumns(context);
                return model;
              },
            });

            try {
              const baseModel = await reuseOrSave(
                'baseModel',
                reuse,
                async () =>
                  Model.getBaseModelSQL(context, {
                    id: table.id,
                    dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
                      NcConnectionMgrv2.get(source),
                    ),
                  }),
              );
              await formulaQueryBuilderv2({
                baseModel: baseModel,
                tree: colBody.formula,
                model: table,
                column: null,
                validateFormula: true,
                parsedTree: colBody.parsed_tree,
              });
            } catch (e) {
              console.error(e);
              NcError.badRequest('Invalid Formula');
            }
          } else if (colBody.type === ButtonActionsType.Webhook) {
            if (!colBody.fk_webhook_id) {
              NcError.badRequest('Webhook not found');
            }

            const hook = await Hook.get(context, colBody.fk_webhook_id);

            if (
              !hook ||
              !hook.active ||
              (hook.version !== 'v3' && hook.event === 'manual') ||
              (hook.version === 'v3' && !hook.operation?.includes('trigger'))
            ) {
              NcError.badRequest('Webhook not found');
            }
          } else if (colBody.type === ButtonActionsType.Script) {
            if (!colBody.fk_script_id) {
              NcError.badRequest('Script not found');
            }

            const script = await Script.get(context, colBody.fk_script_id);

            if (!script) {
              NcError.badRequest('Script not found');
            }
          } else if (colBody.type === ButtonActionsType.Ai) {
            /*
              Substitute column alias with id in prompt
            */
            if (colBody.formula_raw) {
              await table.getColumns(context);

              colBody.formula = colBody.formula_raw.replace(
                /{(.*?)}/g,
                (match, p1) => {
                  const column = table.columns.find((c) => c.title === p1);

                  if (!column) {
                    NcError.badRequest(`Field '${p1}' not found`);
                  }

                  return `{${column.id}}`;
                },
              );
            }
          }

          await Column.update(context, column.id, {
            // title: colBody.title,
            ...column,
            ...colBody,
          });
        } else {
          if (colBody.title !== column.title) {
            await Column.updateAlias(context, param.columnId, {
              title: colBody.title,
            });
          }
          if (
            'meta' in colBody &&
            ([UITypes.CreatedTime, UITypes.LastModifiedTime].includes(
              column.uidt,
            ) ||
              isMetaOnlyUpdateAllowed)
          ) {
            await Column.updateMeta(context, {
              colId: param.columnId,
              meta: colBody.meta,
            });
          }

          if (
            'validate' in colBody &&
            ([UITypes.URL, UITypes.PhoneNumber, UITypes.Email].includes(
              column.uidt,
            ) ||
              isMetaOnlyUpdateAllowed)
          ) {
            await Column.updateValidation(context, {
              colId: param.columnId,
              validate: colBody.validate,
            });
          }

          if (isLinksOrLTAR(column)) {
            if ('meta' in colBody) {
              await Column.updateMeta(context, {
                colId: param.columnId,
                meta: {
                  ...column.meta,
                  ...colBody.meta,
                },
              });
            }
            await View.clearSingleQueryCache(context, column.fk_model_id, null);

            // check alias value present in colBody
            if (
              (colBody as any).childViewId === null ||
              (colBody as any).childViewId
            ) {
              colBody.colOptions = colBody.colOptions || {};
              (
                colBody as Column<LinkToAnotherRecordColumn>
              ).colOptions.fk_target_view_id = (colBody as any).childViewId;
            }

            if (
              (colBody as Column<LinkToAnotherRecordColumn>).colOptions
                ?.fk_target_view_id ||
              (colBody as Column<LinkToAnotherRecordColumn>).colOptions
                ?.fk_target_view_id === null
            ) {
              await Column.updateTargetView(context, {
                colId: param.columnId,
                fk_target_view_id: (
                  colBody as Column<LinkToAnotherRecordColumn>
                ).colOptions.fk_target_view_id,
              });
            }
          }
          // handle reorder column
          if (
            colBody?.column_order &&
            colBody.column_order?.order &&
            colBody.column_order?.view_id
          ) {
            const viewColumn = (
              await View.getColumns(context, colBody.column_order.view_id)
            ).find((col) => col.fk_column_id === column.id);
            await View.updateColumn(
              context,
              colBody.column_order.view_id,
              viewColumn.id,
              {
                order: colBody.column_order.order,
              },
            );
          }
        }

        await this.updateRollupOrLookup(context, colBody, column);
      } else if ([UITypes.Formula].includes(column.uidt)) {
        (param.column as any).id = undefined;
        await this.formulaColumnTypeChanger.startChangeFormulaColumnType(
          context,
          {
            req,
            formulaColumn: column,
            newColumnRequest: param.column,
            user: param.user,
            reuse: param.reuse,
          },
        );
      } else {
        NcError.notImplemented(`Updating ${column.uidt} => ${colBody.uidt}`);
      }
    } else if (
      [
        UITypes.Lookup,
        UITypes.Rollup,
        UITypes.LinkToAnotherRecord,
        UITypes.Formula,
        UITypes.QrCode,
        UITypes.Barcode,
        UITypes.ForeignKey,
      ].includes(colBody.uidt)
    ) {
      NcError.notImplemented(`Updating ${colBody.uidt} => ${colBody.uidt}`);
    } else if (
      [
        UITypes.CreatedTime,
        UITypes.LastModifiedTime,
        UITypes.CreatedBy,
        UITypes.LastModifiedBy,
      ].includes(colBody.uidt)
    ) {
      // allow updating of title only
      await Column.update(context, param.columnId, {
        ...column,
        title: colBody.title,
      });
    } else if (
      [UITypes.SingleSelect, UITypes.MultiSelect].includes(colBody.uidt)
    ) {
      colBody = await getColumnPropsFromUIDT(colBody, source);

      const baseModel = await reuseOrSave('baseModel', reuse, async () =>
        Model.getBaseModelSQL(context, {
          id: table.id,
          dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
            NcConnectionMgrv2.get(source),
          ),
        }),
      );

      if (colBody.colOptions?.options) {
        const supportedDrivers = ['mysql', 'mysql2', 'pg', 'sqlite3'];
        const dbDriver = await reuseOrSave('dbDriver', reuse, async () =>
          NcConnectionMgrv2.get(source),
        );
        const driverType = dbDriver.clientType();

        if (
          column.uidt === UITypes.SingleSelect &&
          colBody.uidt !== UITypes.SingleSelect
        ) {
          if (
            (await KanbanView.getViewsByGroupingColId(context, column.id))
              .length > 0
          ) {
            NcError.badRequest(
              `The column '${column.title}' is being used in Kanban View.`,
            );
          }
        }

        if (
          column.uidt === UITypes.MultiSelect &&
          colBody.uidt === UITypes.SingleSelect
        ) {
          // MultiSelect to SingleSelect
          if (driverType === 'mysql' || driverType === 'mysql2') {
            await sqlClient.raw(
              `UPDATE ?? SET ?? = SUBSTRING_INDEX(??, ',', 1) WHERE ?? LIKE '%,%';`,
              [
                baseModel.getTnPath(table.table_name),
                column.column_name,
                column.column_name,
                column.column_name,
              ],
            );
          } else if (driverType === 'pg') {
            await sqlClient.raw(`UPDATE ?? SET ?? = split_part(??, ',', 1);`, [
              baseModel.getTnPath(table.table_name),
              column.column_name,
              column.column_name,
            ]);
          } else if (driverType === 'sqlite3') {
            await sqlClient.raw(
              `UPDATE ?? SET ?? = substr(??, 1, instr(??, ',') - 1) WHERE ?? LIKE '%,%';`,
              [
                baseModel.getTnPath(table.table_name),
                column.column_name,
                column.column_name,
                column.column_name,
                column.column_name,
              ],
            );
          }
        } else {
          // Text to SingleSelect/MultiSelect
          const dbDriver = await reuseOrSave('dbDriver', reuse, async () =>
            NcConnectionMgrv2.get(source),
          );

          const baseModel = await reuseOrSave('baseModel', reuse, async () =>
            Model.getBaseModelSQL(context, {
              id: table.id,
              dbDriver: dbDriver,
            }),
          );

          const data = await baseModel.execAndParse(
            baseModel.dbDriver
              .raw('SELECT DISTINCT ?? FROM ??', [
                column.column_name,
                baseModel.getTnPath(table.table_name),
              ])
              .toQuery(),
            null,
            {
              raw: true,
            },
          );

          if (data.length && column.uidt !== colBody.uidt) {
            const existingOptions = colBody.colOptions.options.map(
              (el) => el.title,
            );
            const options = data.reduce((acc, el) => {
              if (el[column.column_name]) {
                const values = String(el[column.column_name]).split(',');
                if (values.length > 1) {
                  if (colBody.uidt === UITypes.SingleSelect) {
                    NcError.badRequest(
                      'SingleSelect cannot have comma separated values, please use MultiSelect instead.',
                    );
                  }
                }
                for (const v of values) {
                  if (!existingOptions.includes(v.trim())) {
                    acc.push({
                      title: v.trim(),
                    });
                    existingOptions.push(v.trim());
                  }
                }
              }
              return acc;
            }, []);
            colBody.colOptions.options = [
              ...colBody.colOptions.options,
              ...options,
            ];
          }
        }

        // Handle migrations
        if (column.colOptions?.options) {
          for (const op of column.colOptions.options.filter(
            (el) => el.order === null,
          )) {
            op.title = op.title.replace(/^'/, '').replace(/'$/, '');
          }
        }

        // Handle default values
        const optionTitles = colBody.colOptions.options.map((el) =>
          el.title.replace(/'/g, "''"),
        );
        if (colBody.cdf) {
          if (colBody.uidt === UITypes.SingleSelect) {
            try {
              if (!optionTitles.includes(colBody.cdf.replace(/'/g, "''"))) {
                NcError.badRequest(
                  `Default value '${colBody.cdf}' is not a select option.`,
                );
              }
            } catch (e) {
              colBody.cdf = colBody.cdf.replace(/^'/, '').replace(/'$/, '');
              if (!optionTitles.includes(colBody.cdf.replace(/'/g, "''"))) {
                NcError.badRequest(
                  `Default value '${colBody.cdf}' is not a select option.`,
                );
              }
            }
          } else {
            try {
              for (const cdf of colBody.cdf.split(',')) {
                if (!optionTitles.includes(cdf.replace(/'/g, "''"))) {
                  NcError.badRequest(
                    `Default value '${cdf}' is not a select option.`,
                  );
                }
              }
            } catch (e) {
              colBody.cdf = colBody.cdf.replace(/^'/, '').replace(/'$/, '');
              for (const cdf of colBody.cdf.split(',')) {
                if (!optionTitles.includes(cdf.replace(/'/g, "''"))) {
                  NcError.badRequest(
                    `Default value '${cdf}' is not a select option.`,
                  );
                }
              }
            }
          }

          // handle single quote for default value
          if (driverType === 'pg' || driverType === 'sqlite3') {
            colBody.cdf = colBody.cdf.replace(/'/g, "'");
          } else {
            colBody.cdf = colBody.cdf.replace(/'/g, "''");
          }

          if (driverType === 'pg') {
            colBody.cdf = `'${colBody.cdf}'`;
          }
        }

        // Restrict duplicates
        const titles = colBody.colOptions.options.map((el) => el.title);
        if (
          titles.some(function (item) {
            return titles.indexOf(item) !== titles.lastIndexOf(item);
          })
        ) {
          NcError.badRequest('Duplicates are not allowed!');
        }

        // Restrict empty options
        if (
          titles.some(function (item) {
            return item === '';
          })
        ) {
          NcError.badRequest('Empty options are not allowed!');
        }

        // Trim end of enum/set
        if (colBody.dt === 'enum' || colBody.dt === 'set') {
          for (const opt of colBody.colOptions.options) {
            opt.title = opt.title.trimEnd();
          }
        }

        if (colBody.uidt === UITypes.SingleSelect) {
          colBody.dtxp = colBody.colOptions?.options.length
            ? `${colBody.colOptions.options
                .map((o) => `'${o.title.replace(/'/gi, "''")}'`)
                .join(',')}`
            : '';
        } else if (colBody.uidt === UITypes.MultiSelect) {
          colBody.dtxp = colBody.colOptions?.options.length
            ? `${colBody.colOptions.options
                .map((o) => {
                  if (o.title.includes(',')) {
                    NcError.badRequest("Illegal char(',') for MultiSelect");
                  }
                  return `'${o.title.replace(/'/gi, "''")}'`;
                })
                .join(',')}`
            : '';
        }

        // Handle empty enum/set for mysql (we restrict empty user options beforehand)
        if (driverType === 'mysql' || driverType === 'mysql2') {
          if (
            !colBody.colOptions.options.length &&
            (!colBody.dtxp || colBody.dtxp === '')
          ) {
            colBody.dtxp = "''";
          }

          if (colBody.dt === 'set') {
            if (colBody.colOptions?.options.length > 64) {
              colBody.dt = 'text';
            }
          }
        }

        // Handle option delete
        if (column.colOptions?.options) {
          for (const option of column.colOptions.options.filter(
            (oldOp) =>
              !colBody.colOptions.options.find(
                (newOp) => newOp.id === oldOp.id || newOp.title === oldOp.title,
              ),
          )) {
            if (
              !supportedDrivers.includes(driverType) &&
              column.uidt === UITypes.MultiSelect
            ) {
              NcError.badRequest(
                'Your database not yet supported for this operation. Please remove option from records manually before dropping.',
              );
            }
            if (column.uidt === UITypes.SingleSelect) {
              await baseModel.bulkUpdateAll(
                {
                  where: `(${column.title},eq,${option.title})`,
                  skipValidationAndHooks: true,
                },
                { [column.column_name]: null },
                { cookie: req },
              );
            } else if (column.uidt === UITypes.MultiSelect) {
              if (driverType === 'mysql' || driverType === 'mysql2') {
                if (colBody.dt === 'set') {
                  await sqlClient.raw(
                    `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), ',')) WHERE FIND_IN_SET(?, ??)`,
                    [
                      baseModel.getTnPath(table.table_name),
                      column.column_name,
                      column.column_name,
                      option.title,
                      option.title,
                      column.column_name,
                    ],
                  );
                } else {
                  await sqlClient.raw(
                    `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), ','))`,
                    [
                      baseModel.getTnPath(table.table_name),
                      column.column_name,
                      column.column_name,
                      option.title,
                    ],
                  );
                }
              } else if (driverType === 'pg') {
                await sqlClient.raw(
                  `UPDATE ?? SET ??  = array_to_string(array_remove(string_to_array(??, ','), ?), ',')`,
                  [
                    baseModel.getTnPath(table.table_name),
                    column.column_name,
                    column.column_name,
                    option.title,
                  ],
                );
              } else if (driverType === 'sqlite3') {
                await sqlClient.raw(
                  `UPDATE ?? SET ?? = TRIM(REPLACE(',' || ?? || ',', ',' || ? || ',', ','), ',')`,
                  [
                    baseModel.getTnPath(table.table_name),
                    column.column_name,
                    column.column_name,
                    option.title,
                  ],
                );
              }
            }
          }
        }

        /*
          Interchange is used to handle cyclic replacements without conflicts (e.g., A → B, B → C, C → A):
          1. We replace conflicting new options with temporary unique titles (e.g., A → A_1, B → B_1, C → C_1)
          2. We update the database with these temporary unique titles
          3. Finally, we replace the temporary unique titles with the intended new option titles
        */
        const interchange: {
          // Original new option
          def_option: { title: string };
          // Temporary unique title
          temp_title: string;
        }[] = [];
        const titleChanges = []; // Title change keeps direct map of old title to new title
        // Handle option update
        if (column.colOptions?.options) {
          const old_titles = column.colOptions.options.map((el) => el.title);
          for (const option of column.colOptions.options.filter((oldOp) =>
            colBody.colOptions.options.find(
              (newOp) => newOp.id === oldOp.id && newOp.title !== oldOp.title,
            ),
          )) {
            if (
              !supportedDrivers.includes(driverType) &&
              column.uidt === UITypes.MultiSelect
            ) {
              NcError.badRequest(
                'Your database not yet supported for this operation. Please remove option from records manually before updating.',
              );
            }

            const newOp = {
              ...colBody.colOptions.options.find((el) => option.id === el.id),
            };

            titleChanges.push({
              old_title: option.title,
              new_title: newOp.title,
            });

            // Handle title conflicts by creating unique temporary titles
            if (old_titles.includes(newOp.title)) {
              const def_option = { ...newOp };
              let title_counter = 1;
              while (old_titles.includes(newOp.title)) {
                newOp.title = `${def_option.title}_${title_counter++}`;
              }
              // Store the temporary title mapping
              interchange.push({
                def_option,
                temp_title: newOp.title,
              });
            }

            // Append new option before editing
            if (
              (driverType === 'mysql' || driverType === 'mysql2') &&
              (column.dt === 'enum' || column.dt === 'set')
            ) {
              column.colOptions.options.push({ title: newOp.title });

              let temp_dtxp = '';
              if (column.uidt === UITypes.SingleSelect) {
                temp_dtxp = column.colOptions.options.length
                  ? `${column.colOptions.options
                      .map((o) => `'${o.title.replace(/'/gi, "''")}'`)
                      .join(',')}`
                  : '';
              } else if (column.uidt === UITypes.MultiSelect) {
                temp_dtxp = column.colOptions.options.length
                  ? `${column.colOptions.options
                      .map((o) => {
                        if (o.title.includes(',')) {
                          NcError.badRequest(
                            "Illegal char(',') for MultiSelect",
                          );
                          throw new Error('');
                        }
                        return `'${o.title.replace(/'/gi, "''")}'`;
                      })
                      .join(',')}`
                  : '';
              }

              column.dtxp = temp_dtxp;

              await this.updateMetaAndDatabase(context, {
                table,
                column,
                source,
                reuse,
              });
            }

            if (column.uidt === UITypes.SingleSelect) {
              await baseModel.bulkUpdateAll(
                {
                  where: `(${column.title},eq,${option.title})`,
                  skipValidationAndHooks: true,
                },
                { [column.column_name]: newOp.title },
                { cookie: req },
              );
            } else if (column.uidt === UITypes.MultiSelect) {
              if (driverType === 'mysql' || driverType === 'mysql2') {
                if (colBody.dt === 'set') {
                  await sqlClient.raw(
                    `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), CONCAT(',', ?, ','))) WHERE FIND_IN_SET(?, ??)`,
                    [
                      baseModel.getTnPath(table.table_name),
                      column.column_name,
                      column.column_name,
                      option.title,
                      newOp.title,
                      option.title,
                      column.column_name,
                    ],
                  );
                } else {
                  await sqlClient.raw(
                    `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), CONCAT(',', ?, ',')))`,
                    [
                      baseModel.getTnPath(table.table_name),
                      column.column_name,
                      column.column_name,
                      option.title,
                      newOp.title,
                    ],
                  );
                }
              } else if (driverType === 'pg') {
                await sqlClient.raw(
                  `UPDATE ?? SET ??  = array_to_string(array_replace(string_to_array(??, ','), ?, ?), ',')`,
                  [
                    baseModel.getTnPath(table.table_name),
                    column.column_name,
                    column.column_name,
                    option.title,
                    newOp.title,
                  ],
                );
              } else if (driverType === 'sqlite3') {
                await sqlClient.raw(
                  `UPDATE ?? SET ?? = TRIM(REPLACE(',' || ?? || ',', ',' || ? || ',', ',' || ? || ','), ',')`,
                  [
                    baseModel.getTnPath(table.table_name),
                    column.column_name,
                    column.column_name,
                    option.title,
                    newOp.title,
                  ],
                );
              }
            }
          }
        }

        // Process temporary title interchanges (conflict resolution)
        for (const ch of interchange) {
          const newOp = ch.def_option;
          if (column.uidt === UITypes.SingleSelect) {
            await baseModel.bulkUpdateAll(
              {
                where: `(${column.title},eq,${ch.temp_title})`,
                skipValidationAndHooks: true,
              },
              { [column.column_name]: newOp.title },
              { cookie: req },
            );
          } else if (column.uidt === UITypes.MultiSelect) {
            if (driverType === 'mysql' || driverType === 'mysql2') {
              if (colBody.dt === 'set') {
                await sqlClient.raw(
                  `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), CONCAT(',', ?, ','))) WHERE FIND_IN_SET(?, ??)`,
                  [
                    baseModel.getTnPath(table.table_name),
                    column.column_name,
                    column.column_name,
                    ch.temp_title,
                    newOp.title,
                    ch.temp_title,
                    column.column_name,
                  ],
                );
              } else {
                await sqlClient.raw(
                  `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), CONCAT(',', ?, ',')))`,
                  [
                    baseModel.getTnPath(table.table_name),
                    column.column_name,
                    column.column_name,
                    ch.temp_title,
                    newOp.title,
                    ch.temp_title,
                    column.column_name,
                  ],
                );
              }
            } else if (driverType === 'pg') {
              await sqlClient.raw(
                `UPDATE ?? SET ??  = array_to_string(array_replace(string_to_array(??, ','), ?, ?), ',')`,
                [
                  baseModel.getTnPath(table.table_name),
                  column.column_name,
                  column.column_name,
                  ch.temp_title,
                  newOp.title,
                ],
              );
            } else if (driverType === 'sqlite3') {
              await sqlClient.raw(
                `UPDATE ?? SET ?? = TRIM(REPLACE(',' || ?? || ',', ',' || ? || ',', ',' || ? || ','), ',')`,
                [
                  baseModel.getTnPath(table.table_name),
                  column.column_name,
                  column.column_name,
                  ch.temp_title,
                  newOp.title,
                ],
              );
            }
          }
        }

        // handle trim value when converting it from SingleLineText cell to SingleSelect
        if (
          column.uidt === UITypes.SingleLineText &&
          colBody.uidt === UITypes.SingleSelect
        ) {
          await sqlClient.raw(
            `UPDATE ??
               SET ?? = TRIM(??)
               WHERE ?? <> TRIM(??)`,
            [
              baseModel.getTnPath(table.table_name),
              column.column_name,
              column.column_name,
              column.column_name,
              column.column_name,
            ],
          );
        }

        // Update value in filters that reference this column
        const filters = await Filter.getFiltersByColumn(context, column.id);

        for (const filter of filters ?? []) {
          let newValue = filter.value;
          // do not try to map when the comparison has no value
          if (
            ncIsUndefined(newValue) ||
            ncIsNull(newValue) ||
            newValue === ''
          ) {
            continue;
          }
          // Split filter values and update them based on title changes
          const values = filter.value?.split(',');
          const updatedValues = values.map((val) => {
            const change = titleChanges.find((c) => c.old_title === val.trim());
            return change ? change.new_title : val;
          });
          newValue = updatedValues.join(',');
          // Update filter if value changed
          if (newValue !== filter.value) {
            await Filter.update(context, filter.id, {
              value: newValue,
            });
          }
        }
      }

      await this.updateMetaAndDatabase(context, {
        table,
        // include id since it won't be part of api request
        column: {
          ...colBody,
          id: column.id,
        },
        source,
        reuse,
        processColumn: async () => {
          await this.updateFormulas(context, {
            oldColumn: column,
            colBody,
          });
        },
      });

      if (column.uidt === UITypes.SingleSelect) {
        const kanbanViewsByColId =
          (await KanbanView.getViewsByGroupingColId(context, column.id)) || [];
        for (const kanbanView of kanbanViewsByColId) {
          const view = await View.get(context, kanbanView.fk_view_id);
          view.meta = parseMetaProp(view);

          if (colBody.uidt === UITypes.SingleSelect) {
            // Column is/remains SingleSelect - update the kanban view
            await View.update(context, view.id, {
              ...view,
              meta: {
                ...view.meta,
                groupingFieldColumn: colBody,
              },
            });

            // Update kanban stack meta when column options are modified
            if (colBody.colOptions?.options) {
              const stackMetaObj = parseProp(kanbanView.meta) || {};

              if (!stackMetaObj[column.id]) {
                stackMetaObj[column.id] = [];
              }

              // Build new stack meta based on updated column options
              const newStackMeta = [];
              const existingStacks = stackMetaObj[column.id] || [];

              // Add uncategorized stack first
              const existingUncategorized = existingStacks.find(
                (stack) => stack.id === 'uncategorized',
              );
              const uncategorizedStack = existingUncategorized || {
                id: 'uncategorized',
                title: null,
                order: 0,
                color: '#6A7184',
                collapsed: false,
              };
              newStackMeta.push(uncategorizedStack);

              // Process each column option, preserving existing order when possible
              for (const option of colBody.colOptions.options) {
                const existingStack = existingStacks.find(
                  (stack) => stack.id === option.id,
                );

                if (existingStack) {
                  newStackMeta.push({
                    ...option,
                    order: existingStack.order,
                    collapsed: existingStack.collapsed || false,
                  });
                } else {
                  const maxOrder = Math.max(
                    ...existingStacks.map((s) => s.order || 0),
                    0,
                  );
                  newStackMeta.push({
                    ...option,
                    order: maxOrder + 1,
                    collapsed: false,
                  });
                }
              }

              // Sort by order
              newStackMeta.sort((a, b) => (a.order || 0) - (b.order || 0));

              // Update kanban view meta
              stackMetaObj[column.id] = newStackMeta;
              await KanbanView.update(context, kanbanView.fk_view_id, {
                meta: stackMetaObj,
              });
            }
          } else {
            // Column is no longer SingleSelect - remove grouping
            await View.update(context, view.id, {
              ...view,
              meta: {
                ...view.meta,
                groupingFieldColumn: null, // or undefined, depending on your schema
              },
            });

            // Clear the kanban stack meta for this column
            const stackMetaObj = parseProp(kanbanView.meta) || {};
            delete stackMetaObj[column.id];
            await KanbanView.update(context, kanbanView.fk_view_id, {
              meta: stackMetaObj,
            });
          }

          await view.getView(context);
          NocoSocket.broadcastEvent(
            context,
            {
              event: EventType.META_EVENT,
              payload: {
                action: 'view_update',
                payload: view,
              },
            },
            context.socket_id,
          );
        }
      }
    } else if (colBody.uidt === UITypes.User) {
      // handle default value for user column
      if (typeof colBody.cdf !== 'string') {
        colBody.cdf = '';
      } else if (colBody.cdf) {
        const baseUsers = await BaseUser.getUsersList(context, {
          base_id: source.base_id,
          include_ws_deleted: false,
        });

        const emailOrIds = colBody.cdf.split(',');
        const emailsNotPresent = emailOrIds.filter((el) => {
          return !baseUsers.find((user) => user.id === el || user.email === el);
        });

        if (emailsNotPresent.length) {
          NcError.badRequest(
            `The following default users are not part of workspace: ${emailsNotPresent.join(
              ', ',
            )}`,
          );
        }

        const ids = emailOrIds.map((el) => {
          const user = baseUsers.find(
            (user) => user.id === el || user.email === el,
          );
          return user.id;
        });

        colBody.cdf = ids.join(',');
      }

      if (column.uidt === UITypes.User) {
        // multi user to single user
        if (
          colBody.meta?.is_multi === false &&
          column.meta?.is_multi === true
        ) {
          const baseModel = await reuseOrSave('baseModel', reuse, async () =>
            Model.getBaseModelSQL(context, {
              id: table.id,
              dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
                NcConnectionMgrv2.get(source),
              ),
            }),
          );

          const dbDriver = await reuseOrSave('dbDriver', reuse, async () =>
            NcConnectionMgrv2.get(source),
          );
          const driverType = dbDriver.clientType();

          // MultiSelect to SingleSelect
          if (driverType === 'mysql' || driverType === 'mysql2') {
            await sqlClient.raw(
              `UPDATE ?? SET ?? = SUBSTRING_INDEX(??, ',', 1) WHERE ?? LIKE '%,%';`,
              [
                baseModel.getTnPath(table.table_name),
                column.column_name,
                column.column_name,
                column.column_name,
              ],
            );
          } else if (driverType === 'pg') {
            await sqlClient.raw(`UPDATE ?? SET ?? = split_part(??, ',', 1);`, [
              baseModel.getTnPath(table.table_name),
              column.column_name,
              column.column_name,
            ]);
          } else if (driverType === 'sqlite3') {
            await sqlClient.raw(
              `UPDATE ?? SET ?? = substr(??, 1, instr(??, ',') - 1) WHERE ?? LIKE '%,%';`,
              [
                baseModel.getTnPath(table.table_name),
                column.column_name,
                column.column_name,
                column.column_name,
                column.column_name,
              ],
            );
          }
        }

        colBody = await getColumnPropsFromUIDT(colBody, source);

        await this.updateMetaAndDatabase(context, {
          table,
          // pass id since it won't be part of api request
          column: { ...colBody, id: column.id },
          source,
          reuse,
          processColumn: async () => {
            await this.updateFormulas(context, {
              oldColumn: column,
              colBody,
            });
          },
        });
      } else {
        // email/text to user
        const baseModel = await reuseOrSave('baseModel', reuse, async () =>
          Model.getBaseModelSQL(context, {
            id: table.id,
            dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
              NcConnectionMgrv2.get(source),
            ),
          }),
        );

        const baseUsers = await BaseUser.getUsersList(context, {
          base_id: column.base_id,
        });

        const data = await baseModel.execAndParse(
          sqlClient.knex
            .raw('SELECT DISTINCT ?? FROM ??', [
              column.column_name,
              baseModel.getTnPath(table.table_name),
            ])
            .toQuery(),
        );

        const rows = data.map((el) => el[column.column_name]);

        if (rows.some((el) => el?.split(',').length > 1)) {
          colBody.meta = {
            is_multi: true,
          };
        }

        // create nested replace statement for each user
        let setStatement = 'null';

        if (
          [
            UITypes.URL,
            UITypes.Email,
            UITypes.SingleLineText,
            UITypes.PhoneNumber,
            UITypes.SingleLineText,
            UITypes.LongText,
            UITypes.MultiSelect,
          ].includes(column.uidt)
        ) {
          const dbDriver = await reuseOrSave('dbDriver', reuse, async () =>
            NcConnectionMgrv2.get(source),
          );
          const driverType = dbDriver.clientType();

          let trimColumn = `??`;
          if (driverType === 'mysql' || driverType === 'mysql2') {
            trimColumn = `TRIM(BOTH ' ' FROM ??)`;
          } else if (driverType === 'pg') {
            trimColumn = `BTRIM(??)`;
          } else if (driverType === 'sqlite3') {
            trimColumn = `TRIM(??)`;
          }

          setStatement = baseUsers
            .map((user) =>
              sqlClient.knex
                .raw(`WHEN ${trimColumn} = ? THEN ?`, [
                  column.column_name,
                  user.email,
                  user.id,
                ])
                .toQuery(),
            )
            .join('\n');

          setStatement = `CASE\n${setStatement}\nELSE null\nEND`;
        }

        await sqlClient.raw(`UPDATE ?? SET ?? = ${setStatement};`, [
          baseModel.getTnPath(table.table_name),
          column.column_name,
        ]);

        colBody = await getColumnPropsFromUIDT(colBody, source);

        await this.updateMetaAndDatabase(context, {
          table,
          // pass id since it won't be part of api request
          column: { ...colBody, id: column.id },
          source,
          reuse,
          processColumn: async () => {
            await this.updateFormulas(context, {
              oldColumn: column,
              colBody,
            });
          },
        });
      }
    } else {
      if (column.uidt === UITypes.User) {
        const baseModel = await reuseOrSave('baseModel', reuse, async () =>
          Model.getBaseModelSQL(context, {
            id: table.id,
            dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
              NcConnectionMgrv2.get(source),
            ),
          }),
        );

        const baseUsers = await BaseUser.getUsersList(context, {
          base_id: column.base_id,
        });

        // create nested replace statement for each user
        const setStatement = baseUsers.reduce((acc, user) => {
          const qb = sqlClient.knex.raw(`REPLACE(${acc}, ?, ?)`, [
            user.id,
            user.email,
          ]);
          return qb.toQuery();
        }, sqlClient.knex.raw(`??`, [column.column_name]).toQuery());

        await sqlClient.raw(`UPDATE ?? SET ?? = ${setStatement};`, [
          baseModel.getTnPath(table.table_name),
          column.column_name,
        ]);
      } else if (
        column.uidt === UITypes.SingleSelect &&
        column.uidt !== colBody.uidt &&
        (await KanbanView.getViewsByGroupingColId(context, column.id)).length >
          0
      ) {
        NcError.badRequest(
          `The column '${column.title}' is being used in Kanban View. Please update stack by field or delete Kanban View first.`,
        );
      }

      if (
        isAIPromptCol(column) &&
        (colBody.uidt !== UITypes.LongText ||
          (colBody.uidt === UITypes.LongText &&
            colBody.meta?.[LongTextAiMetaProp] !== true))
      ) {
        const baseModel = await reuseOrSave('baseModel', reuse, async () =>
          Model.getBaseModelSQL(context, {
            id: table.id,
            dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
              NcConnectionMgrv2.get(source),
            ),
          }),
        );

        await convertAIRecordTypeToValue({
          source,
          table,
          column,
          baseModel,
          sqlClient,
        });
      } else if (isAIPromptCol(colBody)) {
        let prompt = '';

        /*
          Substitute column alias with id in prompt
        */
        if (colBody.prompt_raw) {
          await table.getColumns(context);

          prompt = colBody.prompt_raw.replace(/{(.*?)}/g, (match, p1) => {
            const column = table.columns.find((c) => c.title === p1);

            if (!column) {
              NcError.badRequest(`Field '${p1}' not found`);
            }

            return `{${column.id}}`;
          });
        }

        colBody.prompt = prompt;

        // If column wasn't AI before, convert the data to AIRecordType format
        if (
          column.uidt !== UITypes.LongText ||
          column.meta?.[LongTextAiMetaProp] !== true
        ) {
          const baseModel = await reuseOrSave('baseModel', reuse, async () =>
            Model.getBaseModelSQL(context, {
              id: table.id,
              dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
                NcConnectionMgrv2.get(source),
              ),
            }),
          );

          await convertValueToAIRecordType({
            source,
            table,
            column,
            baseModel,
            sqlClient,
            user: param.user,
          });
        }
      }

      colBody = await getColumnPropsFromUIDT(colBody, source);

      await this.updateMetaAndDatabase(context, {
        table,
        // pass id since it won't be part of api request
        column: { ...colBody, id: column.id },
        source,
        reuse,
        processColumn: async () => {
          await this.updateFormulas(context, {
            oldColumn: column,
            colBody,
          });
        },
      });
    }

    const DATE_TIME_TYPES = [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ];

    if (
      DATE_TIME_TYPES.includes(column.uidt) &&
      !DATE_TIME_TYPES.includes(colBody.uidt)
    ) {
      // Column type changed from date/time to non-date/time - delete all ranges
      const calendarRanges = await CalendarRange.IsColumnBeingUsedAsRange(
        context,
        column.id,
      );
      for (const col of calendarRanges ?? []) {
        await CalendarRange.delete(col.id, context);
      }
    } else if (DATE_TIME_TYPES.includes(colBody.uidt)) {
      // Column is still/becoming a date/time type - validate ranges
      const calendarRanges = await CalendarRange.IsColumnBeingUsedAsRange(
        context,
        column.id,
      );

      for (const range of calendarRanges ?? []) {
        let shouldDeleteRange = false;

        if (range.fk_from_column_id === column.id && range.fk_to_column_id) {
          const endColumn = await Column.get(context, {
            colId: range.fk_to_column_id,
          });

          if (!endColumn || endColumn.uidt !== colBody.uidt) {
            shouldDeleteRange = true;
          } else {
            // Check timezone compatibility
            const newTimezone = colBody.meta?.timezone;
            const endTimezone = endColumn.meta?.timezone;

            // Delete if both have timezones but they don't match
            if (newTimezone && endTimezone && newTimezone !== endTimezone) {
              shouldDeleteRange = true;
            }
          }
        } else if (
          range.fk_to_column_id === column.id &&
          range.fk_from_column_id
        ) {
          const startColumn = await Column.get(context, {
            colId: range.fk_from_column_id,
          });

          if (!startColumn || startColumn.uidt !== colBody.uidt) {
            shouldDeleteRange = true;
          } else {
            // Check timezone compatibility
            const newTimezone = colBody.meta?.timezone;
            const startTimezone = startColumn.meta?.timezone;

            // Delete if both have timezones but they don't match
            if (newTimezone && startTimezone && newTimezone !== startTimezone) {
              shouldDeleteRange = true;
            }
          }
        }

        if (shouldDeleteRange) {
          await CalendarRange.delete(range.id, context);
        }
      }
    }

    if (
      column.uidt === UITypes.Attachment &&
      colBody.uidt !== UITypes.Attachment
    ) {
      await View.updateIfColumnUsedAsExpandedMode(
        context,
        column.id,
        column.fk_model_id,
      );
    }

    const defaultViewId = table.views?.find((v) => v.is_default)?.id;

    // Pass defaultViewId so that default view column order and visibility get added to the column meta
    // Get all the columns in the table and return
    await table.getColumns(context, undefined, defaultViewId);

    // Handle filter transformation if this is a column type change
    if (column.uidt !== colBody.uidt) {
      try {
        await this.filtersService.transformFiltersForColumnTypeChange(context, {
          columnId: column.id,
          newColumnType: colBody.uidt as UITypes,
          oldColumnType: column.uidt as UITypes,
          sqlUi,
        });
      } catch (error) {
        // Log error but don't fail the column update
        this.logger.error(
          'Failed to transform filters for column type change:',
          error.message,
        );
      }
    }

    const updatedColumn = await Column.get(context, { colId: param.columnId });

    this.appHooksService.emit(AppEvents.COLUMN_UPDATE, {
      table,
      oldColumn,
      column: updatedColumn,
      columnId: param.columnId,
      req: param.req,
      context,
      columns: table.columns,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'column_update',
          payload: {
            table,
            column: updatedColumn,
          },
        },
      },
      context.socket_id,
    );

    await applyRowColorInvolvement();

    if (!param.columnWebhookManager) {
      await columnWebhookManager.populateNewColumns();
      columnWebhookManager.emit();
    }

    if (param.apiVersion === NcApiVersion.V3) {
      return column;
    }

    return table;
  }

  async columnGet(context: NcContext, param: { columnId: string }) {
    return Column.get(context, { colId: param.columnId });
  }

  async columnSetAsPrimary(
    context: NcContext,
    param: { columnId: string; req: NcRequest },
  ) {
    const oldColumn = await Column.get(context, { colId: param.columnId });
    const oldPrimaryColumn = await Model.get(context, oldColumn.fk_model_id)
      .then((model) => model.getColumns(context))
      .then((columns) => columns.find((c) => c.pv));
    if (!oldColumn) {
      NcError.notFound(`Column with id ${param.columnId} not found`);
    }
    const result = await Model.updatePrimaryColumn(
      context,
      oldColumn.fk_model_id,
      oldColumn.id,
    );

    const column = await Column.get(context, { colId: param.columnId });

    // to reflect column properly on realtime and getWithInfo we will get default view column order and visibility in col meta
    const table = await Model.getWithInfo(context, { id: column.fk_model_id });

    if (oldPrimaryColumn) {
      this.appHooksService.emit(AppEvents.COLUMN_UPDATE, {
        table,
        oldColumn: oldPrimaryColumn,
        column: { ...oldPrimaryColumn, pv: false },
        columnId: column.id,
        req: param.req,
        context,
        columns: table.columns,
      });

      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: {
            action: 'column_update',
            payload: {
              table,
              column: { ...oldPrimaryColumn, pv: false },
            },
          },
        },
        context.socket_id,
      );
    }

    this.appHooksService.emit(AppEvents.COLUMN_UPDATE, {
      table,
      oldColumn,
      column,
      columnId: column.id,
      req: param.req,
      context,
      columns: table.columns,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'column_update',
          payload: {
            table,
            column,
          },
        },
      },
      context.socket_id,
    );

    return result;
  }

  async columnAdd<T extends NcApiVersion = NcApiVersion | null | undefined>(
    context: NcContext,
    param: {
      req: NcRequest;
      tableId: string;
      column: ColumnReqType;
      user: UserType;
      reuse?: ReusableParams;
      suppressFormulaError?: boolean;
      apiVersion?: T;
      columnWebhookManager?: ColumnWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<T extends NcApiVersion.V3 ? Column : Model> {
    let savedColumn;
    // if column_name is defined and title is not defined, set title to column_name
    if (param.column.column_name && !param.column.title) {
      param.column.title = param.column.column_name;
    }

    validatePayload(
      'swagger.json#/components/schemas/ColumnReq',
      param.column,
      false,
      context,
    );

    const reuse = param.reuse || {};

    const table = await reuseOrSave('table', reuse, async () =>
      Model.getWithInfo(context, {
        id: param.tableId,
      }),
    );

    const source = await reuseOrSave('source', reuse, async () =>
      Source.get(context, table.source_id),
    );

    // check if source is readonly and column type is not allowed
    if (
      source?.is_schema_readonly &&
      !readonlyMetaAllowedTypes.includes(param.column.uidt as UITypes)
    ) {
      NcError.get(context).sourceMetaReadOnly(source.alias);
    }
    if (
      (param.column as any).system ||
      [UITypes.Order, UITypes.ID].includes(param.column.uidt as UITypes)
    ) {
      NcError.get(context).invalidRequestBody(
        `Cannot manually create system columns`,
      );
    } else {
      deleteColumnSystemPropsFromRequest(param.column);
    }

    const base = await reuseOrSave('base', reuse, async () =>
      source.getProject(context),
    );

    const columnWebhookManager =
      param.columnWebhookManager ??
      (
        await new ColumnWebhookManagerBuilder(context, ncMeta).withModelId(
          param.tableId,
        )
      ).forCreate();

    if (param.column.title || param.column.column_name) {
      const dbDriver = await reuseOrSave('dbDriver', reuse, async () =>
        NcConnectionMgrv2.get(source),
      );

      const sqlClientType = dbDriver.clientType();

      const mxColumnLength = Column.getMaxColumnNameLength(sqlClientType);

      if (!isVirtualCol(param.column)) {
        param.column.column_name = sanitizeColumnName(
          param.column.column_name || param.column.title,
          source.type,
        );
      }

      // trim leading and trailing spaces from column title as knex trim them by default
      if (param.column.title) {
        param.column.title = param.column.title.trim();
      }

      // if column_name missing then generate it from title
      if (!param.column.column_name) {
        param.column.column_name = param.column.title;
      }

      if (param.column.column_name) {
        // - 5 is a buffer for suffix
        let colName = param.column.column_name.slice(0, mxColumnLength - 5);
        let suffix = 1;
        while (
          !(await Column.checkTitleAvailable(context, {
            column_name: colName,
            fk_model_id: param.tableId,
          }))
        ) {
          colName = param.column.column_name.slice(0, mxColumnLength - 5);
          colName += `_${suffix++}`;
        }
        param.column.column_name = colName;
      }

      if (
        param.column.column_name &&
        param.column.column_name.length > mxColumnLength
      ) {
        NcError.get(context).invalidRequestBody(
          `Column name ${param.column.column_name} exceeds ${mxColumnLength} characters`,
        );
      }

      if (param.column.title && param.column.title.length > 255) {
        NcError.get(context).invalidRequestBody(
          `Column title ${param.column.title} exceeds 255 characters`,
        );
      }
    }

    if (
      !isVirtualCol(param.column) &&
      !(await Column.checkTitleAvailable(context, {
        column_name: param.column.column_name,
        fk_model_id: param.tableId,
      }))
    ) {
      NcError.get(context).duplicateAlias({
        type: 'column',
        alias: param.column.column_name,
        label: 'name',
        base: context.base_id,
        additionalTrace: {
          table: param.tableId,
        },
      });
    }
    if (
      !(await Column.checkAliasAvailable(context, {
        title: param.column.title || param.column.column_name,
        fk_model_id: param.tableId,
      }))
    ) {
      NcError.get(context).duplicateAlias({
        type: 'column',
        alias: param.column.title,
        base: context.base_id,
        additionalTrace: {
          table: param.tableId,
        },
      });
    }

    let colBody: any = param.column;

    const colExtra = {
      view_id: colBody.view_id,
      column_order: colBody.column_order,
    };

    switch (colBody.uidt) {
      case UITypes.Rollup:
        {
          await validateRollupPayload(context, param.column);

          savedColumn = await Column.insert(context, {
            ...colBody,
            fk_model_id: table.id,
          });
        }
        break;
      case UITypes.Lookup:
        {
          await validateLookupPayload(context, param.column);

          savedColumn = await Column.insert(context, {
            ...colBody,
            fk_model_id: table.id,
          });
        }
        break;

      case UITypes.Links:
      case UITypes.LinkToAnotherRecord:
        savedColumn = await this.createLTARColumn(context, {
          ...param,
          source,
          base,
          reuse,
          colExtra,
          columnWebhookManager,
        });

        this.appHooksService.emit(AppEvents.RELATION_CREATE, {
          column: {
            ...colBody,
            fk_model_id: param.tableId,
            base_id: base.id,
            source_id: source.id,
          },
          req: param.req,
          context,
        });
        break;

      case UITypes.QrCode:
        validateParams(['fk_qr_value_column_id'], param.column, context);

        savedColumn = await Column.insert(context, {
          ...colBody,
          fk_model_id: table.id,
        });
        break;
      case UITypes.Barcode:
        validateParams(['fk_barcode_value_column_id'], param.column, context);

        savedColumn = await Column.insert(context, {
          ...colBody,
          fk_model_id: table.id,
        });
        break;
      case UITypes.Formula:
        try {
          colBody.formula = await substituteColumnAliasWithIdInFormula(
            colBody.formula_raw || colBody.formula,
            table.columns,
          );
          colBody.parsed_tree = await validateFormulaAndExtractTreeWithType({
            // formula may include double curly brackets in previous version
            // convert to single curly bracket here for compatibility
            formula: colBody.formula,
            column: {
              ...colBody,
              colOptions: colBody,
            },
            columns: table.columns,
            clientOrSqlUi: source.type as any,
            getMeta: async (modelId) => {
              const model = await Model.get(context, modelId);
              await model.getColumns(context);
              return model;
            },
          });

          const baseModel = await reuseOrSave('baseModel', reuse, async () =>
            Model.getBaseModelSQL(context, {
              id: table.id,
              dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
                NcConnectionMgrv2.get(source),
              ),
            }),
          );
          await formulaQueryBuilderv2({
            baseModel: baseModel,
            tree: colBody.formula,
            model: table,
            column: null,
            validateFormula: true,
            parsedTree: colBody.parsed_tree,
          });
        } catch (e) {
          colBody.error = e.message;
          colBody.parsed_tree = null;
          if (!param.suppressFormulaError) {
            throw e;
          }
        }

        savedColumn = await Column.insert(context, {
          ...colBody,
          fk_model_id: table.id,
        });

        break;
      case UITypes.Button: {
        if (colBody.type === ButtonActionsType.Url) {
          try {
            colBody.formula = await substituteColumnAliasWithIdInFormula(
              colBody.formula_raw || colBody.formula,
              table.columns,
            );
            colBody.parsed_tree = await validateFormulaAndExtractTreeWithType({
              formula: colBody.formula,
              columns: table.columns,
              column: {
                ...colBody,
                colOptions: colBody,
              },
              clientOrSqlUi: source.type as any,
              getMeta: async (modelId) => {
                const model = await Model.get(context, modelId);
                await model.getColumns(context);
                return model;
              },
            });

            const baseModel = await reuseOrSave('baseModel', reuse, async () =>
              Model.getBaseModelSQL(context, {
                id: table.id,
                dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
                  NcConnectionMgrv2.get(source),
                ),
              }),
            );
            await formulaQueryBuilderv2({
              baseModel: baseModel,
              tree: colBody.formula,
              model: table,
              column: null,
              validateFormula: true,
              parsedTree: colBody.parsed_tree,
            });
          } catch (e) {
            colBody.error = e.message;
            colBody.parsed_tree = null;
            if (!param.suppressFormulaError) {
              NcError.get(context).invalidRequestBody('Invalid URL Formula');
            }
          }
        } else if (colBody.type === ButtonActionsType.Webhook) {
          if (!colBody.fk_webhook_id) {
            colBody.fk_webhook_id = null;
          }

          const hook = await Hook.get(context, colBody.fk_webhook_id);

          if (!hook || !hook.active || hook.event !== 'manual') {
            colBody.fk_webhook_id = null;
          }
        } else if (colBody.type === ButtonActionsType.Script) {
          if (!colBody.fk_script_id) {
            colBody.fk_script_id = null;
          }
          const script = await Script.get(context, colBody.fk_script_id);
          if (!script) {
            colBody.fk_script_id = null;
          }
        } else if (colBody.type === ButtonActionsType.Ai) {
          /*
            Substitute column alias with id in prompt
          */
          if (colBody.formula_raw) {
            await table.getColumns(context);

            colBody.formula = colBody.formula_raw.replace(
              /{(.*?)}/g,
              (match, p1) => {
                const column = table.columns.find((c) => c.title === p1);

                if (!column) {
                  NcError.get(context).invalidRequestBody(
                    `Field '${p1}' not found`,
                  );
                }

                return `{${column.id}}`;
              },
            );
          }
        }

        savedColumn = await Column.insert(context, {
          ...colBody,
          fk_model_id: table.id,
        });
        break;
      }
      case UITypes.CreatedTime:
      case UITypes.LastModifiedTime:
      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy:
        {
          let columnName: string;
          const columns = await table.getColumns(context);
          // check if column already exists, then just create a new column in meta
          // else create a new column in meta and db
          const existingColumn = columns.find(
            (c) => c.uidt === colBody.uidt && c.system,
          );

          if (!existingColumn) {
            let columnTitle;

            switch (colBody.uidt) {
              case UITypes.CreatedTime:
                columnName = 'created_at';
                columnTitle = 'CreatedAt';
                break;
              case UITypes.LastModifiedTime:
                columnName = 'updated_at';
                columnTitle = 'UpdatedAt';
                break;
              case UITypes.CreatedBy:
                columnName = 'created_by';
                columnTitle = 'nc_created_by';
                break;
              case UITypes.LastModifiedBy:
                columnName = 'updated_by';
                columnTitle = 'nc_updated_by';
                break;
            }

            // todo:  check type as well
            const dbColumn = columns.find((c) => c.column_name === columnName);

            if (dbColumn) {
              columnName = getUniqueColumnName(columns, columnName);
            }

            {
              colBody = await getColumnPropsFromUIDT(colBody, source);

              // remove default value for SQLite since it doesn't support default value as function when adding column
              // only support default value as constant value
              if (source.type === 'sqlite3') {
                colBody.cdf = null;
              }

              // create column in db
              const tableUpdateBody = {
                ...table,
                tn: table.table_name,
                originalColumns: table.columns.map((c) => ({
                  ...c,
                  cn: c.column_name,
                })),
                columns: [
                  ...table.columns.map((c) => ({ ...c, cn: c.column_name })),
                  {
                    ...colBody,
                    cn: columnName,
                    altered: Altered.NEW_COLUMN,
                  },
                ],
              };
              const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
                ProjectMgrv2.getSqlMgr(context, { id: source.base_id }),
              );
              await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
            }

            const title = getUniqueColumnAliasName(table.columns, columnTitle);

            await Column.insert(context, {
              ...colBody,
              title,
              system: 1,
              fk_model_id: table.id,
              column_name: columnName,
            });
          } else {
            columnName = existingColumn.column_name;
          }
          savedColumn = await Column.insert(context, {
            ...colBody,
            fk_model_id: table.id,
            column_name: null,
          });
        }
        break;
      default:
        {
          colBody = await getColumnPropsFromUIDT(colBody, source);
          if (colBody.uidt === UITypes.Duration) {
            colBody.dtxp = '20';
            // by default, colBody.dtxs is 2
            // Duration column needs more that that
            colBody.dtxs = '4';
          }

          if (
            [UITypes.SingleSelect, UITypes.MultiSelect].includes(colBody.uidt)
          ) {
            if (!colBody.colOptions?.options) {
              colBody.colOptions = {
                ...colBody.colOptions,
                options: [],
              };
            }

            const dbDriver = await NcConnectionMgrv2.get(source);
            const driverType = dbDriver.clientType();
            const optionTitles = colBody.colOptions.options.map((el) =>
              el.title.replace(/'/g, "''"),
            );

            // this is not used for select columns and cause issue for MySQL
            colBody.dtxs = '';
            // Handle default values
            if (colBody.cdf) {
              if (colBody.uidt === UITypes.SingleSelect) {
                try {
                  if (!optionTitles.includes(colBody.cdf.replace(/'/g, "''"))) {
                    NcError.get(context).invalidRequestBody(
                      `Default value '${colBody.cdf}' is not a select option.`,
                    );
                  }
                } catch (e) {
                  colBody.cdf = colBody.cdf.replace(/^'/, '').replace(/'$/, '');
                  if (!optionTitles.includes(colBody.cdf.replace(/'/g, "''"))) {
                    NcError.get(context).invalidRequestBody(
                      `Default value '${colBody.cdf}' is not a select option.`,
                    );
                  }
                }
              } else {
                try {
                  for (const cdf of colBody.cdf.split(',')) {
                    if (!optionTitles.includes(cdf.replace(/'/g, "''"))) {
                      NcError.get(context).invalidRequestBody(
                        `Default value '${cdf}' is not a select option.`,
                      );
                    }
                  }
                } catch (e) {
                  colBody.cdf = colBody.cdf.replace(/^'/, '').replace(/'$/, '');
                  for (const cdf of colBody.cdf.split(',')) {
                    if (!optionTitles.includes(cdf.replace(/'/g, "''"))) {
                      NcError.get(context).invalidRequestBody(
                        `Default value '${cdf}' is not a select option.`,
                      );
                    }
                  }
                }
              }

              // handle single quote for default value
              if (driverType === 'pg' || driverType === 'sqlite3') {
                colBody.cdf = colBody.cdf.replace(/'/g, "'");
              } else {
                colBody.cdf = colBody.cdf.replace(/'/g, "''");
              }

              if (driverType === 'pg') {
                colBody.cdf = `'${colBody.cdf}'`;
              }
            }

            // Restrict duplicates
            const titles = colBody.colOptions.options.map((el) => el.title);
            if (
              titles.some(function (item) {
                return titles.indexOf(item) !== titles.lastIndexOf(item);
              })
            ) {
              NcError.get(context).invalidRequestBody(
                'Duplicates are not allowed!',
              );
            }

            // Restrict empty options
            if (
              titles.some(function (item) {
                return item === '';
              })
            ) {
              NcError.get(context).invalidRequestBody(
                'Empty options are not allowed!',
              );
            }

            // Trim end of enum/set
            if (colBody.dt === 'enum' || colBody.dt === 'set') {
              for (const opt of colBody.colOptions.options) {
                opt.title = opt.title.trimEnd();
              }
            }

            if (colBody.uidt === UITypes.SingleSelect) {
              colBody.dtxp = colBody.colOptions?.options.length
                ? `${colBody.colOptions.options
                    .map((o) => `'${o.title.replace(/'/gi, "''")}'`)
                    .join(',')}`
                : '';
            } else if (colBody.uidt === UITypes.MultiSelect) {
              colBody.dtxp = colBody.colOptions?.options.length
                ? `${colBody.colOptions.options
                    .map((o) => {
                      if (o.title.includes(',')) {
                        NcError.get(context).invalidRequestBody(
                          "Illegal char(',') for MultiSelect",
                        );
                      }
                      return `'${o.title.replace(/'/gi, "''")}'`;
                    })
                    .join(',')}`
                : '';
            }

            // Handle empty enum/set for mysql (we restrict empty user options beforehand)
            if (driverType === 'mysql' || driverType === 'mysql2') {
              if (
                !colBody.colOptions.options.length &&
                (!colBody.dtxp || colBody.dtxp === '')
              ) {
                colBody.dtxp = "''";
              }

              if (colBody.dt === 'set') {
                if (colBody.colOptions?.options.length > 64) {
                  colBody.dt = 'text';
                }
              }
            }
          }

          if (colBody.uidt === UITypes.User) {
            // handle default value for user column
            if (colBody.cdf) {
              const baseUsers = await BaseUser.getUsersList(context, {
                base_id: base.id,
                include_ws_deleted: false,
              });

              const emailOrIds = colBody.cdf.split(',');
              const emailsNotPresent = emailOrIds.filter((el) => {
                return !baseUsers.find(
                  (user) => user.id === el || user.email === el,
                );
              });

              if (emailsNotPresent.length) {
                NcError.get(context).invalidRequestBody(
                  `The following default users are not part of workspace: ${emailsNotPresent.join(
                    ', ',
                  )}`,
                );
              }

              const ids = emailOrIds.map((el) => {
                const user = baseUsers.find(
                  (user) => user.id === el || user.email === el,
                );
                return user.id;
              });

              colBody.cdf = ids.join(',');
            }
          }

          if (isAIPromptCol(colBody)) {
            let prompt = '';

            /*
            Substitute column alias with id in prompt
          */
            if (colBody.prompt_raw) {
              await table.getColumns(context);

              prompt = colBody.prompt_raw.replace(/{(.*?)}/g, (match, p1) => {
                const column = table.columns.find((c) => c.title === p1);

                if (!column) {
                  NcError.get(context).invalidRequestBody(
                    `Field '${p1}' not found`,
                  );
                }

                return `{${column.id}}`;
              });
            }

            colBody.prompt = prompt;
          }

          const tableUpdateBody = {
            ...table,
            tn: table.table_name,
            originalColumns: table.columns.map((c) => ({
              ...c,
              cn: c.column_name,
            })),
            columns: [
              ...table.columns.map((c) => ({ ...c, cn: c.column_name })),
              {
                ...colBody,
                cn: colBody.column_name,
                altered: Altered.NEW_COLUMN,
              },
            ],
          };

          const sqlClient = await reuseOrSave('sqlClient', reuse, async () =>
            NcConnectionMgrv2.getSqlClient(source),
          );
          const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
            ProjectMgrv2.getSqlMgr(context, { id: source.base_id }),
          );
          await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

          if (!source.isMeta()) {
            const columns: Array<
              Omit<Column, 'column_name' | 'title'> & {
                cn: string;
                system?: boolean;
              }
            > = (
              await sqlClient.columnList({
                tn: table.table_name,
                schema: source.getConfig()?.schema,
              })
            )?.data?.list;

            const insertedColumnMeta =
              columns.find((c) => c.cn === colBody.column_name) || ({} as any);

            Object.assign(colBody, insertedColumnMeta);
          }

          savedColumn = await Column.insert(context, {
            ...colBody,
            fk_model_id: table.id,
          });
        }
        break;
    }

    const defaultViewId = table.views?.find((v) => v.is_default)?.id;

    // Pass defaultViewId so that default view column order and visibility get added to the column meta
    await table.getColumns(context, undefined, defaultViewId);

    const newColumn = table.columns.find((c) => c.title === param.column.title);

    if (!isLinksOrLTAR(param.column)) {
      this.appHooksService.emit(AppEvents.COLUMN_CREATE, {
        table,
        column: {
          ...param.column,
          fk_model_id: table.id,
          id: newColumn?.id,
        },
        columnId: newColumn?.id,
        req: param.req,
        context,
        columns: table.columns,
      });
    }

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'column_add',
          payload: {
            table,
            column: newColumn,
          },
        },
      },
      context.socket_id,
    );

    if (param.apiVersion === NcApiVersion.V3) {
      if (savedColumn)
        return (await Column.get(context, {
          colId: savedColumn.id,
        })) as T extends NcApiVersion.V3 ? Column<any> : never;

      if (param.column.title) {
        return (await Column.get(context, {
          colId: table.columns.find((c) => c.title === param.column.title)?.id,
        })) as T extends NcApiVersion.V3 ? Column<any> : never;
      }
    }

    await columnWebhookManager.addNewColumnById({
      columnId: newColumn.id,
      action: WebhookActions.INSERT,
    });
    if (!param.columnWebhookManager) {
      columnWebhookManager.emit();
    }
    return table as T extends NcApiVersion.V3 | null | undefined
      ? never
      : Model;
  }

  async columnDelete(
    context: NcContext,
    param: {
      req?: any;
      columnId: string;
      user: UserType;
      forceDeleteSystem?: boolean;
      reuse?: ReusableParams;
      columnWebhookManager?: ColumnWebhookManager;
    },
    ncMeta = this.metaService,
  ) {
    const reuse = param.reuse || {};

    const column = await Column.get(context, { colId: param.columnId }, ncMeta);

    if (!column) {
      NcError.get(context).fieldNotFound(param.columnId);
    }

    const { applyRowColorInvolvement } =
      await this.viewRowColorService.checkIfColumnInvolved({
        context,
        existingColumn: column,
        action: 'delete',
      });

    if ((column.system || isSystemColumn(column)) && !param.forceDeleteSystem) {
      NcError.get(context).invalidRequestBody(
        `The column '${
          column.title || column.column_name
        }' is a system column and cannot be deleted.`,
      );
    }

    const table = await reuseOrSave('table', reuse, async () =>
      Model.getWithInfo(
        context,
        {
          id: column.fk_model_id,
        },
        ncMeta,
      ),
    );
    const source = await reuseOrSave('source', reuse, async () =>
      Source.get(context, table.source_id, false, ncMeta),
    );

    // check if source is readonly and column type is not allowed
    if (
      source?.is_schema_readonly &&
      !readonlyMetaAllowedTypes.includes(column.uidt)
    ) {
      NcError.get(context).sourceMetaReadOnly(source.alias);
    }

    if (table.synced && column.readonly && !param.forceDeleteSystem) {
      NcError.get(context).invalidRequestBody(
        `The column '${
          column.title || column.column_name
        }' is a synced column and cannot be deleted.`,
      );
    }

    const columnWebhookManager =
      param.columnWebhookManager ??
      (
        await (
          await new ColumnWebhookManagerBuilder(context, ncMeta).withModelId(
            column.fk_model_id,
          )
        ).addColumnById(column.id)
      ).forDelete();

    const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
      ProjectMgrv2.getSqlMgr(context, { id: source.base_id }, ncMeta),
    );

    // check column association with any custom links or LTAR
    if (!isVirtualCol(column)) {
      const columns = await table.getColumns(context, ncMeta);

      let link = columns.find((c) => {
        return (
          isLinksOrLTAR(c.uidt) &&
          ((c.colOptions as LinkToAnotherRecordColumn)?.fk_child_column_id ===
            param.columnId ||
            (c.colOptions as LinkToAnotherRecordColumn)?.fk_parent_column_id ===
              param.columnId ||
            (c.colOptions as LinkToAnotherRecordColumn)
              ?.fk_mm_child_column_id === param.columnId ||
            (c.colOptions as LinkToAnotherRecordColumn)
              ?.fk_mm_parent_column_id === param.columnId)
        );
      })?.colOptions as LinkToAnotherRecordColumn;
      if (!link) {
        link = await ncMeta.metaGet2(
          table.fk_workspace_id,
          table.base_id,
          MetaTable.COL_RELATIONS,
          {},
          null,
          {
            _or: [
              { fk_child_column_id: { eq: param.columnId } },
              { fk_parent_column_id: { eq: param.columnId } },
              { fk_mm_child_column_id: { eq: param.columnId } },
              { fk_mm_parent_column_id: { eq: param.columnId } },
            ],
          },
        );
      }

      // if relation found then throw error
      if (link) {
        const linkCol = await Column.get(
          context,
          { colId: link.fk_column_id },
          ncMeta,
        );
        const table = await linkCol.getModel(context, ncMeta);
        NcError.columnAssociatedWithLink(column.id, {
          customMessage: `Column is associated with Link column '${
            linkCol.title || linkCol.column_name
          }' (${
            table.title || table.table_name
          }). Please delete the link column first.`,
        });
      }
    }

    /**
     * @Note: When using 'falls through to default' cases in a switch statement,
     * it is crucial to place them after cases with break statements.
     * Additionally, include a check for column.uidt inside these 'falls through to default' cases
     * to conditionally execute logic based on the value of column.uidt.
     *
     * This check becomes essential when there are multiple 'falls through to default' cases.
     * By adding the column.uidt check, we ensure that each case has its own specific conditions.
     * This prevents unintended execution of logic from subsequent cases due to fall-through,
     * providing a more controlled and predictable behavior in the switch statement.
     */
    switch (column.uidt) {
      case UITypes.Lookup:
      case UITypes.Rollup:
      case UITypes.QrCode:
      case UITypes.Barcode:
      case UITypes.Button:
        await Column.delete2(
          context,
          {
            id: param.columnId,
            ...generateColumnDeleteHandler(columnWebhookManager),
          },
          ncMeta,
        );
        break;

      case UITypes.Formula:
        if (!column.colOptions) await column.getColOptions(context, ncMeta);
        if (column.colOptions.parsed_tree?.dataType === FormulaDataTypes.DATE) {
          if (
            (
              await CalendarRange.IsColumnBeingUsedAsRange(
                context,
                column.id,
                ncMeta,
              )
            )?.length
          ) {
            NcError.badRequest(
              `The column '${column.title}' is being used in Calendar View. Please update Calendar View first.`,
            );
          }
        }

        await Column.delete(context, param.columnId, ncMeta);
        break;
      // on deleting created/last modified columns, keep the column in table and delete the column from meta
      case UITypes.CreatedTime:
      case UITypes.LastModifiedTime: {
        const rangesList = await CalendarRange.IsColumnBeingUsedAsRange(
          context,
          column.id,
          ncMeta,
        );
        if (rangesList?.length) {
          NcError.badRequest(
            `The column '${column.title}' is being used in Calendar View. Please update Calendar View first.`,
          );
        }
        await Column.delete2(
          context,
          {
            id: param.columnId,
            ...generateColumnDeleteHandler(columnWebhookManager),
          },
          ncMeta,
        );
        break;
      }
      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy: {
        await Column.delete2(
          context,
          {
            id: param.columnId,
            ...generateColumnDeleteHandler(columnWebhookManager),
          },
          ncMeta,
        );
        break;
      }
      // Since Links is just an extended version of LTAR, we can use the same logic
      case UITypes.Links:
      case UITypes.LinkToAnotherRecord:
        {
          const relationColOpt =
            await column.getColOptions<LinkToAnotherRecordColumn>(
              context,
              ncMeta,
            );

          const { childContext, parentContext, mmContext } =
            await relationColOpt.getParentChildContext(context);
          const childColumn = await relationColOpt.getChildColumn(
            childContext,
            ncMeta,
          );
          const childTable = await childColumn.getModel(childContext, ncMeta);

          const parentColumn = await relationColOpt.getParentColumn(
            parentContext,
            ncMeta,
          );
          const parentTable = await parentColumn.getModel(
            parentContext,
            ncMeta,
          );
          const custom = column.meta?.custom;

          switch (relationColOpt.type) {
            case 'bt':
            case 'hm':
              {
                await this.deleteHmOrBtRelation(context, {
                  column,
                  relationColOpt,
                  source,
                  childColumn,
                  childTable,
                  parentColumn,
                  parentTable,
                  sqlMgr,
                  ncMeta,
                  custom,
                  req: param.req,
                  childContext,
                  parentContext,
                  columnWebhookManager,
                });
              }
              break;
            case 'oo':
              {
                await this.deleteOoRelation(context, {
                  relationColOpt,
                  req: param.req,
                  source,
                  childColumn,
                  childTable,
                  parentColumn,
                  parentTable,
                  sqlMgr,
                  ncMeta,
                  custom,
                  childContext,
                  parentContext,
                  column,
                  columnWebhookManager,
                });
              }
              break;
            case 'mm':
              {
                const mmTable = await relationColOpt.getMMModel(
                  mmContext,
                  ncMeta,
                );
                const mmParentCol = await relationColOpt.getMMParentColumn(
                  mmContext,
                  ncMeta,
                );
                const mmChildCol = await relationColOpt.getMMChildColumn(
                  mmContext,
                  ncMeta,
                );

                if (!custom) {
                  await this.deleteHmOrBtRelation(
                    context,
                    {
                      relationColOpt: null,
                      parentColumn: parentColumn,
                      childTable: mmTable,
                      sqlMgr,
                      parentTable: parentTable,
                      childColumn: mmParentCol,
                      source,
                      ncMeta,
                      virtual: !!relationColOpt.virtual,
                      req: param.req,
                      childContext: mmContext,
                      parentContext,
                      columnWebhookManager,
                    },
                    true,
                  );

                  await this.deleteHmOrBtRelation(
                    context,
                    {
                      relationColOpt: null,
                      parentColumn: childColumn,
                      childTable: mmTable,
                      sqlMgr,
                      parentTable: childTable,
                      childColumn: mmChildCol,
                      source,
                      ncMeta,
                      virtual: !!relationColOpt.virtual,
                      req: param.req,
                      childContext: mmContext,
                      parentContext: childContext,
                      columnWebhookManager,
                    },
                    true,
                  );
                }

                const { refContext } = relationColOpt.getRelContext(context);

                const refTable = await relationColOpt.getRelatedTable(
                  refContext,
                  ncMeta,
                );
                const columnsInRelatedTable: Column[] =
                  await refTable.getColumns(refContext, ncMeta);

                for (const c of columnsInRelatedTable) {
                  if (!isLinksOrLTAR(c.uidt)) continue;
                  const colOpt =
                    await c.getColOptions<LinkToAnotherRecordColumn>(
                      refContext,
                      ncMeta,
                    );
                  if (
                    colOpt.type === 'mm' &&
                    colOpt.fk_parent_column_id === childColumn.id &&
                    colOpt.fk_child_column_id === parentColumn.id &&
                    colOpt.fk_mm_model_id === relationColOpt.fk_mm_model_id &&
                    colOpt.fk_mm_parent_column_id ===
                      relationColOpt.fk_mm_child_column_id &&
                    colOpt.fk_mm_child_column_id ===
                      relationColOpt.fk_mm_parent_column_id
                  ) {
                    await Column.delete2(
                      refContext,
                      {
                        id: c.id,
                        ...generateColumnDeleteHandler(columnWebhookManager),
                      },
                      ncMeta,
                    );
                    if (!c.system) {
                      this.appHooksService.emit(AppEvents.COLUMN_DELETE, {
                        table: refTable,
                        column: c,
                        req: param.req,
                        context: refContext,
                        columnId: c.id,
                        columns: await refTable.getCachedColumns(refContext),
                      });
                    }
                    break;
                  }
                }

                await Column.delete2(
                  context,
                  {
                    id: relationColOpt.fk_column_id,
                    ...generateColumnDeleteHandler(columnWebhookManager),
                  },
                  ncMeta,
                );
                const table =
                  column.fk_model_id === parentTable.id
                    ? parentTable
                    : childTable;
                const tblContext =
                  column.fk_model_id === parentTable.id
                    ? parentContext
                    : childContext;
                this.appHooksService.emit(AppEvents.COLUMN_DELETE, {
                  table,
                  column: column,
                  req: param.req,
                  context: tblContext,
                  columnId: column.id,
                  columns: await table.getCachedColumns(context),
                });

                if (!custom) {
                  if (mmTable) {
                    // delete bt columns in m2m table
                    await mmTable.getColumns(mmContext, ncMeta);
                    for (const c of mmTable.columns) {
                      if (!isLinksOrLTAR(c.uidt)) continue;
                      const colOpt =
                        await c.getColOptions<LinkToAnotherRecordColumn>(
                          mmContext,
                          ncMeta,
                        );
                      if (colOpt.type === 'bt') {
                        await Column.delete2(
                          mmContext,
                          {
                            id: c.id,
                            ...generateColumnDeleteHandler(
                              columnWebhookManager,
                            ),
                          },
                          ncMeta,
                        );
                      }
                    }
                  }

                  // delete hm columns in parent table
                  await parentTable.getColumns(parentContext, ncMeta);
                  for (const c of parentTable.columns) {
                    if (!isLinksOrLTAR(c.uidt)) continue;
                    const colOpt =
                      await c.getColOptions<LinkToAnotherRecordColumn>(
                        parentContext,
                        ncMeta,
                      );
                    if (
                      colOpt.fk_related_model_id ===
                      relationColOpt.fk_mm_model_id
                    ) {
                      await Column.delete2(
                        parentContext,
                        {
                          id: c.id,
                          ...generateColumnDeleteHandler(columnWebhookManager),
                        },
                        ncMeta,
                      );
                    }
                  }

                  // delete hm columns in child table
                  await childTable.getColumns(childContext, ncMeta);
                  for (const c of childTable.columns) {
                    if (!isLinksOrLTAR(c.uidt)) continue;
                    const colOpt =
                      await c.getColOptions<LinkToAnotherRecordColumn>(
                        childContext,
                        ncMeta,
                      );
                    if (
                      colOpt.fk_related_model_id ===
                      relationColOpt.fk_mm_model_id
                    ) {
                      await Column.delete2(
                        context,
                        {
                          id: c.id,
                          ...generateColumnDeleteHandler(columnWebhookManager),
                        },
                        ncMeta,
                      );
                    }
                  }

                  // delete m2m table if it is made for mm relation
                  if (mmTable?.mm) {
                    // retrieve columns in m2m table again
                    await mmTable.getColumns(mmContext, ncMeta);

                    // ignore deleting table if it has more than 2 columns
                    // the expected 2 columns would be table1_id & table2_id
                    if (mmTable.columns.length === 2) {
                      const mmSource =
                        relationColOpt.fk_mm_source_id &&
                        relationColOpt.fk_mm_source_id !== source.id
                          ? await Source.get(
                              mmContext,
                              relationColOpt.fk_mm_source_id,
                              undefined,
                              ncMeta,
                            )
                          : source;
                      (mmTable as any).tn = mmTable.table_name;
                      await sqlMgr.sqlOpPlus(mmSource, 'tableDelete', mmTable);
                      await mmTable.delete(mmContext, ncMeta);
                    }
                  }
                }

                if (custom) {
                  // if custom then delete the relation index
                  await this.deleteCustomLinkIndex(context, {
                    ltarCustomProps: {
                      column_id: relationColOpt.fk_child_column_id,
                      ref_column_id: relationColOpt.fk_parent_column_id,
                      ref_model_id: relationColOpt.fk_related_model_id,
                      junc_column_id: relationColOpt.fk_mm_child_column_id,
                      junc_model_id: relationColOpt.fk_mm_model_id,
                      junc_ref_column_id: relationColOpt.fk_mm_parent_column_id,
                    },
                    reuse,
                    isMm: relationColOpt.type === RelationTypes.MANY_TO_MANY,
                    source,
                  });
                }
              }
              break;
          }
        }
        this.appHooksService.emit(AppEvents.RELATION_DELETE, {
          column,
          req: param.req,
          context,
        });
        break;
      case UITypes.ForeignKey: {
        NcError.notImplemented(`Support for ${column.uidt}`);
        break;
      }
      case UITypes.SingleSelect: {
        if (
          (await KanbanView.getViewsByGroupingColId(context, column.id))
            .length > 0
        ) {
          NcError.badRequest(
            `The column '${column.title}' is being used in Kanban View. Please update Kanban View first.`,
          );
        }
        /* falls through to default */
      }
      case UITypes.DateTime:
      case UITypes.Date: {
        const listRanges = await CalendarRange.IsColumnBeingUsedAsRange(
          context,
          column.id,
          ncMeta,
        );
        if (listRanges?.length) {
          NcError.badRequest(
            `The column '${column.title}' is being used in Calendar View. Please update Calendar View first.`,
          );
        }
        /* falls through to default */
      }
      default: {
        const tableUpdateBody = {
          ...table,
          tn: table.table_name,
          originalColumns: table.columns.map((c) => ({
            ...c,
            cn: c.column_name,
            cno: c.column_name,
          })),
          columns: table.columns.map((c) => {
            if (c.id === param.columnId) {
              return {
                ...c,
                cn: c.column_name,
                cno: c.column_name,
                altered: Altered.DELETE_COLUMN,
              };
            } else {
              (c as any).cn = c.column_name;
            }
            return c;
          }),
        };

        await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

        await Column.delete2(
          context,
          {
            id: param.columnId,
            ...generateColumnDeleteHandler(columnWebhookManager),
          },
          ncMeta,
        );
      }
    }

    const defaultViewId = table.views?.find((v) => v.is_default)?.id;

    // Pass defaultViewId so that default view column order and visibility get added to the column meta
    await table.getColumns(context, ncMeta, defaultViewId);

    const displayValueColumn = mapDefaultDisplayValue(table.columns);
    if (displayValueColumn) {
      await Model.updatePrimaryColumn(
        context,
        displayValueColumn.fk_model_id,
        displayValueColumn.id,
        ncMeta,
      );
    }

    await View.updateIfColumnUsedAsExpandedMode(
      context,
      column.id,
      column.fk_model_id,
      ncMeta,
    );

    if (!isLinksOrLTAR(column)) {
      this.appHooksService.emit(AppEvents.COLUMN_DELETE, {
        table,
        column,
        req: param.req,
        context,
        columnId: column.id,
        columns: table.columns,
      });
    }

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'column_delete',
          payload: {
            table,
            column,
          },
        },
      },
      context.socket_id,
    );

    await applyRowColorInvolvement();

    await Hook.deleteTriggersByColumnId(context, column.id, ncMeta);

    if (!param.columnWebhookManager) {
      await columnWebhookManager.populateNewColumns();
      columnWebhookManager.emit();
    }
    return table;
  }

  deleteHmOrBtRelation = async (
    context: NcContext,
    {
      relationColOpt,
      source,
      childColumn,
      childTable,
      parentColumn,
      parentTable,
      sqlMgr,
      ncMeta = Noco.ncMeta,
      virtual,
      custom = false,
      req,
      parentContext,
      childContext,
      column,
      columnWebhookManager,
    }: {
      relationColOpt: LinkToAnotherRecordColumn;
      source: Source;
      childColumn: Column;
      childTable: Model;
      parentColumn: Column;
      parentTable: Model;
      sqlMgr: SqlMgrv2;
      ncMeta?: MetaService;
      virtual?: boolean;
      custom?: boolean;
      req: NcRequest;
      parentContext: NcContext;
      childContext: NcContext;
      column?: Column;
      columnWebhookManager?: ColumnWebhookManager;
    },
    ignoreFkDelete = false,
  ) => {
    if (childTable && !custom) {
      let foreignKeyName;

      // if relationColOpt is not provided, extract it from child table
      // and get the foreign key name for dropping the foreign key
      if (!relationColOpt) {
        foreignKeyName = (
          (
            await childTable
              .getColumns(childContext, ncMeta)
              .then(async (cols) => {
                for (const col of cols) {
                  if (col.uidt === UITypes.LinkToAnotherRecord) {
                    const colOptions =
                      await col.getColOptions<LinkToAnotherRecordColumn>(
                        childContext,
                        ncMeta,
                      );
                    if (colOptions.fk_related_model_id === parentTable.id) {
                      return { colOptions };
                    }
                  }
                }
              })
          )?.colOptions as LinkToAnotherRecordType
        ).fk_index_name;
      } else {
        foreignKeyName = relationColOpt.fk_index_name;
      }

      if (!relationColOpt?.virtual && !virtual) {
        // Ensure relation deletion is not attempted for virtual relations
        try {
          const childSource =
            childColumn.source_id === source.id
              ? source
              : await Source.get(childContext, childColumn.source_id);

          // Attempt to delete the foreign key constraint from the database
          await sqlMgr.sqlOpPlus(childSource, 'relationDelete', {
            childColumn: childColumn.column_name,
            childTable: childTable.table_name,
            parentTable: parentTable.table_name,
            parentColumn: parentColumn.column_name,
            foreignKeyName,
          });
        } catch (e) {
          console.log(e.message);
        }
      }
    }

    if (!relationColOpt) return;

    const { refContext } = relationColOpt.getRelContext(context);

    const refTable = await relationColOpt.getRelatedTable(refContext, ncMeta);
    const columnsInRelatedTable: Column[] = await refTable.getColumns(
      refContext,
      ncMeta,
    );
    const relType = relationColOpt.type === 'bt' ? 'hm' : 'bt';
    for (const c of columnsInRelatedTable) {
      if (!isLinksOrLTAR(c.uidt)) continue;
      const colOpt = await c.getColOptions<LinkToAnotherRecordColumn>(
        refContext,
        ncMeta,
      );
      if (
        colOpt.fk_parent_column_id === parentColumn.id &&
        colOpt.fk_child_column_id === childColumn.id &&
        colOpt.type === relType
      ) {
        const colInRefTable = await Column.get(
          refContext,
          { colId: c.id },
          ncMeta,
        );
        await columnWebhookManager?.addOldColumnById({
          columnId: c.id,
          action: WebhookActions.DELETE,
        });
        await Column.delete2(
          refContext,
          { id: c.id, ...generateColumnDeleteHandler(columnWebhookManager) },
          ncMeta,
        );

        if (!colInRefTable.system) {
          this.appHooksService.emit(AppEvents.COLUMN_DELETE, {
            table: refTable,
            column: colInRefTable,
            req,
            context: refContext,
            columnId: colInRefTable.id,
            columns: await refTable.getColumns(context),
          });
        }

        break;
      }
    }

    await columnWebhookManager?.addOldColumnById({
      columnId: relationColOpt.fk_column_id,
      action: WebhookActions.DELETE,
    });
    // delete virtual columns
    await Column.delete2(
      context,
      {
        id: relationColOpt.fk_column_id,
        ...generateColumnDeleteHandler(columnWebhookManager),
      },
      ncMeta,
    );
    const isBt =
      relationColOpt.type === RelationTypes.BELONGS_TO ||
      (relationColOpt.type === RelationTypes.ONE_TO_ONE && column.meta?.bt);
    const col = isBt ? childColumn : parentColumn;
    const table = isBt ? childTable : parentTable;
    const delContext = isBt ? childContext : parentContext;
    if (!col.system) {
      this.appHooksService.emit(AppEvents.COLUMN_DELETE, {
        table,
        column: col,
        req: req,
        context: delContext,
        columnId: col.id,
        columns: await table.getColumns(delContext),
      });
    }

    if (custom) return;
    if (!ignoreFkDelete && childColumn.uidt === UITypes.ForeignKey) {
      const cTable = await Model.getWithInfo(
        childContext,
        {
          id: childTable.id,
        },
        ncMeta,
      );

      const childSource =
        childColumn.source_id === source.id
          ? source
          : await Source.get(childContext, childColumn.source_id);

      // if virtual column delete all index before deleting the column
      if (relationColOpt?.virtual) {
        const indexes =
          (
            await sqlMgr.sqlOp(childSource, 'indexList', {
              tn: cTable.table_name,
            })
          )?.data?.list ?? [];

        for (const index of indexes) {
          if (index.cn !== childColumn.column_name) continue;
          await sqlMgr.sqlOpPlus(childSource, 'indexDelete', {
            ...index,
            tn: cTable.table_name,
            columns: [childColumn.column_name],
            indexName: index.key_name,
          });
        }
      }

      const tableUpdateBody = {
        ...cTable,
        tn: cTable.table_name,
        originalColumns: cTable.columns.map((c) => ({
          ...c,
          cn: c.column_name,
          cno: c.column_name,
        })),
        columns: cTable.columns.map((c) => {
          if (c.id === childColumn.id) {
            return {
              ...c,
              cn: c.column_name,
              cno: c.column_name,
              altered: Altered.DELETE_COLUMN,
            };
          } else {
            (c as any).cn = c.column_name;
          }
          return c;
        }),
      };

      await sqlMgr.sqlOpPlus(childSource, 'tableUpdate', tableUpdateBody);
      await columnWebhookManager?.addOldColumnById({
        columnId: childColumn.id,
        action: WebhookActions.DELETE,
      });
      // delete foreign key column
      await Column.delete2(
        childContext,
        {
          id: childColumn.id,
          ...generateColumnDeleteHandler(columnWebhookManager),
        },
        ncMeta,
      );
    }
  };

  deleteOoRelation = async (
    context: NcContext,
    {
      relationColOpt,
      source,
      childColumn,
      childTable,
      parentColumn,
      parentTable,
      sqlMgr,
      ncMeta = Noco.ncMeta,
      virtual,
      custom = false,
      req,
      childContext,
      parentContext,
      column,
      columnWebhookManager,
    }: {
      relationColOpt: LinkToAnotherRecordColumn;
      source: Source;
      childColumn: Column;
      childTable: Model;
      parentColumn: Column;
      parentTable: Model;
      sqlMgr: SqlMgrv2;
      ncMeta?: MetaService;
      virtual?: boolean;
      custom?: boolean;
      req: NcRequest;

      childContext: NcContext;
      parentContext: NcContext;
      column: Column;
      columnWebhookManager?: ColumnWebhookManager;
    },
    ignoreFkDelete = false,
  ) => {
    const childSource =
      childColumn.source_id === source.id
        ? source
        : await Source.get(childContext, childColumn.source_id);

    if (childTable) {
      if (!custom) {
        let foreignKeyName;

        // if relationColOpt is not provided, extract it from child table
        // and get the foreign key name for dropping the foreign key
        if (!relationColOpt) {
          foreignKeyName = (
            (
              await childTable
                .getColumns(childContext, ncMeta)
                .then(async (cols) => {
                  for (const col of cols) {
                    if (col.uidt === UITypes.LinkToAnotherRecord) {
                      const colOptions =
                        await col.getColOptions<LinkToAnotherRecordColumn>(
                          childContext,
                          ncMeta,
                        );
                      if (colOptions.fk_related_model_id === parentTable.id) {
                        return { colOptions };
                      }
                    }
                  }
                })
            )?.colOptions as LinkToAnotherRecordType
          ).fk_index_name;
        } else {
          foreignKeyName = relationColOpt.fk_index_name;
        }

        if (!relationColOpt?.virtual && !virtual) {
          // Ensure relation deletion is not attempted for virtual relations
          try {
            // Attempt to delete the foreign key constraint from the database
            await sqlMgr.sqlOpPlus(childSource, 'relationDelete', {
              childColumn: childColumn.column_name,
              childTable: childTable.table_name,
              parentTable: parentTable.table_name,
              parentColumn: parentColumn.column_name,
              foreignKeyName,
            });
          } catch (e) {
            console.log(e.message);
          }
        }
      }
    }

    if (!relationColOpt) return;

    const { refContext } = relationColOpt.getRelContext(context);

    const refTable = await relationColOpt.getRelatedTable(refContext, ncMeta);
    const columnsInRelatedTable: Column[] = await refTable.getCachedColumns(
      refContext,
    );

    const relType = RelationTypes.ONE_TO_ONE;

    for (const c of columnsInRelatedTable) {
      if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
      const colOpt = await c.getColOptions<LinkToAnotherRecordColumn>(
        refContext,
        ncMeta,
      );
      if (
        colOpt.fk_parent_column_id === parentColumn.id &&
        colOpt.fk_child_column_id === childColumn.id &&
        colOpt.type === relType
      ) {
        const colInRefTable = await Column.get(
          refContext,
          { colId: c.id },
          ncMeta,
        );

        await columnWebhookManager?.addOldColumnById({
          columnId: c.id,
          action: WebhookActions.DELETE,
        });
        await Column.delete2(
          refContext,
          { id: c.id, ...generateColumnDeleteHandler(columnWebhookManager) },
          ncMeta,
        );

        if (!colInRefTable.system) {
          this.appHooksService.emit(AppEvents.COLUMN_DELETE, {
            table: refTable,
            column: colInRefTable,
            req,
            context: refContext,
            columnId: colInRefTable.id,
            columns: await refTable.getColumns(context),
          });
        }
        break;
      }
    }

    await columnWebhookManager?.addOldColumnById({
      columnId: relationColOpt.fk_column_id,
      action: WebhookActions.DELETE,
    });
    // delete virtual columns
    await Column.delete2(
      context,
      {
        id: relationColOpt.fk_column_id,
        ...generateColumnDeleteHandler(columnWebhookManager),
      },
      ncMeta,
    );
    const isBt = column.meta?.bt;

    const col = isBt ? childColumn : parentColumn;
    const table = isBt ? childTable : parentTable;
    const delContext = isBt ? childContext : parentContext;
    if (!col.system) {
      this.appHooksService.emit(AppEvents.COLUMN_DELETE, {
        table,
        column: col,
        req: req,
        context: delContext,
        columnId: col.id,
        columns: await table.getColumns(context),
      });
    }

    if (custom) return;

    if (!ignoreFkDelete && childColumn.uidt === UITypes.ForeignKey) {
      const cTable = await Model.getWithInfo(
        context,
        {
          id: childTable.id,
        },
        ncMeta,
      );

      // if virtual column delete all index before deleting the column
      if (relationColOpt?.virtual) {
        const indexes =
          (
            await sqlMgr.sqlOp(childSource, 'indexList', {
              tn: cTable.table_name,
            })
          )?.data?.list ?? [];

        for (const index of indexes) {
          if (index.cn !== childColumn.column_name) continue;

          await sqlMgr.sqlOpPlus(childSource, 'indexDelete', {
            ...index,
            tn: cTable.table_name,
            columns: [childColumn.column_name],
            indexName: index.key_name,
          });
        }
      }

      const tableUpdateBody = {
        ...cTable,
        tn: cTable.table_name,
        originalColumns: cTable.columns.map((c) => ({
          ...c,
          cn: c.column_name,
          cno: c.column_name,
        })),
        columns: cTable.columns.map((c) => {
          if (c.id === childColumn.id) {
            return {
              ...c,
              cn: c.column_name,
              cno: c.column_name,
              altered: Altered.DELETE_COLUMN,
            };
          } else {
            (c as any).cn = c.column_name;
          }
          return c;
        }),
      };

      await sqlMgr.sqlOpPlus(childSource, 'tableUpdate', tableUpdateBody);
      await columnWebhookManager?.addOldColumnById({
        columnId: childColumn.id,
        action: WebhookActions.DELETE,
      });
      // delete foreign key column
      await Column.delete2(
        childContext,
        {
          id: childColumn.id,
          ...generateColumnDeleteHandler(columnWebhookManager),
        },
        ncMeta,
      );
    }
  };

  async createLTARColumn(
    context: NcContext,
    param: {
      tableId: string;
      column: ColumnReqType;
      source: Source;
      base: Base;
      reuse?: ReusableParams;
      colExtra?: any;
      user: UserType;
      req: NcRequest;
      columnWebhookManager?: ColumnWebhookManager;
    },
  ) {
    let savedColumn: Column;

    validateParams(['parentId', 'childId', 'type'], param.column, context);

    const reuse = param.reuse ?? {};

    // get table and refTable models
    const table = await Model.getWithInfo(context, {
      id: (param.column as LinkToAnotherColumnReqType).parentId,
    });

    const refContext = {
      ...context,
      base_id: (param.column as any)?.ref_base_id ?? context.base_id,
    };

    // check permission if cross-base link
    if (table.base_id !== refContext.base_id) {
      await this.checkCrossBasePermission(refContext, param.req.user);
    }

    const refTable = await Model.getWithInfo(refContext, {
      id: (param.column as LinkToAnotherColumnReqType).childId,
    });
    let refColumn: Column;
    const childView: View | null = (param.column as LinkToAnotherColumnReqType)
      ?.childViewId
      ? await View.getByTitleOrId(context, {
          fk_model_id: refTable.id,
          titleOrId: (param.column as LinkToAnotherColumnReqType).childViewId,
        })
      : null;

    const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
      ProjectMgrv2.getSqlMgr(context, {
        id: param.source.base_id,
      }),
    );

    const refSource =
      param.source.id === refTable.source_id
        ? param.source
        : await Source.get(refContext, refTable.source_id);

    // support cross base relations only if the bases are meta bases
    if (
      param.source.id !== refTable.source_id &&
      (!param.source.isMeta() || !refSource.isMeta())
    ) {
      NcError.badRequest(
        'Cross base relations are only supported between meta bases',
      );
    }

    // Need this since we support relations between tables in different bases
    const refSqlMgr =
      refTable.base_id === param.source.base_id
        ? sqlMgr
        : await ProjectMgrv2.getSqlMgr(context, {
            id: refTable.base_id,
          });
    const isLinks =
      param.column.uidt === UITypes.Links ||
      (param.column as LinkToAnotherColumnReqType).type === 'bt';

    // if xcdb base then treat as virtual relation to avoid creating foreign key
    if (param.source.isMeta() || param.source.type === 'snowflake') {
      (param.column as LinkToAnotherColumnReqType).virtual = true;
    }

    if (
      (param.column as LinkToAnotherColumnReqType).type === 'hm' ||
      (param.column as LinkToAnotherColumnReqType).type === 'bt'
    ) {
      // populate fk column name
      const fkColName = getUniqueColumnName(
        await refTable.getColumns(context),
        `${table.table_name}_id`,
      );

      let foreignKeyName;
      {
        // create foreign key
        const newColumn = {
          cn: fkColName,

          title: fkColName,
          column_name: fkColName,
          rqd: false,
          pk: false,
          ai: false,
          cdf: null,
          dt: table.primaryKey.dt,
          dtxp: table.primaryKey.dtxp,
          dtxs: table.primaryKey.dtxs,
          un: table.primaryKey.un,
          altered: Altered.NEW_COLUMN,
        };
        const tableUpdateBody = {
          ...refTable,
          tn: refTable.table_name,
          originalColumns: refTable.columns.map((c) => ({
            ...c,
            cn: c.column_name,
          })),
          columns: [
            ...refTable.columns.map((c) => ({
              ...c,
              cn: c.column_name,
            })),
            newColumn,
          ],
        };

        await refSqlMgr.sqlOpPlus(refSource, 'tableUpdate', tableUpdateBody);

        const { id } = await Column.insert(refContext, {
          ...newColumn,
          uidt: UITypes.ForeignKey,
          fk_model_id: refTable.id,
        });

        refColumn = await Column.get(refContext, { colId: id });

        // ignore relation creation if virtual
        if (!(param.column as LinkToAnotherColumnReqType).virtual) {
          foreignKeyName = generateFkName(table, refTable);
          // create relation
          await sqlMgr.sqlOpPlus(refSource, 'relationCreate', {
            childColumn: fkColName,
            childTable: refTable.table_name,
            parentTable: table.table_name,
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
            type: 'real',
            parentColumn: table.primaryKey.column_name,
            foreignKeyName,
          });
        }

        // todo: create index for virtual relations as well
        //       create index for foreign key in pg
        if (
          param.source.type === 'pg' ||
          (param.column as LinkToAnotherColumnReqType).virtual
        ) {
          const indexName = generateFkName(table, refTable);
          await this.createColumnIndex(refContext, {
            column: new Column({
              ...newColumn,
              fk_model_id: refTable.id,
            }),
            indexName,
            source: refSource,
            sqlMgr,
          });
        }
      }

      savedColumn = await createHmAndBtColumn(
        context,
        param.req,
        refTable,
        table,
        refColumn,
        childView,
        (param.column as LinkToAnotherColumnReqType).type as RelationTypes,
        (param.column as LinkToAnotherColumnReqType).title,
        foreignKeyName,
        (param.column as LinkToAnotherColumnReqType).virtual,
        null,
        param.column['meta'],
        isLinks,
        param.colExtra,
        undefined,
        undefined,
        param.columnWebhookManager,
      );
    } else if ((param.column as LinkToAnotherColumnReqType).type === 'oo') {
      // populate fk column name
      const fkColName = getUniqueColumnName(
        await refTable.getColumns(context),
        `${table.table_name}_id`,
      );

      let foreignKeyName;
      {
        // Create foreign key column for one-to-one relationship
        const newColumn = {
          cn: fkColName, // Column name in the database
          title: fkColName, // Human-readable title for the column
          column_name: fkColName, // Column name in the database ( used in sql client )
          rqd: false,
          pk: false,
          ai: false,
          cdf: null,
          dt: table.primaryKey.dt,
          dtxp: table.primaryKey.dtxp,
          dtxs: table.primaryKey.dtxs,
          un: table.primaryKey.un,
          altered: Altered.NEW_COLUMN,
          unique: 1, // Ensure the foreign key column is unique for one-to-one relationships
        };

        const tableUpdateBody = {
          ...refTable,
          tn: refTable.table_name,
          originalColumns: refTable.columns.map((c) => ({
            ...c,
            cn: c.column_name,
          })),
          columns: [
            ...refTable.columns.map((c) => ({
              ...c,
              cn: c.column_name,
            })),
            newColumn,
          ],
        };

        await sqlMgr.sqlOpPlus(refSource, 'tableUpdate', tableUpdateBody);

        const { id } = await Column.insert(refContext, {
          ...newColumn,
          uidt: UITypes.ForeignKey,
          fk_model_id: refTable.id,
        });

        refColumn = await Column.get(refContext, { colId: id });

        // ignore relation creation if virtual
        if (!(param.column as LinkToAnotherColumnReqType).virtual) {
          foreignKeyName = generateFkName(table, refTable);
          // create relation
          await sqlMgr.sqlOpPlus(refSource, 'relationCreate', {
            childColumn: fkColName,
            childTable: refTable.table_name,
            parentTable: table.table_name,
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
            type: 'real',
            parentColumn: table.primaryKey.column_name,
            foreignKeyName,
          });
        }

        // todo: create index for virtual relations as well
        //       create index for foreign key in pg
        if (
          param.source.type === 'pg' ||
          (param.column as LinkToAnotherColumnReqType).virtual
        ) {
          const indexName = generateFkName(table, refTable);
          await this.createColumnIndex(refContext, {
            column: new Column({
              ...newColumn,
              fk_model_id: refTable.id,
            }),
            indexName,
            source: refSource,
            sqlMgr,
          });
        }
      }
      savedColumn = await createOOColumn(
        context,
        param.req,
        refTable,
        table,
        refColumn,
        childView,
        (param.column as LinkToAnotherColumnReqType).type as RelationTypes,
        (param.column as LinkToAnotherColumnReqType).title,
        foreignKeyName,
        (param.column as LinkToAnotherColumnReqType).virtual,
        null,
        param.column['meta'],
        param.colExtra,
        undefined,
        undefined,
        param.columnWebhookManager,
      );
    } else if ((param.column as LinkToAnotherColumnReqType).type === 'mm') {
      const aTn = await getJunctionTableName(param, table, refTable);
      const aTnAlias = aTn;

      const primaryKey = table.primaryKey;
      const refPrimaryKey = refTable.primaryKey;

      const associateTableCols = [];

      const { parentCn: columnName, childCn: refColumnName } = getMMColumnNames(
        table,
        refTable,
      );

      associateTableCols.push(
        {
          cn: refColumnName,
          column_name: refColumnName,
          title: refColumnName,
          rqd: true,
          pk: true,
          ai: false,
          cdf: null,
          dt: refPrimaryKey.dt,
          dtxp: refPrimaryKey.dtxp,
          dtxs: refPrimaryKey.dtxs,
          un: refPrimaryKey.un,
          altered: 1,
          uidt: UITypes.ForeignKey,
        },
        {
          cn: columnName,
          column_name: columnName,
          title: columnName,
          rqd: true,
          pk: true,
          ai: false,
          cdf: null,
          dt: primaryKey.dt,
          dtxp: primaryKey.dtxp,
          dtxs: primaryKey.dtxs,
          un: primaryKey.un,
          altered: 1,
          uidt: UITypes.ForeignKey,
        },
      );

      await sqlMgr.sqlOpPlus(param.source, 'tableCreate', {
        tn: aTn,
        _tn: aTnAlias,
        columns: associateTableCols,
      });

      const assocModel = await Model.insert(
        context,
        param.base.id,
        param.source.id,
        {
          table_name: aTn,
          title: aTnAlias,
          // todo: sanitize
          mm: true,
          columns: associateTableCols,
          user_id: param.user?.id,
        },
      );

      let foreignKeyName1;
      let foreignKeyName2;

      if (!(param.column as LinkToAnotherColumnReqType).virtual) {
        foreignKeyName1 = generateFkName(table, refTable);
        foreignKeyName2 = generateFkName(table, refTable);

        const rel1Args = {
          ...param.column,
          childTable: aTn,
          childColumn: columnName,
          parentTable: table.table_name,
          parentColumn: primaryKey.column_name,
          type: 'real',
          foreignKeyName: foreignKeyName1,
        };
        const rel2Args = {
          ...param.column,
          childTable: aTn,
          childColumn: refColumnName,
          parentTable: refTable.table_name,
          parentColumn: refPrimaryKey.column_name,
          type: 'real',
          foreignKeyName: foreignKeyName2,
        };

        await sqlMgr.sqlOpPlus(param.source, 'relationCreate', rel1Args);
        await sqlMgr.sqlOpPlus(param.source, 'relationCreate', rel2Args);
      }
      const parentCol = (await assocModel.getColumns(context))?.find(
        (c) => c.column_name === columnName,
      );
      const childCol = (await assocModel.getColumns(context))?.find(
        (c) => c.column_name === refColumnName,
      );

      await createHmAndBtColumn(
        context,
        param.req,
        assocModel,
        refTable,
        childCol,
        null,
        null,
        null,
        foreignKeyName1,
        (param.column as LinkToAnotherColumnReqType).virtual,
        true,
        null,
        false,
        param.colExtra,
        undefined,
        undefined,
        // not need to pass columnWebhookManager here
        undefined,
      );
      await createHmAndBtColumn(
        context,
        param.req,
        assocModel,
        table,
        parentCol,
        null,
        null,
        null,
        foreignKeyName2,
        (param.column as LinkToAnotherColumnReqType).virtual,
        true,
        null,
        false,
        param.colExtra,
        undefined,
        undefined,
        // not need to pass columnWebhookManager here
        undefined,
      );

      let refCrossBaseLinkProps: {
        fk_related_base_id?: string;
        fk_mm_base_id?: string;
        fk_related_source_id?: string;
        fk_mm_source_id?: string;
      } = {};
      let crossBaseLinkProps: {
        fk_related_base_id?: string;
        fk_mm_base_id?: string;
        fk_related_source_id?: string;
        fk_mm_source_id?: string;
      } = {};

      // if cross base link set cross base link props
      if (refContext.base_id !== context.base_id) {
        crossBaseLinkProps = {
          fk_related_base_id: refContext.base_id,
          fk_mm_base_id: assocModel.base_id,
          fk_related_source_id: refTable.source_id,
          fk_mm_source_id: assocModel.source_id,
        };
        refCrossBaseLinkProps = {
          fk_related_base_id: context.base_id,
          fk_mm_base_id: assocModel.base_id,
          fk_related_source_id: table.source_id,
          fk_mm_source_id: assocModel.source_id,
        };
      }

      savedColumn = await Column.insert(context, {
        title: getUniqueColumnAliasName(
          await table.getColumns(context),
          param.column.title ?? pluralize(refTable.title),
        ),

        uidt: isLinks ? UITypes.Links : UITypes.LinkToAnotherRecord,
        type: 'mm',

        fk_model_id: table.id,

        fk_child_column_id: primaryKey.id,
        fk_parent_column_id: refPrimaryKey.id,
        fk_target_view_id: childView?.id,

        fk_mm_model_id: assocModel.id,
        fk_mm_child_column_id: parentCol.id,
        fk_mm_parent_column_id: childCol.id,
        fk_related_model_id: refTable.id,
        virtual: (param.column as LinkToAnotherColumnReqType).virtual,
        meta: {
          ...(param.column['meta'] || {}),
          plural: param.column['meta']?.plural || pluralize(refTable.title),
          singular:
            param.column['meta']?.singular || singularize(refTable.title),
        },

        // column_order and view_id if provided
        ...param.colExtra,
        // include cross base link props
        ...crossBaseLinkProps,
      });

      const parentRelCol = await Column.insert(refContext, {
        title: getUniqueColumnAliasName(
          [
            ...(await refTable.getColumns(refContext)),
            // if self ref include saved column
            ...(table.id === refTable.id ? [savedColumn] : []),
          ],
          pluralize(table.title),
        ),
        uidt: isLinks ? UITypes.Links : UITypes.LinkToAnotherRecord,
        type: 'mm',

        // ref_db_alias
        fk_model_id: refTable.id,
        // db_type:

        fk_child_column_id: refPrimaryKey.id,
        fk_parent_column_id: primaryKey.id,
        // Adding view ID here applies the view filter in reverse also
        fk_target_view_id: null,
        fk_mm_model_id: assocModel.id,
        fk_mm_child_column_id: childCol.id,
        fk_mm_parent_column_id: parentCol.id,
        fk_related_model_id: table.id,
        virtual: (param.column as LinkToAnotherColumnReqType).virtual,
        meta: {
          plural: pluralize(table.title),
          singular: singularize(table.title),
        },
        // if self referencing treat it as system field to hide from ui
        system: table.id === refTable.id,
        // include cross base link props
        ...refCrossBaseLinkProps,
      });

      this.appHooksService.emit(AppEvents.COLUMN_CREATE, {
        table: refTable,
        column: parentRelCol,
        columnId: parentRelCol.id,
        req: param.req,
        context: refContext,
        columns: await refTable.getCachedColumns(context),
      });

      this.appHooksService.emit(AppEvents.COLUMN_CREATE, {
        table: table,
        column: savedColumn,
        columnId: savedColumn.id,
        req: param.req,
        context,
        columns: await table.getCachedColumns(context),
      });

      // todo: create index for virtual relations as well
      // create index for foreign key in pg
      if (param.source.type === 'pg') {
        await this.createColumnIndex(context, {
          column: new Column({
            ...associateTableCols[0],
            fk_model_id: assocModel.id,
          }),
          indexName: generateFkName(table, refTable),
          source: param.source,
          sqlMgr,
        });
        await this.createColumnIndex(context, {
          column: new Column({
            ...associateTableCols[1],
            fk_model_id: assocModel.id,
          }),
          indexName: generateFkName(table, refTable),
          source: param.source,
          sqlMgr,
        });
      }
      await param.columnWebhookManager?.addNewColumnById({
        columnId: parentRelCol.id,
        action: WebhookActions.INSERT,
      });
      await param.columnWebhookManager?.addNewColumnById({
        columnId: savedColumn.id,
        action: WebhookActions.INSERT,
      });
      return savedColumn;
    }
  }

  async createColumnIndex(
    context: NcContext,
    {
      column,
      sqlMgr,
      source,
      indexName = null,
      nonUnique = true,
    }: {
      column: Column;
      sqlMgr: SqlMgrv2;
      source: Source;
      indexName?: string;
      nonUnique?: boolean;
    },
  ) {
    // TODO: implement for snowflake (right now create index does not work with identifier quoting in snowflake - bug?)
    if (source.type === 'snowflake') return;
    const model = await column.getModel(context);
    const indexArgs = {
      columns: [column.column_name],
      tn: model.table_name,
      non_unique: nonUnique,
      indexName,
    };
    await sqlMgr.sqlOpPlus(source, 'indexCreate', indexArgs);
  }

  async updateRollupOrLookup(
    context: NcContext,
    colBody: any,
    column: Column<any>,
  ) {
    // Validate rollup or lookup payload before proceeding with the update
    if (
      UITypes.Lookup === column.uidt &&
      validateRequiredField(colBody, [
        'fk_lookup_column_id',
        'fk_relation_column_id',
      ])
    ) {
      // Perform additional validation for lookup payload
      await validateLookupPayload(context, colBody, column.id);
      await Column.update(context, column.id, colBody);
    } else if (
      UITypes.Rollup === column.uidt &&
      validateRequiredField(colBody, [
        'fk_relation_column_id',
        'fk_rollup_column_id',
        'rollup_function',
      ])
    ) {
      // Perform additional validation for rollup payload
      await validateRollupPayload(context, colBody);
      const baseModel = await getBaseModelSqlFromModelId({
        modelId: column.fk_model_id,
        context,
      });
      await genRollupSelectv2({
        baseModelSqlv2: baseModel,
        knex: baseModel.dbDriver,
        columnOptions: {
          // colBody do not have fk_column_id
          // fk_column_id is required to detect circular ref
          fk_column_id: column.colOptions.fk_column_id,
          ...colBody,
        },
      });
      await Column.update(context, column.id, colBody);
    }
  }

  async columnsHash(context: NcContext, tableId: string) {
    const table = await Model.getWithInfo(context, {
      id: tableId,
    });

    if (!table) {
      NcError.tableNotFound(tableId);
    }

    return {
      hash: table.columnsHash,
    };
  }

  async columnBulk(
    context: NcContext,
    tableId: string,
    params: {
      hash: string;
      ops: {
        op: 'add' | 'update' | 'delete';
        column: Partial<Column>;
      }[];
      columnWebhookManager?: ColumnWebhookManager;
    },
    req: NcRequest,
  ) {
    // TODO validatePayload

    const table = await Model.getWithInfo(context, {
      id: tableId,
    });

    if (!table) {
      NcError.tableNotFound(tableId);
    }

    if (table.columnsHash !== params.hash) {
      NcError.get(context).outOfSync(
        'Columns are updated by someone else! Your changes are rejected. Please refresh the page and try again.',
      );
    }

    const source = await Source.get(context, table.source_id);

    if (!source) {
      NcError.sourceNotFound(table.source_id);
    }

    const base = await source.getProject(context);

    if (!base) {
      NcError.baseNotFound(source.base_id);
    }

    const dbDriver = await NcConnectionMgrv2.get(source);
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
    const sqlMgr = await ProjectMgrv2.getSqlMgr(context, {
      id: source.base_id,
    });
    const baseModel = await Model.getBaseModelSQL(context, {
      id: table.id,
      dbDriver: dbDriver,
    });

    if (!dbDriver || !sqlClient || !sqlMgr || !baseModel) {
      NcError.badRequest('There was an error handling your request');
    }

    const reuse: ReusableParams = {
      table,
      source,
      base,
      dbDriver,
      sqlClient,
      sqlMgr,
      baseModel,
    };

    const ops = params.ops;

    for (const op of ops) {
      if (op.op === 'update') {
        if (!op.column || !op.column?.id) {
          NcError.badRequest(
            'Bad request, update operation requires column id',
          );
        }
      } else if (op.op === 'delete') {
        if (!op.column || !op.column?.id) {
          NcError.badRequest(
            'Bad request, delete operation requires column id',
          );
        }
      } else if (op.op === 'add') {
        if (!op.column) {
          NcError.badRequest('Bad request, add operation requires column');
        }
      }
    }

    const failedOps = [];
    // Perform operations in a loop, capturing any errors for individual operations
    for (const op of ops) {
      const column = op.column;

      if (op.op === 'add') {
        try {
          const tableMeta = (await this.columnAdd(context, {
            tableId,
            column: column as ColumnReqType,
            req,
            user: req.user,
            reuse,
          })) as Model;

          await this.postColumnAdd(context, column as ColumnReqType, tableMeta);
        } catch (e) {
          failedOps.push({
            ...op,
            error: e.message,
          });
        }
      } else if (op.op === 'update') {
        try {
          await this.columnUpdate(context, {
            columnId: op.column.id,
            column: column as ColumnReqType,
            req,
            user: req.user,
            reuse,
          });

          await this.postColumnUpdate(context, column as ColumnReqType);
        } catch (e) {
          failedOps.push({
            ...op,
            error: e.message,
          });
        }
      } else if (op.op === 'delete') {
        try {
          await this.columnDelete(context, {
            columnId: op.column.id,
            req,
            user: req.user,
          });
        } catch (e) {
          failedOps.push({
            ...op,
            error: e.message,
          });
        }
      }
    }

    return {
      failedOps,
    };
  }

  protected async postColumnAdd(
    _context: NcContext,
    _columnBody: ColumnReqType,
    _tableMeta: Model,
  ) {
    // placeholder for post column add hook
  }

  protected async postColumnUpdate(
    _context: NcContext,
    _columnBody: ColumnReqType,
  ) {
    // placeholder for post column update hook
  }

  private async checkCrossBasePermission(
    refContext: NcContext,
    user: UserType,
  ) {
    // extract target base roles and check if columnAdd permission is granted
    const userWithRoles = await User.getWithRoles(refContext, user.id, {
      baseId: refContext.base_id,
      workspaceId: refContext.workspace_id,
    });

    if (!userWithRoles) {
      NcError.userNotFound(user.id);
    }

    if (
      !userWithRoles.base_roles?.[ProjectRoles.CREATOR] &&
      !userWithRoles.base_roles?.[ProjectRoles.OWNER]
    ) {
      NcError.forbidden(
        `You don't have permission to create a relation to target base ${refContext.base_id}`,
      );
    }
  }

  protected async deleteCustomLinkIndex(
    _context: NcContext,
    _: {
      ltarCustomProps: CustomLinkProps;
      isMm: boolean;
      reuse?: ReusableParams;
      source: Source;
    },
  ) {
    // placeholder for delete custom link index
  }

  async getLinkColumnRefTable(
    context: NcContext,
    { columnId, tableId }: { columnId: string; tableId: string },
  ) {
    const column = await Column.get(context, { colId: columnId });

    // if not LTAR or Links throw error
    if (!isLinksOrLTAR(column)) {
      NcError.badRequest('Invalid column id');
    }

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );

    let table: Model;

    const { refContext, mmContext } = colOptions.getRelContext(context);

    if (colOptions.fk_mm_model_id === tableId) {
      table = await colOptions.getMMModel(mmContext);
      // load columns
      await table.getColumns(mmContext);
    } else if (colOptions.fk_related_model_id === tableId) {
      table = await colOptions.getRelatedTable(refContext);
      // load columns
      await table.getColumns(refContext);
    } else {
      NcError.badRequest('Invalid table id');
    }

    // filter out columns other than primary key and display column
    table.columns = table.columns.filter((col) => {
      return col.pk || col.pv;
    });

    return table;
  }
}

export { reuseOrSave };
