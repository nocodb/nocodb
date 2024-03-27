import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isVirtualCol,
  substituteColumnAliasWithIdInFormula,
  substituteColumnIdWithAliasInFormula,
  UITypes,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk';
import { pluralize, singularize } from 'inflection';
import hash from 'object-hash';
import type SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import type { Base, LinkToAnotherRecordColumn } from '~/models';
import type {
  ColumnReqType,
  LinkToAnotherColumnReqType,
  LinkToAnotherRecordType,
  RelationTypes,
  UserType,
} from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type SqlClient from '~/db/sql-client/lib/SqlClient';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { NcRequest } from '~/interface/config';
import { CalendarRange } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import {
  createHmAndBtColumn,
  createOOColumn,
  generateFkName,
  randomID,
  sanitizeColumnName,
  validateLookupPayload,
  validatePayload,
  validateRequiredField,
  validateRollupPayload,
} from '~/helpers';
import { NcError } from '~/helpers/catchError';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';
import validateParams from '~/helpers/validateParams';
import {
  BaseUser,
  Column,
  FormulaColumn,
  KanbanView,
  Model,
  Source,
  View,
} from '~/models';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { MetaTable } from '~/utils/globals';
import { MetaService } from '~/meta/meta.service';

// todo: move
export enum Altered {
  NEW_COLUMN = 1,
  DELETE_COLUMN = 4,
  UPDATE_COLUMN = 8,
}

interface ReusableParams {
  table?: Model;
  source?: Source;
  base?: Base;
  dbDriver?: CustomKnex;
  sqlClient?: SqlClient;
  sqlMgr?: SqlMgrv2;
  baseModel?: BaseModelSqlv2;
}

async function reuseOrSave(
  tp: keyof ReusableParams,
  params: ReusableParams,
  get: () => Promise<any>,
) {
  if (params[tp]) {
    return params[tp];
  }

  const res = await get();

  params[tp] = res;

  return res;
}

