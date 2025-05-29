import { ButtonActionsType, UITypes } from 'nocodb-sdk';
import genRollupSelectv2 from '../genRollupSelectv2';
import type { Knex } from 'knex';
import type {
  BarcodeColumn,
  ButtonColumn,
  GridViewColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Logger } from '@nestjs/common';
import { Column, View } from '~/models';
import {
  checkColumnRequired,
  getAs,
  getColumnName,
  shouldSkipField,
} from '~/helpers/dbHelpers';
import { sanitize } from '~/helpers/sqlSanitize';

export const selectObject = (baseModel: IBaseModelSqlV2, logger: Logger) => {
  return async ({
    qb,
    columns: _columns,
    fields: _fields,
    extractPkAndPv,
    viewId,
    fieldsSet,
    alias,
    validateFormula,
    pkAndPvOnly = false,
  }: {
    fieldsSet?: Set<string>;
    qb: Knex.QueryBuilder & Knex.QueryInterface;
    columns?: Column[];
    fields?: string[] | string;
    extractPkAndPv?: boolean;
    viewId?: string;
    alias?: string;
    validateFormula?: boolean;
    pkAndPvOnly?: boolean;
  }): Promise<void> => {
    // keep a common object for all columns to share across all columns
    const aliasToColumnBuilder = {};
    let viewOrTableColumns: Column[] | { fk_column_id?: string }[];

    const res = {};
    let view: View;
    let fields: string[];

    if (fieldsSet?.size) {
      viewOrTableColumns =
        _columns || (await baseModel.model.getColumns(baseModel.context));
    } else {
      view = await View.get(baseModel.context, viewId);
      const viewColumns =
        viewId && (await View.getColumns(baseModel.context, viewId));
      fields = Array.isArray(_fields) ? _fields : _fields?.split(',');

      // const columns = _columns ?? (await baseModel.model.getColumns(baseModel.context));
      // for (const column of columns) {
      viewOrTableColumns =
        viewColumns ||
        _columns ||
        (await baseModel.model.getColumns(baseModel.context));
    }
    for (const viewOrTableColumn of viewOrTableColumns) {
      const column =
        viewOrTableColumn instanceof Column
          ? viewOrTableColumn
          : await Column.get(baseModel.context, {
              colId: (viewOrTableColumn as GridViewColumn).fk_column_id,
            });
      // hide if column marked as hidden in view
      // of if column is system field and system field is hidden
      if (
        shouldSkipField(
          fieldsSet,
          viewOrTableColumn,
          view,
          column,
          extractPkAndPv || pkAndPvOnly,
          pkAndPvOnly,
        )
      ) {
        continue;
      }

      if (!checkColumnRequired(column, fields, extractPkAndPv)) continue;

      switch (column.uidt) {
        case UITypes.CreatedTime:
        case UITypes.LastModifiedTime:
        case UITypes.DateTime:
          {
            const columnName = await getColumnName(
              baseModel.context,
              column,
              _columns || (await baseModel.model.getColumns(baseModel.context)),
            );
            if (baseModel.isMySQL) {
              // MySQL stores timestamp in UTC but display in timezone
              // To verify the timezone, run `SELECT @@global.time_zone, @@session.time_zone;`
              // If it's SYSTEM, then the timezone is read from the configuration file
              // if a timezone is set in a DB, the retrieved value would be converted to the corresponding timezone
              // for example, let's say the global timezone is +08:00 in DB
              // the value 2023-01-01 10:00:00 (UTC) would display as 2023-01-01 18:00:00 (UTC+8)
              // our existing logic is based on UTC, during the query, we need to take the UTC value
              // hence, we use CONVERT_TZ to convert back to UTC value
              res[sanitize(getAs(column) || columnName)] =
                baseModel.dbDriver.raw(
                  `CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00')`,
                  [`${sanitize(alias || baseModel.tnPath)}.${columnName}`],
                );
              break;
            } else if (baseModel.isPg) {
              // if there is no timezone info,
              // convert to database timezone,
              // then convert to UTC
              if (
                column.dt !== 'timestamp with time zone' &&
                column.dt !== 'timestamptz'
              ) {
                res[sanitize(getAs(column) || columnName)] = baseModel.dbDriver
                  .raw(
                    `?? AT TIME ZONE CURRENT_SETTING('timezone') AT TIME ZONE 'UTC'`,
                    [`${sanitize(alias || baseModel.tnPath)}.${columnName}`],
                  )
                  .wrap('(', ')');
                break;
              }
            } else if (baseModel.isMssql) {
              // if there is no timezone info,
              // convert to database timezone,
              // then convert to UTC
              if (column.dt !== 'datetimeoffset') {
                res[sanitize(getAs(column) || columnName)] =
                  baseModel.dbDriver.raw(
                    `CONVERT(DATETIMEOFFSET, ?? AT TIME ZONE 'UTC')`,
                    [`${sanitize(alias || baseModel.tnPath)}.${columnName}`],
                  );
                break;
              }
            }
            res[sanitize(getAs(column) || columnName)] = sanitize(
              `${alias || baseModel.tnPath}.${columnName}`,
            );
          }
          break;
        case UITypes.LinkToAnotherRecord:
        case UITypes.Lookup:
          break;
        case UITypes.QrCode: {
          const qrCodeColumn = await column.getColOptions<QrCodeColumn>(
            baseModel.context,
          );

          if (!qrCodeColumn.fk_qr_value_column_id) {
            qb.select(
              baseModel.dbDriver.raw(`? as ??`, ['ERR!', getAs(column)]),
            );
            break;
          }

          const qrValueColumn = await Column.get(baseModel.context, {
            colId: qrCodeColumn.fk_qr_value_column_id,
          });

          // If the referenced value cannot be found: cancel current iteration
          if (qrValueColumn == null) {
            break;
          }

          switch (qrValueColumn.uidt) {
            case UITypes.Formula:
              try {
                const selectQb =
                  await baseModel.getSelectQueryBuilderForFormula(
                    qrValueColumn,
                    alias,
                    validateFormula,
                    aliasToColumnBuilder,
                  );
                qb.select({
                  [column.column_name]: selectQb.builder,
                });
              } catch {
                continue;
              }
              break;
            default: {
              qb.select({ [column.column_name]: qrValueColumn.column_name });
              break;
            }
          }

          break;
        }
        case UITypes.Barcode: {
          const barcodeColumn = await column.getColOptions<BarcodeColumn>(
            baseModel.context,
          );

          if (!barcodeColumn.fk_barcode_value_column_id) {
            qb.select(
              baseModel.dbDriver.raw(`? as ??`, ['ERR!', getAs(column)]),
            );
            break;
          }

          const barcodeValueColumn = await Column.get(baseModel.context, {
            colId: barcodeColumn.fk_barcode_value_column_id,
          });

          // If the referenced value cannot be found: cancel current iteration
          if (barcodeValueColumn == null) {
            break;
          }

          switch (barcodeValueColumn.uidt) {
            case UITypes.Formula:
              try {
                const selectQb =
                  await baseModel.getSelectQueryBuilderForFormula(
                    barcodeValueColumn,
                    alias,
                    validateFormula,
                    aliasToColumnBuilder,
                  );
                qb.select({
                  [getAs(column)]: selectQb.builder,
                });
              } catch {
                continue;
              }
              break;
            default: {
              qb.select({
                [getAs(column)]: barcodeValueColumn.column_name,
              });
              break;
            }
          }

          break;
        }
        case UITypes.Formula:
          {
            try {
              const selectQb = await baseModel.getSelectQueryBuilderForFormula(
                column,
                alias,
                validateFormula,
                aliasToColumnBuilder,
              );
              qb.select(
                baseModel.dbDriver.raw(`?? as ??`, [
                  selectQb.builder,
                  getAs(column),
                ]),
              );
            } catch (e) {
              logger.log(e);
              // return dummy select
              qb.select(baseModel.dbDriver.raw(`'ERR' as ??`, [getAs(column)]));
            }
          }
          break;
        case UITypes.Button: {
          try {
            const colOption = column.colOptions as ButtonColumn;
            if (colOption.type === ButtonActionsType.Url) {
              const selectQb = await baseModel.getSelectQueryBuilderForFormula(
                column,
                alias,
                validateFormula,
                aliasToColumnBuilder,
              );
              switch (baseModel.dbDriver.client.config.client) {
                case 'mysql2':
                  qb.select(
                    baseModel.dbDriver.raw(
                      `JSON_OBJECT('type', ? , 'label', ?, 'url', ??) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        selectQb.builder,
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                case 'pg':
                  qb.select(
                    baseModel.dbDriver.raw(
                      `json_build_object('type', ? ,'label', ?, 'url', ??) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        selectQb.builder,
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                case 'sqlite3':
                  qb.select(
                    baseModel.dbDriver.raw(
                      `json_object('type', ?, 'label', ?, 'url', ??) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        selectQb.builder,
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                default:
                  qb.select(
                    baseModel.dbDriver.raw(`'ERR' as ??`, [getAs(column)]),
                  );
              }
            } else if (
              [ButtonActionsType.Webhook, ButtonActionsType.Script].includes(
                colOption.type,
              )
            ) {
              const key =
                colOption.type === ButtonActionsType.Webhook
                  ? 'fk_webhook_id'
                  : 'fk_script_id';
              switch (baseModel.dbDriver.client.config.client) {
                case 'mysql2':
                  qb.select(
                    baseModel.dbDriver.raw(
                      `JSON_OBJECT('type', ?, 'label', ?, '${key}', ?) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        colOption[key],
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                case 'pg':
                  qb.select(
                    baseModel.dbDriver.raw(
                      `json_build_object('type', ?, 'label', ?, '${key}', ?) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        colOption[key],
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                case 'sqlite3':
                  qb.select(
                    baseModel.dbDriver.raw(
                      `json_object('type', ?, 'label', ?, '${key}', ?) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        colOption[key],
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                default:
                  qb.select(
                    baseModel.dbDriver.raw(`'ERR' as ??`, [getAs(column)]),
                  );
              }
            }
          } catch (e) {
            logger.log(e);
            // return dummy select
            qb.select(baseModel.dbDriver.raw(`'ERR' as ??`, [getAs(column)]));
          }
          break;
        }
        case UITypes.Rollup:
        case UITypes.Links:
          qb.select(
            (
              await genRollupSelectv2({
                baseModelSqlv2: baseModel,
                // tn: baseModel.title,
                knex: baseModel.dbDriver,
                // column,
                alias,
                columnOptions: (await column.getColOptions(
                  baseModel.context,
                )) as RollupColumn,
              })
            ).builder.as(getAs(column)),
          );
          break;
        case UITypes.CreatedBy:
        case UITypes.LastModifiedBy: {
          const columnName = await getColumnName(
            baseModel.context,
            column,
            _columns || (await baseModel.model.getColumns(baseModel.context)),
          );

          res[sanitize(getAs(column) || columnName)] = sanitize(
            `${alias || baseModel.tnPath}.${columnName}`,
          );
          break;
        }
        case UITypes.SingleSelect: {
          res[sanitize(getAs(column) || column.column_name)] =
            baseModel.dbDriver.raw(`COALESCE(NULLIF(??, ''), NULL)`, [
              sanitize(column.column_name),
            ]);
          break;
        }
        default:
          if (baseModel.isPg) {
            if (column.dt === 'bytea') {
              res[sanitize(getAs(column) || column.column_name)] =
                baseModel.dbDriver.raw(
                  `encode(??.??, '${
                    column.meta?.format === 'hex' ? 'hex' : 'escape'
                  }')`,
                  [alias || baseModel.model.table_name, column.column_name],
                );
              break;
            }
          }

          res[sanitize(getAs(column) || column.column_name)] = sanitize(
            `${alias || baseModel.tnPath}.${column.column_name}`,
          );
          break;
      }
    }
    qb.select(res);
  };
};