@Injectable()
export class ColumnsService {
  constructor(
    protected readonly metaService: MetaService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  async updateFormulas(args: { oldColumn: any; colBody: any }) {
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
          await FormulaColumn.update(oldColumn.id, {
            formula_raw: new_formula_raw,
            parsed_tree: null,
          });
        }
      }
    }
  }

  async columnUpdate(param: {
    req?: any;
    columnId: string;
    column: ColumnReqType & { colOptions?: any };
    cookie?: any;
    user: UserType;
    reuse?: ReusableParams;
  }) {
    const reuse = param.reuse || {};

    const { cookie } = param;
    const column = await Column.get({ colId: param.columnId });

    const table = await reuseOrSave('table', reuse, async () =>
      Model.getWithInfo({
        id: column.fk_model_id,
      }),
    );

    const source = await reuseOrSave('source', reuse, async () =>
      Source.get(table.source_id),
    );

    const sqlClient = await reuseOrSave('sqlClient', reuse, async () =>
      NcConnectionMgrv2.getSqlClient(source),
    );

    const sqlClientType = sqlClient.knex.clientType();

    const mxColumnLength = Column.getMaxColumnNameLength(sqlClientType);

    if (!isVirtualCol(param.column)) {
      param.column.column_name = sanitizeColumnName(param.column.column_name);
    }

    // trim leading and trailing spaces from column title as knex trim them by default
    if (param.column.title) {
      param.column.title = param.column.title.trim();
    }

    if (param.column.column_name) {
      // - 5 is a buffer for suffix
      let colName = param.column.column_name.slice(0, mxColumnLength - 5);
      let suffix = 1;
      while (
        !(await Column.checkTitleAvailable({
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
      !isVirtualCol(param.column) &&
      param.column.column_name.length > mxColumnLength
    ) {
      NcError.badRequest(
        `Column name ${param.column.column_name} exceeds ${mxColumnLength} characters`,
      );
    }

    if (param.column.title && param.column.title.length > 255) {
      NcError.badRequest(
        `Column title ${param.column.title} exceeds 255 characters`,
      );
    }

    if (
      !isVirtualCol(param.column) &&
      !isCreatedOrLastModifiedTimeCol(param.column) &&
      !isCreatedOrLastModifiedByCol(param.column) &&
      !(await Column.checkTitleAvailable({
        column_name: param.column.column_name,
        fk_model_id: column.fk_model_id,
        exclude_id: param.columnId,
      }))
    ) {
      NcError.badRequest('Duplicate column name');
    }
    if (
      !(await Column.checkAliasAvailable({
        title: param.column.title,
        fk_model_id: column.fk_model_id,
        exclude_id: param.columnId,
      }))
    ) {
      NcError.badRequest('Duplicate column alias');
    }

    let colBody = { ...param.column } as Column & {
      formula?: string;
      formula_raw?: string;
      parsed_tree?: any;
    } & Partial<Pick<ColumnReqType, 'column_order'>>;

    if (
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
      ].includes(column.uidt)
    ) {
      if (column.uidt === colBody.uidt) {
        if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt)) {
          await Column.update(column.id, {
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
            clientOrSqlUi: source.type,
            getMeta: async (modelId) => {
              const model = await Model.get(modelId);
              await model.getColumns();
              return model;
            },
          });

          try {
            const baseModel = await reuseOrSave('baseModel', reuse, async () =>
              Model.getBaseModelSQL({
                id: table.id,
                dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
                  NcConnectionMgrv2.get(source),
                ),
              }),
            );
            await formulaQueryBuilderv2(
              baseModel,
              colBody.formula,
              null,
              table,
              null,
              {},
              null,
              true,
              colBody.parsed_tree,
            );
          } catch (e) {
            console.error(e);
            NcError.badRequest('Invalid Formula');
          }

          await Column.update(column.id, {
            // title: colBody.title,
            ...column,
            ...colBody,
          });
        } else {
          if (colBody.title !== column.title) {
            await Column.updateAlias(param.columnId, {
              title: colBody.title,
            });
          }
          if ('meta' in colBody && column.uidt === UITypes.Links) {
            await Column.updateMeta({
              colId: param.columnId,
              meta: colBody.meta,
            });
          }

          // handle reorder column for Links and LinkToAnotherRecord
          if (
            [UITypes.Links, UITypes.LinkToAnotherRecord].includes(
              column.uidt,
            ) &&
            colBody?.column_order &&
            colBody.column_order?.order &&
            colBody.column_order?.view_id
          ) {
            const viewColumn = (
              await View.getColumns(colBody.column_order.view_id)
            ).find((col) => col.fk_column_id === column.id);
            await View.updateColumn(
              colBody.column_order.view_id,
              viewColumn.id,
              {
                order: colBody.column_order.order,
              },
            );
          }
        }

        await this.updateRollupOrLookup(colBody, column);
      } else {
        NcError.notImplemented(`Updating ${colBody.uidt} => ${colBody.uidt}`);
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
      await Column.update(param.columnId, {
        ...column,
        title: colBody.title,
      });
    } else if (
      [UITypes.SingleSelect, UITypes.MultiSelect].includes(colBody.uidt)
    ) {
      colBody = await getColumnPropsFromUIDT(colBody, source);

      const baseModel = await reuseOrSave('baseModel', reuse, async () =>
        Model.getBaseModelSQL({
          id: table.id,
          dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
            NcConnectionMgrv2.get(source),
          ),
        }),
      );

      if (colBody.colOptions?.options) {
        const supportedDrivers = ['mysql', 'mysql2', 'pg', 'mssql', 'sqlite3'];
        const dbDriver = await reuseOrSave('dbDriver', reuse, async () =>
          NcConnectionMgrv2.get(source),
        );
        const driverType = dbDriver.clientType();

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
          } else if (driverType === 'mssql') {
            await sqlClient.raw(
              `UPDATE ?? SET ?? = LEFT(cast(?? as varchar(max)), CHARINDEX(',', ??) - 1) WHERE CHARINDEX(',', ??) > 0;`,
              [
                baseModel.getTnPath(table.table_name),
                column.column_name,
                column.column_name,
                column.column_name,
                column.column_name,
              ],
            );
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
        } else if (
          [
            UITypes.SingleLineText,
            UITypes.Email,
            UITypes.PhoneNumber,
            UITypes.URL,
          ].includes(column.uidt)
        ) {
          // Text to SingleSelect/MultiSelect
          const dbDriver = await reuseOrSave('dbDriver', reuse, async () =>
            NcConnectionMgrv2.get(source),
          );

          const baseModel = await reuseOrSave('baseModel', reuse, async () =>
            Model.getBaseModelSQL({
              id: table.id,
              dbDriver: dbDriver,
            }),
          );

          const data = await sqlClient.raw('SELECT DISTINCT ?? FROM ??', [
            column.column_name,
            baseModel.getTnPath(table.table_name),
          ]);

          if (data.length) {
            const existingOptions = colBody.colOptions.options.map(
              (el) => el.title,
            );
            const options = data.reduce((acc, el) => {
              if (el[column.column_name]) {
                const values = el[column.column_name].split(',');
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
          for (const option of column.colOptions.options.filter((oldOp) =>
            colBody.colOptions.options.find((newOp) => newOp.id === oldOp.id)
              ? false
              : true,
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
              if (driverType === 'mssql') {
                await sqlClient.raw(`UPDATE ?? SET ?? = NULL WHERE ?? LIKE ?`, [
                  baseModel.getTnPath(table.table_name),
                  column.column_name,
                  column.column_name,
                  option.title,
                ]);
              } else {
                await baseModel.bulkUpdateAll(
                  {
                    where: `(${column.title},eq,${option.title})`,
                    skipValidationAndHooks: true,
                  },
                  { [column.column_name]: null },
                  { cookie },
                );
              }
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
              } else if (driverType === 'mssql') {
                await sqlClient.raw(
                  `UPDATE ?? SET ?? = substring(replace(concat(',', ??, ','), concat(',', ?, ','), ','), 2, len(replace(concat(',', ??, ','), concat(',', ?, ','), ',')) - 2)`,
                  [
                    baseModel.getTnPath(table.table_name),
                    column.column_name,
                    column.column_name,
                    option.title,
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

        const interchange = [];

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
            if (old_titles.includes(newOp.title)) {
              const def_option = { ...newOp };
              let title_counter = 1;
              while (old_titles.includes(newOp.title)) {
                newOp.title = `${def_option.title}_${title_counter++}`;
              }
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
                    if (c.id === param.columnId) {
                      const res = {
                        ...c,
                        ...column,
                        cn: column.column_name,
                        cno: c.column_name,
                        dtxp: temp_dtxp,
                        altered: Altered.UPDATE_COLUMN,
                      };
                      return Promise.resolve(res);
                    } else {
                      (c as any).cn = c.column_name;
                    }
                    return Promise.resolve(c);
                  }),
                ),
              };

              const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
                ProjectMgrv2.getSqlMgr({
                  id: source.base_id,
                }),
              );
              await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

              await Column.update(param.columnId, {
                ...column,
              });
            }

            if (column.uidt === UITypes.SingleSelect) {
              if (driverType === 'mssql') {
                await sqlClient.raw(`UPDATE ?? SET ?? = ? WHERE ?? LIKE ?`, [
                  baseModel.getTnPath(table.table_name),
                  column.column_name,
                  newOp.title,
                  column.column_name,
                  option.title,
                ]);
              } else {
                await baseModel.bulkUpdateAll(
                  {
                    where: `(${column.title},eq,${option.title})`,
                    skipValidationAndHooks: true,
                  },
                  { [column.column_name]: newOp.title },
                  { cookie },
                );
              }
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
              } else if (driverType === 'mssql') {
                await sqlClient.raw(
                  `UPDATE ?? SET ?? = substring(replace(concat(',', ??, ','), concat(',', ?, ','), concat(',', ?, ',')), 2, len(replace(concat(',', ??, ','), concat(',', ?, ','), concat(',', ?, ','))) - 2)`,
                  [
                    baseModel.getTnPath(table.table_name),
                    column.column_name,
                    column.column_name,
                    option.title,
                    newOp.title,
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

        for (const ch of interchange) {
          const newOp = ch.def_option;
          if (column.uidt === UITypes.SingleSelect) {
            if (driverType === 'mssql') {
              await sqlClient.raw(`UPDATE ?? SET ?? = ? WHERE ?? LIKE ?`, [
                baseModel.getTnPath(table.table_name),
                column.column_name,
                newOp.title,
                column.column_name,
                ch.temp_title,
              ]);
            } else {
              await baseModel.bulkUpdateAll(
                {
                  where: `(${column.title},eq,${ch.temp_title})`,
                  skipValidationAndHooks: true,
                },
                { [column.column_name]: newOp.title },
                { cookie },
              );
            }
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
            } else if (driverType === 'mssql') {
              await sqlClient.raw(
                `UPDATE ?? SET ?? = substring(replace(concat(',', ??, ','), concat(',', ?, ','), concat(',', ?, ',')), 2, len(replace(concat(',', ??, ','), concat(',', ?, ','), concat(',', ?, ','))) - 2)`,
                [
                  baseModel.getTnPath(table.table_name),
                  column.column_name,
                  column.column_name,
                  ch.temp_title,
                  newOp.title,
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
      }

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
            if (c.id === param.columnId) {
              const res = {
                ...c,
                ...colBody,
                cn: colBody.column_name,
                cno: c.column_name,
                altered: Altered.UPDATE_COLUMN,
              };

              // update formula with new column name
              await this.updateFormulas({
                oldColumn: column,
                colBody,
              });
              return Promise.resolve(res);
            } else {
              (c as any).cn = c.column_name;
            }
            return Promise.resolve(c);
          }),
        ),
      };

      const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
        ProjectMgrv2.getSqlMgr({ id: source.base_id }),
      );
      await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

      await Column.update(param.columnId, {
        ...colBody,
      });
    } else if (colBody.uidt === UITypes.User) {
      // handle default value for user column
      if (colBody.cdf) {
        const baseUsers = await BaseUser.getUsersList({
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
            Model.getBaseModelSQL({
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
          } else if (driverType === 'mssql') {
            await sqlClient.raw(
              `UPDATE ?? SET ?? = LEFT(cast(?? as varchar(max)), CHARINDEX(',', ??) - 1) WHERE CHARINDEX(',', ??) > 0;`,
              [
                baseModel.getTnPath(table.table_name),
                column.column_name,
                column.column_name,
                column.column_name,
                column.column_name,
              ],
            );
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
              if (c.id === param.columnId) {
                const res = {
                  ...c,
                  ...colBody,
                  cn: colBody.column_name,
                  cno: c.column_name,
                  altered: Altered.UPDATE_COLUMN,
                };

                // update formula with new column name
                await this.updateFormulas({
                  oldColumn: column,
                  colBody,
                });
                return Promise.resolve(res);
              } else {
                (c as any).cn = c.column_name;
              }
              return Promise.resolve(c);
            }),
          ),
        };

        const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
          ProjectMgrv2.getSqlMgr({ id: source.base_id }),
        );
        await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

        await Column.update(param.columnId, {
          ...colBody,
        });
      } else if (
        [UITypes.SingleLineText, UITypes.Email].includes(column.uidt)
      ) {
        // email/text to user
        const baseModel = await reuseOrSave('baseModel', reuse, async () =>
          Model.getBaseModelSQL({
            id: table.id,
            dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
              NcConnectionMgrv2.get(source),
            ),
          }),
        );

        const baseUsers = await BaseUser.getUsersList({
          base_id: column.base_id,
        });

        try {
          const data = await baseModel.execAndParse(
            sqlClient.knex
              .raw('SELECT DISTINCT ?? FROM ??', [
                column.column_name,
                baseModel.getTnPath(table.table_name),
              ])
              .toQuery(),
          );

          let isMultiple = false;

          const rows = data.map((el) => el[column.column_name]);
          const emails = rows
            .map((el) => {
              const res = el.split(',').map((e) => e.trim());
              if (res.length > 1) {
                isMultiple = true;
              }
              return res;
            })
            .flat();

          // check if emails are present baseUsers
          const emailsNotPresent = emails.filter((el) => {
            return !baseUsers.find((user) => user.email === el);
          });

          if (emailsNotPresent.length) {
            NcError.badRequest(
              `Some of the emails are not present in the database.`,
            );
          }

          if (isMultiple) {
            colBody.meta = {
              is_multi: true,
            };
          }
        } catch (e) {
          NcError.badRequest('Some of the emails are present in the database.');
        }

        // create nested replace statement for each user
        const setStatement = baseUsers.reduce((acc, user) => {
          const qb = sqlClient.knex.raw(`REPLACE(${acc}, ?, ?)`, [
            user.email,
            user.id,
          ]);
          return qb.toQuery();
        }, sqlClient.knex.raw(`??`, [column.column_name]).toQuery());

        await sqlClient.raw(`UPDATE ?? SET ?? = ${setStatement};`, [
          baseModel.getTnPath(table.table_name),
          column.column_name,
        ]);

        colBody = await getColumnPropsFromUIDT(colBody, source);
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
              if (c.id === param.columnId) {
                const res = {
                  ...c,
                  ...colBody,
                  cn: colBody.column_name,
                  cno: c.column_name,
                  altered: Altered.UPDATE_COLUMN,
                };

                // update formula with new column name
                await this.updateFormulas({
                  oldColumn: column,
                  colBody,
                });
                return Promise.resolve(res);
              } else {
                (c as any).cn = c.column_name;
              }
              return Promise.resolve(c);
            }),
          ),
        };

        const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
          ProjectMgrv2.getSqlMgr({ id: source.base_id }),
        );
        await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

        await Column.update(param.columnId, {
          ...colBody,
        });
      } else {
        NcError.notImplemented(`Updating ${column.uidt} => ${colBody.uidt}`);
      }
    } else if (column.uidt === UITypes.User) {
      if ([UITypes.SingleLineText, UITypes.Email].includes(colBody.uidt)) {
        // user to email/text
        const baseModel = await reuseOrSave('baseModel', reuse, async () =>
          Model.getBaseModelSQL({
            id: table.id,
            dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
              NcConnectionMgrv2.get(source),
            ),
          }),
        );

        const baseUsers = await BaseUser.getUsersList({
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

        colBody = await getColumnPropsFromUIDT(colBody, source);
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
              if (c.id === param.columnId) {
                const res = {
                  ...c,
                  ...colBody,
                  cn: colBody.column_name,
                  cno: c.column_name,
                  altered: Altered.UPDATE_COLUMN,
                };

                // update formula with new column name
                await this.updateFormulas({
                  oldColumn: column,
                  colBody,
                });
                return Promise.resolve(res);
              } else {
                (c as any).cn = c.column_name;
              }
              return Promise.resolve(c);
            }),
          ),
        };

        const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
          ProjectMgrv2.getSqlMgr({ id: source.base_id }),
        );
        await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

        await Column.update(param.columnId, {
          ...colBody,
        });
      } else {
        NcError.notImplemented(`Updating ${column.uidt} => ${colBody.uidt}`);
      }
    } else {
      colBody = await getColumnPropsFromUIDT(colBody, source);
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
            if (c.id === param.columnId) {
              const res = {
                ...c,
                ...colBody,
                cn: colBody.column_name,
                cno: c.column_name,
                altered: Altered.UPDATE_COLUMN,
              };

              // update formula with new column name
              await this.updateFormulas({
                oldColumn: column,
                colBody,
              });
              return Promise.resolve(res);
            } else {
              (c as any).cn = c.column_name;
            }
            return Promise.resolve(c);
          }),
        ),
      };

      const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
        ProjectMgrv2.getSqlMgr({ id: source.base_id }),
      );
      await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

      await Column.update(param.columnId, {
        ...colBody,
      });
    }

    await table.getColumns();

    this.appHooksService.emit(AppEvents.COLUMN_UPDATE, {
      table,
      column,
      user: param.req?.user,
      ip: param.req?.clientIp,
      req: param.req,
    });

    return table;
  }

  async columnGet(param: { columnId: string }) {
    return Column.get({ colId: param.columnId });
  }

  async columnSetAsPrimary(param: { columnId: string }) {
    const column = await Column.get({ colId: param.columnId });
    return Model.updatePrimaryColumn(column.fk_model_id, column.id);
  }

  async columnAdd(param: {
    req: NcRequest;
    tableId: string;
    column: ColumnReqType;
    user: UserType;
    reuse?: ReusableParams;
  }) {
    validatePayload('swagger.json#/components/schemas/ColumnReq', param.column);

    const reuse = param.reuse || {};

    const table = await reuseOrSave('table', reuse, async () =>
      Model.getWithInfo({
        id: param.tableId,
      }),
    );

    const source = await reuseOrSave('source', reuse, async () =>
      Source.get(table.source_id),
    );

    const base = await reuseOrSave('base', reuse, async () =>
      source.getProject(),
    );

    if (param.column.title || param.column.column_name) {
      const dbDriver = await reuseOrSave('dbDriver', reuse, async () =>
        NcConnectionMgrv2.get(source),
      );

      const sqlClientType = dbDriver.clientType();

      const mxColumnLength = Column.getMaxColumnNameLength(sqlClientType);

      if (!isVirtualCol(param.column)) {
        param.column.column_name = sanitizeColumnName(param.column.column_name);
      }

      // trim leading and trailing spaces from column title as knex trim them by default
      if (param.column.title) {
        param.column.title = param.column.title.trim();
      }

      if (param.column.column_name) {
        // - 5 is a buffer for suffix
        let colName = param.column.column_name.slice(0, mxColumnLength - 5);
        let suffix = 1;
        while (
          !(await Column.checkTitleAvailable({
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
        NcError.badRequest(
          `Column name ${param.column.column_name} exceeds ${mxColumnLength} characters`,
        );
      }

      if (param.column.title && param.column.title.length > 255) {
        NcError.badRequest(
          `Column title ${param.column.title} exceeds 255 characters`,
        );
      }
    }

    if (
      !isVirtualCol(param.column) &&
      !(await Column.checkTitleAvailable({
        column_name: param.column.column_name,
        fk_model_id: param.tableId,
      }))
    ) {
      NcError.badRequest('Duplicate column name');
    }
    if (
      !(await Column.checkAliasAvailable({
        title: param.column.title || param.column.column_name,
        fk_model_id: param.tableId,
      }))
    ) {
      NcError.badRequest('Duplicate column alias');
    }

    let colBody: any = param.column;

    const colExtra = {
      view_id: colBody.view_id,
      column_order: colBody.column_order,
    };

    switch (colBody.uidt) {
      case UITypes.Rollup:
        {
          await validateRollupPayload(param.column);

          await Column.insert({
            ...colBody,
            fk_model_id: table.id,
          });
        }
        break;
      case UITypes.Lookup:
        {
          await validateLookupPayload(param.column);

          await Column.insert({
            ...colBody,
            fk_model_id: table.id,
          });
        }
        break;

      case UITypes.Links:
      case UITypes.LinkToAnotherRecord:
        await this.createLTARColumn({
          ...param,
          source,
          base,
          reuse,
          colExtra,
        });

        this.appHooksService.emit(AppEvents.RELATION_CREATE, {
          column: {
            ...colBody,
            fk_model_id: param.tableId,
            base_id: base.id,
            source_id: source.id,
          },
          req: param.req,
        });
        break;

      case UITypes.QrCode:
        await Column.insert({
          ...colBody,
          fk_model_id: table.id,
        });
        break;
      case UITypes.Barcode:
        await Column.insert({
          ...colBody,
          fk_model_id: table.id,
        });
        break;
      case UITypes.Formula:
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
          clientOrSqlUi: source.type,
          getMeta: async (modelId) => {
            const model = await Model.get(modelId);
            await model.getColumns();
            return model;
          },
        });

        try {
          const baseModel = await reuseOrSave('baseModel', reuse, async () =>
            Model.getBaseModelSQL({
              id: table.id,
              dbDriver: await reuseOrSave('dbDriver', reuse, async () =>
                NcConnectionMgrv2.get(source),
              ),
            }),
          );
          await formulaQueryBuilderv2(
            baseModel,
            colBody.formula,
            null,
            table,
            null,
            {},
            null,
            true,
          );
        } catch (e) {
          console.error(e);
          NcError.badRequest('Invalid Formula');
        }

        await Column.insert({
          ...colBody,
          fk_model_id: table.id,
        });

        break;
      case UITypes.CreatedTime:
      case UITypes.LastModifiedTime:
      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy:
        {
          let columnName: string;
          const columns = await table.getColumns();
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
                ProjectMgrv2.getSqlMgr({ id: source.base_id }),
              );
              await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
            }

            const title = getUniqueColumnAliasName(table.columns, columnTitle);

            await Column.insert({
              ...colBody,
              title,
              system: 1,
              fk_model_id: table.id,
              column_name: columnName,
            });
          } else {
            columnName = existingColumn.column_name;
          }
          await Column.insert({
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
          }

          if (colBody.uidt === UITypes.User) {
            // handle default value for user column
            if (colBody.cdf) {
              const baseUsers = await BaseUser.getUsersList({
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
            ProjectMgrv2.getSqlMgr({ id: source.base_id }),
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

          await Column.insert({
            ...colBody,
            fk_model_id: table.id,
          });
        }
        break;
    }

    await table.getColumns();

    this.appHooksService.emit(AppEvents.COLUMN_CREATE, {
      table,
      column: {
        ...colBody,
        fk_model_id: table.id,
      },
      user: param.req?.user,
      ip: param.req?.clientIp,
      req: param.req,
    });

    return table;
  }

  async columnDelete(
    param: {
      req?: any;
      columnId: string;
      user: UserType;
      forceDeleteSystem?: boolean;
      reuse?: ReusableParams;
    },
    ncMeta = this.metaService,
  ) {
    const reuse = param.reuse || {};

    const column = await Column.get({ colId: param.columnId }, ncMeta);

    if (column.system && !param.forceDeleteSystem) {
      NcError.badRequest(
        `The column '${
          column.title || column.column_name
        }' is a system column and cannot be deleted.`,
      );
    }

    const table = await reuseOrSave('table', reuse, async () =>
      Model.getWithInfo(
        {
          id: column.fk_model_id,
        },
        ncMeta,
      ),
    );
    const source = await reuseOrSave('source', reuse, async () =>
      Source.get(table.source_id, false, ncMeta),
    );

    const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
      ProjectMgrv2.getSqlMgr({ id: source.base_id }, ncMeta),
    );

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
      case UITypes.Formula:
        await Column.delete(param.columnId, ncMeta);
        break;
      // on deleting created/last modified columns, keep the column in table and delete the column from meta
      case UITypes.CreatedTime:
      case UITypes.LastModifiedTime:
      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy: {
        await Column.delete(param.columnId, ncMeta);
        break;
      }
      // Since Links is just an extended version of LTAR, we can use the same logic
      case UITypes.Links:
      case UITypes.LinkToAnotherRecord:
        {
          const relationColOpt =
            await column.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
          const childColumn = await relationColOpt.getChildColumn(ncMeta);
          const childTable = await childColumn.getModel(ncMeta);

          const parentColumn = await relationColOpt.getParentColumn(ncMeta);
          const parentTable = await parentColumn.getModel(ncMeta);

          switch (relationColOpt.type) {
            case 'bt':
            case 'hm':
              {
                await this.deleteHmOrBtRelation({
                  relationColOpt,
                  source,
                  childColumn,
                  childTable,
                  parentColumn,
                  parentTable,
                  sqlMgr,
                  ncMeta,
                });
              }
              break;
            case 'oo':
              {
                await this.deleteOoRelation({
                  relationColOpt,
                  source,
                  childColumn,
                  childTable,
                  parentColumn,
                  parentTable,
                  sqlMgr,
                  ncMeta,
                });
              }
              break;
            case 'mm':
              {
                const mmTable = await relationColOpt.getMMModel(ncMeta);
                const mmParentCol = await relationColOpt.getMMParentColumn(
                  ncMeta,
                );
                const mmChildCol = await relationColOpt.getMMChildColumn(
                  ncMeta,
                );

                await this.deleteHmOrBtRelation(
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
                  },
                  true,
                );

                await this.deleteHmOrBtRelation(
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
                  },
                  true,
                );
                const columnsInRelatedTable: Column[] = await relationColOpt
                  .getRelatedTable(ncMeta)
                  .then((m) => m.getColumns(ncMeta));

                for (const c of columnsInRelatedTable) {
                  if (!isLinksOrLTAR(c.uidt)) continue;
                  const colOpt =
                    await c.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
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
                    await Column.delete(c.id, ncMeta);
                    break;
                  }
                }

                await Column.delete(relationColOpt.fk_column_id, ncMeta);

                if (mmTable) {
                  // delete bt columns in m2m table
                  await mmTable.getColumns(ncMeta);
                  for (const c of mmTable.columns) {
                    if (!isLinksOrLTAR(c.uidt)) continue;
                    const colOpt =
                      await c.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
                    if (colOpt.type === 'bt') {
                      await Column.delete(c.id, ncMeta);
                    }
                  }
                }

                // delete hm columns in parent table
                await parentTable.getColumns(ncMeta);
                for (const c of parentTable.columns) {
                  if (!isLinksOrLTAR(c.uidt)) continue;
                  const colOpt =
                    await c.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
                  if (
                    colOpt.fk_related_model_id === relationColOpt.fk_mm_model_id
                  ) {
                    await Column.delete(c.id, ncMeta);
                  }
                }

                // delete hm columns in child table
                await childTable.getColumns(ncMeta);
                for (const c of childTable.columns) {
                  if (!isLinksOrLTAR(c.uidt)) continue;
                  const colOpt =
                    await c.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
                  if (
                    colOpt.fk_related_model_id === relationColOpt.fk_mm_model_id
                  ) {
                    await Column.delete(c.id, ncMeta);
                  }
                }

                if (mmTable) {
                  // retrieve columns in m2m table again
                  await mmTable.getColumns(ncMeta);

                  // ignore deleting table if it has more than 2 columns
                  // the expected 2 columns would be table1_id & table2_id
                  if (mmTable.columns.length === 2) {
                    (mmTable as any).tn = mmTable.table_name;
                    await sqlMgr.sqlOpPlus(source, 'tableDelete', mmTable);
                    await mmTable.delete(ncMeta);
                  }
                }
              }
              break;
          }
        }
        this.appHooksService.emit(AppEvents.RELATION_DELETE, {
          column,
          req: param.req,
        });
        break;
      case UITypes.ForeignKey: {
        NcError.notImplemented(`Support for ${column.uidt}`);
        break;
      }
      case UITypes.SingleSelect: {
        if (await KanbanView.IsColumnBeingUsedAsGroupingField(column.id)) {
          NcError.badRequest(
            `The column '${column.column_name}' is being used in Kanban View. Please delete Kanban View first.`,
          );
        }
        /* falls through to default */
      }
      case UITypes.DateTime:
      case UITypes.Date: {
        if (
          [UITypes.DateTime, UITypes.Date].includes(column.uidt) &&
          (await CalendarRange.IsColumnBeingUsedAsRange(column.id, ncMeta))
        ) {
          NcError.badRequest(
            `The column '${column.column_name}' is being used in Calendar View. Please delete Calendar View first.`,
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

        await Column.delete(param.columnId, ncMeta);
      }
    }
    await table.getColumns(ncMeta);

    const displayValueColumn = mapDefaultDisplayValue(table.columns);
    if (displayValueColumn) {
      await Model.updatePrimaryColumn(
        displayValueColumn.fk_model_id,
        displayValueColumn.id,
        ncMeta,
      );
    }

    this.appHooksService.emit(AppEvents.COLUMN_DELETE, {
      table,
      column,
      user: param.req?.user,
      ip: param.req?.clientIp,
      req: param.req,
    });

    return table;
  }

  deleteHmOrBtRelation = async (
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
    },
    ignoreFkDelete = false,
  ) => {
    if (childTable) {
      let foreignKeyName;

      // if relationColOpt is not provided, extract it from child table
      // and get the foreign key name for dropping the foreign key
      if (!relationColOpt) {
        foreignKeyName = (
          (
            await childTable.getColumns(ncMeta).then(async (cols) => {
              for (const col of cols) {
                if (col.uidt === UITypes.LinkToAnotherRecord) {
                  const colOptions =
                    await col.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
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
          await sqlMgr.sqlOpPlus(source, 'relationDelete', {
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
    const columnsInRelatedTable: Column[] = await relationColOpt
      .getRelatedTable(ncMeta)
      .then((m) => m.getColumns(ncMeta));
    const relType = relationColOpt.type === 'bt' ? 'hm' : 'bt';
    for (const c of columnsInRelatedTable) {
      if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
      const colOpt = await c.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
      if (
        colOpt.fk_parent_column_id === parentColumn.id &&
        colOpt.fk_child_column_id === childColumn.id &&
        colOpt.type === relType
      ) {
        await Column.delete(c.id, ncMeta);
        break;
      }
    }

    // delete virtual columns
    await Column.delete(relationColOpt.fk_column_id, ncMeta);

    if (!ignoreFkDelete) {
      const cTable = await Model.getWithInfo(
        {
          id: childTable.id,
        },
        ncMeta,
      );

      // if virtual column delete all index before deleting the column
      if (relationColOpt?.virtual) {
        const indexes =
          (
            await sqlMgr.sqlOp(source, 'indexList', {
              tn: cTable.table_name,
            })
          )?.data?.list ?? [];

        for (const index of indexes) {
          if (index.cn !== childColumn.column_name) continue;

          await sqlMgr.sqlOpPlus(source, 'indexDelete', {
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

      await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
    }
    // delete foreign key column
    await Column.delete(childColumn.id, ncMeta);
  };

  deleteOoRelation = async (
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
    },
    ignoreFkDelete = false,
  ) => {
    if (childTable) {
      let foreignKeyName;

      // if relationColOpt is not provided, extract it from child table
      // and get the foreign key name for dropping the foreign key
      if (!relationColOpt) {
        foreignKeyName = (
          (
            await childTable.getColumns(ncMeta).then(async (cols) => {
              for (const col of cols) {
                if (col.uidt === UITypes.LinkToAnotherRecord) {
                  const colOptions =
                    await col.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
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
          await sqlMgr.sqlOpPlus(source, 'relationDelete', {
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
    const columnsInRelatedTable: Column[] = await relationColOpt
      .getRelatedTable(ncMeta)
      .then((m) => m.getColumns(ncMeta));
    const relType = relationColOpt.type === 'bt' ? 'hm' : 'bt';
    for (const c of columnsInRelatedTable) {
      if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
      const colOpt = await c.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
      if (
        colOpt.fk_parent_column_id === parentColumn.id &&
        colOpt.fk_child_column_id === childColumn.id &&
        colOpt.type === relType
      ) {
        await Column.delete(c.id, ncMeta);
        break;
      }
    }

    // delete virtual columns
    await Column.delete(relationColOpt.fk_column_id, ncMeta);

    if (!ignoreFkDelete) {
      const cTable = await Model.getWithInfo(
        {
          id: childTable.id,
        },
        ncMeta,
      );

      // if virtual column delete all index before deleting the column
      if (relationColOpt?.virtual) {
        const indexes =
          (
            await sqlMgr.sqlOp(source, 'indexList', {
              tn: cTable.table_name,
            })
          )?.data?.list ?? [];

        for (const index of indexes) {
          if (index.cn !== childColumn.column_name) continue;

          await sqlMgr.sqlOpPlus(source, 'indexDelete', {
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

      await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
    }
    // delete foreign key column
    await Column.delete(childColumn.id, ncMeta);
  };

  async createLTARColumn(param: {
    tableId: string;
    column: ColumnReqType;
    source: Source;
    base: Base;
    reuse?: ReusableParams;
    colExtra?: any;
  }) {
    validateParams(['parentId', 'childId', 'type'], param.column);

    const reuse = param.reuse ?? {};

    // get parent and child models
    const parent = await Model.getWithInfo({
      id: (param.column as LinkToAnotherColumnReqType).parentId,
    });
    const child = await Model.getWithInfo({
      id: (param.column as LinkToAnotherColumnReqType).childId,
    });
    let childColumn: Column;

    const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
      ProjectMgrv2.getSqlMgr({
        id: param.source.base_id,
      }),
    );
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
        await child.getColumns(),
        `${parent.table_name}_id`,
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
          dt: parent.primaryKey.dt,
          dtxp: parent.primaryKey.dtxp,
          dtxs: parent.primaryKey.dtxs,
          un: parent.primaryKey.un,
          altered: Altered.NEW_COLUMN,
        };
        const tableUpdateBody = {
          ...child,
          tn: child.table_name,
          originalColumns: child.columns.map((c) => ({
            ...c,
            cn: c.column_name,
          })),
          columns: [
            ...child.columns.map((c) => ({
              ...c,
              cn: c.column_name,
            })),
            newColumn,
          ],
        };

        await sqlMgr.sqlOpPlus(param.source, 'tableUpdate', tableUpdateBody);

        const { id } = await Column.insert({
          ...newColumn,
          uidt: UITypes.ForeignKey,
          fk_model_id: child.id,
        });

        childColumn = await Column.get({ colId: id });

        // ignore relation creation if virtual
        if (!(param.column as LinkToAnotherColumnReqType).virtual) {
          foreignKeyName = generateFkName(parent, child);
          // create relation
          await sqlMgr.sqlOpPlus(param.source, 'relationCreate', {
            childColumn: fkColName,
            childTable: child.table_name,
            parentTable: parent.table_name,
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
            type: 'real',
            parentColumn: parent.primaryKey.column_name,
            foreignKeyName,
          });
        }

        // todo: create index for virtual relations as well
        //       create index for foreign key in pg
        if (
          param.source.type === 'pg' ||
          (param.column as LinkToAnotherColumnReqType).virtual
        ) {
          await this.createColumnIndex({
            column: new Column({
              ...newColumn,
              fk_model_id: child.id,
            }),
            source: param.source,
            sqlMgr,
          });
        }
      }
      await createHmAndBtColumn(
        child,
        parent,
        childColumn,
        (param.column as LinkToAnotherColumnReqType).type as RelationTypes,
        (param.column as LinkToAnotherColumnReqType).title,
        foreignKeyName,
        (param.column as LinkToAnotherColumnReqType).virtual,
        null,
        param.column['meta'],
        isLinks,
        param.colExtra,
      );
    } else if ((param.column as LinkToAnotherColumnReqType).type === 'oo') {
      // populate fk column name
      const fkColName = getUniqueColumnName(
        await child.getColumns(),
        `${parent.table_name}_id`,
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
          dt: parent.primaryKey.dt,
          dtxp: parent.primaryKey.dtxp,
          dtxs: parent.primaryKey.dtxs,
          un: parent.primaryKey.un,
          altered: Altered.NEW_COLUMN,
          unique: 1, // Ensure the foreign key column is unique for one-to-one relationships
        };

        const tableUpdateBody = {
          ...child,
          tn: child.table_name,
          originalColumns: child.columns.map((c) => ({
            ...c,
            cn: c.column_name,
          })),
          columns: [
            ...child.columns.map((c) => ({
              ...c,
              cn: c.column_name,
            })),
            newColumn,
          ],
        };

        await sqlMgr.sqlOpPlus(param.source, 'tableUpdate', tableUpdateBody);

        const { id } = await Column.insert({
          ...newColumn,
          uidt: UITypes.ForeignKey,
          fk_model_id: child.id,
        });

        childColumn = await Column.get({ colId: id });

        // ignore relation creation if virtual
        if (!(param.column as LinkToAnotherColumnReqType).virtual) {
          foreignKeyName = generateFkName(parent, child);
          // create relation
          await sqlMgr.sqlOpPlus(param.source, 'relationCreate', {
            childColumn: fkColName,
            childTable: child.table_name,
            parentTable: parent.table_name,
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
            type: 'real',
            parentColumn: parent.primaryKey.column_name,
            foreignKeyName,
          });
        }

        // todo: create index for virtual relations as well
        //       create index for foreign key in pg
        if (
          param.source.type === 'pg' ||
          (param.column as LinkToAnotherColumnReqType).virtual
        ) {
          await this.createColumnIndex({
            column: new Column({
              ...newColumn,
              fk_model_id: child.id,
            }),
            source: param.source,
            sqlMgr,
          });
        }
      }
      await createOOColumn(
        child,
        parent,
        childColumn,
        (param.column as LinkToAnotherColumnReqType).type as RelationTypes,
        (param.column as LinkToAnotherColumnReqType).title,
        foreignKeyName,
        (param.column as LinkToAnotherColumnReqType).virtual,
        null,
        param.column['meta'],
        param.colExtra,
      );
    } else if ((param.column as LinkToAnotherColumnReqType).type === 'mm') {
      const aTn = `${param.base?.prefix ?? ''}_nc_m2m_${randomID()}`;
      const aTnAlias = aTn;

      const parentPK = parent.primaryKey;
      const childPK = child.primaryKey;

      const associateTableCols = [];

      const parentCn = 'table1_id';
      const childCn = 'table2_id';

      associateTableCols.push(
        {
          cn: childCn,
          column_name: childCn,
          title: childCn,
          rqd: true,
          pk: true,
          ai: false,
          cdf: null,
          dt: childPK.dt,
          dtxp: childPK.dtxp,
          dtxs: childPK.dtxs,
          un: childPK.un,
          altered: 1,
          uidt: UITypes.ForeignKey,
        },
        {
          cn: parentCn,
          column_name: parentCn,
          title: parentCn,
          rqd: true,
          pk: true,
          ai: false,
          cdf: null,
          dt: parentPK.dt,
          dtxp: parentPK.dtxp,
          dtxs: parentPK.dtxs,
          un: parentPK.un,
          altered: 1,
          uidt: UITypes.ForeignKey,
        },
      );

      await sqlMgr.sqlOpPlus(param.source, 'tableCreate', {
        tn: aTn,
        _tn: aTnAlias,
        columns: associateTableCols,
      });

      const assocModel = await Model.insert(param.base.id, param.source.id, {
        table_name: aTn,
        title: aTnAlias,
        // todo: sanitize
        mm: true,
        columns: associateTableCols,
      });

      let foreignKeyName1;
      let foreignKeyName2;

      if (!(param.column as LinkToAnotherColumnReqType).virtual) {
        foreignKeyName1 = generateFkName(parent, child);
        foreignKeyName2 = generateFkName(parent, child);

        const rel1Args = {
          ...param.column,
          childTable: aTn,
          childColumn: parentCn,
          parentTable: parent.table_name,
          parentColumn: parentPK.column_name,
          type: 'real',
          foreignKeyName: foreignKeyName1,
        };
        const rel2Args = {
          ...param.column,
          childTable: aTn,
          childColumn: childCn,
          parentTable: child.table_name,
          parentColumn: childPK.column_name,
          type: 'real',
          foreignKeyName: foreignKeyName2,
        };

        await sqlMgr.sqlOpPlus(param.source, 'relationCreate', rel1Args);
        await sqlMgr.sqlOpPlus(param.source, 'relationCreate', rel2Args);
      }
      const parentCol = (await assocModel.getColumns())?.find(
        (c) => c.column_name === parentCn,
      );
      const childCol = (await assocModel.getColumns())?.find(
        (c) => c.column_name === childCn,
      );

      await createHmAndBtColumn(
        assocModel,
        child,
        childCol,
        null,
        null,
        foreignKeyName1,
        (param.column as LinkToAnotherColumnReqType).virtual,
        true,
        null,
        false,
        param.colExtra,
      );
      await createHmAndBtColumn(
        assocModel,
        parent,
        parentCol,
        null,
        null,
        foreignKeyName2,
        (param.column as LinkToAnotherColumnReqType).virtual,
        true,
        null,
        false,
        param.colExtra,
      );

      await Column.insert({
        title: getUniqueColumnAliasName(
          await child.getColumns(),
          pluralize(parent.title),
        ),
        uidt: isLinks ? UITypes.Links : UITypes.LinkToAnotherRecord,
        type: 'mm',

        // ref_db_alias
        fk_model_id: child.id,
        // db_type:

        fk_child_column_id: childPK.id,
        fk_parent_column_id: parentPK.id,

        fk_mm_model_id: assocModel.id,
        fk_mm_child_column_id: childCol.id,
        fk_mm_parent_column_id: parentCol.id,
        fk_related_model_id: parent.id,
        virtual: (param.column as LinkToAnotherColumnReqType).virtual,
        meta: {
          plural: pluralize(parent.title),
          singular: singularize(parent.title),
        },
        // if self referencing treat it as system field to hide from ui
        system: parent.id === child.id,
      });
      await Column.insert({
        title: getUniqueColumnAliasName(
          await parent.getColumns(),
          param.column.title ?? pluralize(child.title),
        ),

        uidt: isLinks ? UITypes.Links : UITypes.LinkToAnotherRecord,
        type: 'mm',

        fk_model_id: parent.id,

        fk_child_column_id: parentPK.id,
        fk_parent_column_id: childPK.id,

        fk_mm_model_id: assocModel.id,
        fk_mm_child_column_id: parentCol.id,
        fk_mm_parent_column_id: childCol.id,
        fk_related_model_id: child.id,
        virtual: (param.column as LinkToAnotherColumnReqType).virtual,
        meta: {
          plural: param.column['meta']?.plural || pluralize(child.title),
          singular: param.column['meta']?.singular || singularize(child.title),
        },

        // column_order and view_id if provided
        ...param.colExtra,
      });

      // todo: create index for virtual relations as well
      // create index for foreign key in pg
      if (param.source.type === 'pg') {
        await this.createColumnIndex({
          column: new Column({
            ...associateTableCols[0],
            fk_model_id: assocModel.id,
          }),
          source: param.source,
          sqlMgr,
        });
        await this.createColumnIndex({
          column: new Column({
            ...associateTableCols[1],
            fk_model_id: assocModel.id,
          }),
          source: param.source,
          sqlMgr,
        });
      }
    }
  }

  async createColumnIndex({
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
  }) {
    // TODO: implement for snowflake (right now create index does not work with identifier quoting in snowflake - bug?)
    if (source.type === 'snowflake') return;
    const model = await column.getModel();
    const indexArgs = {
      columns: [column.column_name],
      tn: model.table_name,
      non_unique: nonUnique,
      indexName,
    };
    await sqlMgr.sqlOpPlus(source, 'indexCreate', indexArgs);
  }

  async updateRollupOrLookup(colBody: any, column: Column<any>) {
    // Validate rollup or lookup payload before proceeding with the update
    if (
      UITypes.Lookup === column.uidt &&
      validateRequiredField(colBody, [
        'fk_lookup_column_id',
        'fk_relation_column_id',
      ])
    ) {
      // Perform additional validation for lookup payload
      await validateLookupPayload(colBody, column.id);
      await Column.update(column.id, colBody);
    } else if (
      UITypes.Rollup === column.uidt &&
      validateRequiredField(colBody, [
        'fk_relation_column_id',
        'fk_rollup_column_id',
        'rollup_function',
      ])
    ) {
      // Perform additional validation for rollup payload
      await validateRollupPayload(colBody);
      await Column.update(column.id, colBody);
    }
  }

  async columnsHash(tableId: string) {
    const table = await Model.getWithInfo({
      id: tableId,
    });

    if (!table) {
      NcError.tableNotFound(tableId);
    }

    const columns = await table.getColumns();

    return {
      hash: hash(columns),
    };
  }

  async columnBulk(
    tableId: string,
    params: {
      hash: string;
      ops: {
        op: 'add' | 'update' | 'delete';
        column: Partial<Column>;
      }[];
    },
    req: NcRequest,
  ) {
    // TODO validatePayload

    const table = await Model.getWithInfo({
      id: tableId,
    });

    if (!table) {
      NcError.tableNotFound(tableId);
    }

    const columns = await table.getColumns();

    if (hash(columns) !== params.hash) {
      NcError.badRequest(
        'Columns are updated by someone else! Your changes are rejected. Please refresh the page and try again.',
      );
    }

    const source = await Source.get(table.source_id);

    if (!source) {
      NcError.sourceNotFound(table.source_id);
    }

    const base = await source.getProject();

    if (!base) {
      NcError.baseNotFound(source.base_id);
    }

    const dbDriver = await NcConnectionMgrv2.get(source);
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
    const sqlMgr = await ProjectMgrv2.getSqlMgr({ id: source.base_id });
    const baseModel = await Model.getBaseModelSQL({
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
          await this.columnAdd({
            tableId,
            column: column as ColumnReqType,
            req,
            user: req.user,
            reuse,
          });
        } catch (e) {
          failedOps.push({
            ...op,
            error: e.message,
          });
        }
      } else if (op.op === 'update') {
        try {
          await this.columnUpdate({
            columnId: op.column.id,
            column: column as ColumnReqType,
            req,
            user: req.user,
            reuse,
          });
        } catch (e) {
          failedOps.push({
            ...op,
            error: e.message,
          });
        }
      } else if (op.op === 'delete') {
        try {
          await this.columnDelete({
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
}
