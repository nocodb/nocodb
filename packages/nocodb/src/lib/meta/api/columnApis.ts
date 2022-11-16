import { Request, Response, Router } from 'express';
import Model from '../../models/Model';
import ProjectMgrv2 from '../../db/sql-mgr/v2/ProjectMgrv2';
import Base from '../../models/Base';
import Column from '../../models/Column';
import { Tele } from 'nc-help';
import validateParams from '../helpers/validateParams';

import { customAlphabet } from 'nanoid';
import LinkToAnotherRecordColumn from '../../models/LinkToAnotherRecordColumn';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '../helpers/getUniqueName';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  isVirtualCol,
  LinkToAnotherRecordType,
  RelationTypes,
  substituteColumnAliasWithIdInFormula,
  substituteColumnIdWithAliasInFormula,
  TableType,
  UITypes,
} from 'nocodb-sdk';
import Audit from '../../models/Audit';
import SqlMgrv2 from '../../db/sql-mgr/v2/SqlMgrv2';
import Noco from '../../Noco';
import NcMetaIO from '../NcMetaIO';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { NcError } from '../helpers/catchError';
import getColumnPropsFromUIDT from '../helpers/getColumnPropsFromUIDT';
import mapDefaultPrimaryValue from '../helpers/mapDefaultPrimaryValue';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import { metaApiMetrics } from '../helpers/apiMetrics';
import FormulaColumn from '../../models/FormulaColumn';
import KanbanView from '../../models/KanbanView';
import { MetaTable } from '../../utils/globals';

const randomID = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 10);

export enum Altered {
  NEW_COLUMN = 1,
  DELETE_COLUMN = 4,
  UPDATE_COLUMN = 8,
}

async function createHmAndBtColumn(
  child: Model,
  parent: Model,
  childColumn: Column,
  type?: RelationTypes,
  alias?: string,
  virtual = false,
  isSystemCol = false
) {
  // save bt column
  {
    const title = getUniqueColumnAliasName(
      await child.getColumns(),
      type === 'bt' ? alias : `${parent.title}`
    );
    await Column.insert<LinkToAnotherRecordColumn>({
      title,

      fk_model_id: child.id,
      // ref_db_alias
      uidt: UITypes.LinkToAnotherRecord,
      type: 'bt',
      // db_type:

      fk_child_column_id: childColumn.id,
      fk_parent_column_id: parent.primaryKey.id,
      fk_related_model_id: parent.id,
      virtual,
      system: isSystemCol,
    });
  }
  // save hm column
  {
    const title = getUniqueColumnAliasName(
      await parent.getColumns(),
      type === 'hm' ? alias : `${child.title} List`
    );
    await Column.insert({
      title,
      fk_model_id: parent.id,
      uidt: UITypes.LinkToAnotherRecord,
      type: 'hm',
      fk_child_column_id: childColumn.id,
      fk_parent_column_id: parent.primaryKey.id,
      fk_related_model_id: child.id,
      virtual,
      system: isSystemCol,
    });
  }
}

export async function columnAdd(req: Request, res: Response<TableType>) {
  const table = await Model.getWithInfo({
    id: req.params.tableId,
  });
  const base = await Base.get(table.base_id);
  const project = await base.getProject();

  if (
    !isVirtualCol(req.body) &&
    !(await Column.checkTitleAvailable({
      column_name: req.body.column_name,
      fk_model_id: req.params.tableId,
    }))
  ) {
    NcError.badRequest('Duplicate column name');
  }
  if (
    !(await Column.checkAliasAvailable({
      title: req.body.title || req.body.column_name,
      fk_model_id: req.params.tableId,
    }))
  ) {
    NcError.badRequest('Duplicate column alias');
  }

  let colBody = req.body;
  switch (colBody.uidt) {
    case UITypes.Rollup:
      {
        validateParams(
          [
            'title',
            'fk_relation_column_id',
            'fk_rollup_column_id',
            'rollup_function',
          ],
          req.body
        );

        const relation = await (
          await Column.get({
            colId: req.body.fk_relation_column_id,
          })
        ).getColOptions<LinkToAnotherRecordType>();

        if (!relation) {
          throw new Error('Relation column not found');
        }

        let relatedColumn: Column;
        switch (relation.type) {
          case 'hm':
            relatedColumn = await Column.get({
              colId: relation.fk_child_column_id,
            });
            break;
          case 'mm':
          case 'bt':
            relatedColumn = await Column.get({
              colId: relation.fk_parent_column_id,
            });
            break;
        }

        const relatedTable = await relatedColumn.getModel();
        if (
          !(await relatedTable.getColumns()).find(
            (c) => c.id === req.body.fk_rollup_column_id
          )
        )
          throw new Error('Rollup column not found in related table');

        await Column.insert({
          ...colBody,
          fk_model_id: table.id,
        });
      }
      break;
    case UITypes.Lookup:
      {
        validateParams(
          ['title', 'fk_relation_column_id', 'fk_lookup_column_id'],
          req.body
        );

        const relation = await (
          await Column.get({
            colId: req.body.fk_relation_column_id,
          })
        ).getColOptions<LinkToAnotherRecordType>();

        if (!relation) {
          throw new Error('Relation column not found');
        }

        let relatedColumn: Column;
        switch (relation.type) {
          case 'hm':
            relatedColumn = await Column.get({
              colId: relation.fk_child_column_id,
            });
            break;
          case 'mm':
          case 'bt':
            relatedColumn = await Column.get({
              colId: relation.fk_parent_column_id,
            });
            break;
        }

        const relatedTable = await relatedColumn.getModel();
        if (
          !(await relatedTable.getColumns()).find(
            (c) => c.id === req.body.fk_lookup_column_id
          )
        )
          throw new Error('Lookup column not found in related table');

        await Column.insert({
          ...colBody,
          fk_model_id: table.id,
        });
      }
      break;

    case UITypes.LinkToAnotherRecord:
      // case UITypes.ForeignKey:
      {
        validateParams(['parentId', 'childId', 'type'], req.body);

        // get parent and child models
        const parent = await Model.getWithInfo({ id: req.body.parentId });
        const child = await Model.getWithInfo({ id: req.body.childId });
        let childColumn: Column;

        const sqlMgr = await ProjectMgrv2.getSqlMgr({
          id: base.project_id,
        });
        if (req.body.type === 'hm' || req.body.type === 'bt') {
          // populate fk column name
          const fkColName = getUniqueColumnName(
            await child.getColumns(),
            `${parent.table_name}_id`
          );

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

            await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);

            const { id } = await Column.insert({
              ...newColumn,
              uidt: UITypes.ForeignKey,
              fk_model_id: child.id,
            });

            childColumn = await Column.get({ colId: id });

            // ignore relation creation if virtual
            if (!req.body.virtual) {
              // create relation
              await sqlMgr.sqlOpPlus(base, 'relationCreate', {
                childColumn: fkColName,
                childTable: child.table_name,
                parentTable: parent.table_name,
                onDelete: 'NO ACTION',
                onUpdate: 'NO ACTION',
                type: 'real',
                parentColumn: parent.primaryKey.column_name,
              });
            }

            // todo: create index for virtual relations as well
            // create index for foreign key in pg
            if (base.type === 'pg') {
              await createColumnIndex({
                column: new Column({
                  ...newColumn,
                  fk_model_id: child.id,
                }),
                base,
                sqlMgr,
              });
            }
          }
          await createHmAndBtColumn(
            child,
            parent,
            childColumn,
            req.body.type,
            req.body.title,
            req.body.virtual
          );
        } else if (req.body.type === 'mm') {
          const aTn = `${project?.prefix ?? ''}_nc_m2m_${randomID()}`;
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
            }
          );

          await sqlMgr.sqlOpPlus(base, 'tableCreate', {
            tn: aTn,
            _tn: aTnAlias,
            columns: associateTableCols,
          });

          const assocModel = await Model.insert(project.id, base.id, {
            table_name: aTn,
            title: aTnAlias,
            // todo: sanitize
            mm: true,
            columns: associateTableCols,
          });

          if (!req.body.virtual) {
            const rel1Args = {
              ...req.body,
              childTable: aTn,
              childColumn: parentCn,
              parentTable: parent.table_name,
              parentColumn: parentPK.column_name,
              type: 'real',
            };
            const rel2Args = {
              ...req.body,
              childTable: aTn,
              childColumn: childCn,
              parentTable: child.table_name,
              parentColumn: childPK.column_name,
              type: 'real',
            };

            await sqlMgr.sqlOpPlus(base, 'relationCreate', rel1Args);
            await sqlMgr.sqlOpPlus(base, 'relationCreate', rel2Args);
          }
          const parentCol = (await assocModel.getColumns())?.find(
            (c) => c.column_name === parentCn
          );
          const childCol = (await assocModel.getColumns())?.find(
            (c) => c.column_name === childCn
          );

          await createHmAndBtColumn(
            assocModel,
            child,
            childCol,
            null,
            null,
            req.body.virtual,
            true
          );
          await createHmAndBtColumn(
            assocModel,
            parent,
            parentCol,
            null,
            null,
            req.body.virtual,
            true
          );

          await Column.insert({
            title: getUniqueColumnAliasName(
              await child.getColumns(),
              `${parent.title} List`
            ),
            uidt: UITypes.LinkToAnotherRecord,
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
          });
          await Column.insert({
            title: getUniqueColumnAliasName(
              await parent.getColumns(),
              req.body.title ?? `${child.title} List`
            ),

            uidt: UITypes.LinkToAnotherRecord,
            type: 'mm',

            fk_model_id: parent.id,

            fk_child_column_id: parentPK.id,
            fk_parent_column_id: childPK.id,

            fk_mm_model_id: assocModel.id,
            fk_mm_child_column_id: parentCol.id,
            fk_mm_parent_column_id: childCol.id,
            fk_related_model_id: child.id,
          });

          // todo: create index for virtual relations as well
          // create index for foreign key in pg
          if (base.type === 'pg') {
            await createColumnIndex({
              column: new Column({
                ...associateTableCols[0],
                fk_model_id: assocModel.id,
              }),
              base,
              sqlMgr,
            });
            await createColumnIndex({
              column: new Column({
                ...associateTableCols[1],
                fk_model_id: assocModel.id,
              }),
              base,
              sqlMgr,
            });
          }
        }
      }
      Tele.emit('evt', { evt_type: 'relation:created' });
      break;

    case UITypes.Formula:
      colBody.formula = await substituteColumnAliasWithIdInFormula(
        colBody.formula_raw || colBody.formula,
        table.columns
      );
      await Column.insert({
        ...colBody,
        fk_model_id: table.id,
      });

      break;
    default:
      {
        colBody = getColumnPropsFromUIDT(colBody, base);
        if (colBody.uidt === UITypes.Duration) {
          colBody.dtxp = '20';
          // by default, colBody.dtxs is 2
          // Duration column needs more that that
          colBody.dtxs = '4';
        }

        if (
          [UITypes.SingleSelect, UITypes.MultiSelect].includes(colBody.uidt)
        ) {
          const dbDriver = NcConnectionMgrv2.get(base);
          const driverType = dbDriver.clientType();
          const optionTitles = colBody.colOptions.options.map((el) =>
            el.title.replace(/'/g, "''")
          );

          // this is not used for select columns and cause issue for MySQL
          colBody.dtxs = '';
          // Handle default values
          if (colBody.cdf) {
            if (colBody.uidt === UITypes.SingleSelect) {
              if (!optionTitles.includes(colBody.cdf.replace(/'/g, "''"))) {
                NcError.badRequest(
                  `Default value '${colBody.cdf}' is not a select option.`
                );
              }
            } else {
              for (const cdf of colBody.cdf.split(',')) {
                if (!optionTitles.includes(cdf.replace(/'/g, "''"))) {
                  NcError.badRequest(
                    `Default value '${cdf}' is not a select option.`
                  );
                }
              }
            }

            // handle single quote for default value
            if (driverType === 'mysql' || driverType === 'mysql2') {
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

        const sqlClient = NcConnectionMgrv2.getSqlClient(base);
        const sqlMgr = await ProjectMgrv2.getSqlMgr({ id: base.project_id });
        await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);

        const columns: Array<
          Omit<Column, 'column_name' | 'title'> & {
            cn: string;
            system?: boolean;
          }
        > = (await sqlClient.columnList({ tn: table.table_name }))?.data?.list;

        const insertedColumnMeta =
          columns.find((c) => c.cn === colBody.column_name) || ({} as any);

        await Column.insert({
          ...colBody,
          ...insertedColumnMeta,
          dtxp: [UITypes.MultiSelect, UITypes.SingleSelect].includes(
            colBody.uidt as any
          )
            ? colBody.dtxp
            : insertedColumnMeta.dtxp,
          fk_model_id: table.id,
        });
      }
      break;
  }

  await table.getColumns();

  await Audit.insert({
    project_id: base.project_id,
    op_type: AuditOperationTypes.TABLE_COLUMN,
    op_sub_type: AuditOperationSubTypes.CREATED,
    user: (req as any)?.user?.email,
    description: `created column ${colBody.column_name} with alias ${colBody.title} from table ${table.table_name}`,
    ip: (req as any).clientIp,
  }).then(() => {});

  Tele.emit('evt', { evt_type: 'column:created' });

  res.json(table);
}

export async function columnSetAsPrimary(req: Request, res: Response) {
  const column = await Column.get({ colId: req.params.columnId });
  res.json(await Model.updatePrimaryColumn(column.fk_model_id, column.id));
}

export async function columnUpdate(req: Request, res: Response<TableType>) {
  const column = await Column.get({ colId: req.params.columnId });

  const table = await Model.getWithInfo({
    id: column.fk_model_id,
  });
  const base = await Base.get(table.base_id);

  if (
    !isVirtualCol(req.body) &&
    !(await Column.checkTitleAvailable({
      column_name: req.body.column_name,
      fk_model_id: column.fk_model_id,
      exclude_id: req.params.columnId,
    }))
  ) {
    NcError.badRequest('Duplicate column name');
  }
  if (
    !(await Column.checkAliasAvailable({
      title: req.body.title,
      fk_model_id: column.fk_model_id,
      exclude_id: req.params.columnId,
    }))
  ) {
    NcError.badRequest('Duplicate column alias');
  }

  let colBody = req.body;
  if (
    [
      UITypes.Lookup,
      UITypes.Rollup,
      UITypes.LinkToAnotherRecord,
      UITypes.Formula,
      UITypes.ForeignKey,
    ].includes(column.uidt)
  ) {
    if (column.uidt === colBody.uidt) {
      if (column.uidt === UITypes.Formula) {
        colBody.formula = await substituteColumnAliasWithIdInFormula(
          colBody.formula_raw || colBody.formula,
          table.columns
        );
        await Column.update(column.id, {
          // title: colBody.title,
          ...column,
          ...colBody,
        });
      } else if (colBody.title !== column.title) {
        await Column.updateAlias(req.params.columnId, {
          title: colBody.title,
        });
      }
    } else {
      NcError.notImplemented(
        `Updating ${colBody.uidt} => ${colBody.uidt} is not implemented`
      );
    }
  } else if (
    [
      UITypes.Lookup,
      UITypes.Rollup,
      UITypes.LinkToAnotherRecord,
      UITypes.Formula,
      UITypes.ForeignKey,
    ].includes(colBody.uidt)
  ) {
    NcError.notImplemented(
      `Updating ${colBody.uidt} => ${colBody.uidt} is not implemented`
    );
  } else if (
    [UITypes.SingleSelect, UITypes.MultiSelect].includes(colBody.uidt)
  ) {
    colBody = getColumnPropsFromUIDT(colBody, base);

    const baseModel = await Model.getBaseModelSQL({
      id: table.id,
      dbDriver: NcConnectionMgrv2.get(base),
    });

    if (colBody.colOptions?.options) {
      const supportedDrivers = ['mysql', 'mysql2', 'pg', 'mssql', 'sqlite3'];
      const dbDriver = NcConnectionMgrv2.get(base);
      const driverType = dbDriver.clientType();

      // MultiSelect to SingleSelect
      if (
        column.uidt === UITypes.MultiSelect &&
        colBody.uidt === UITypes.SingleSelect
      ) {
        if (driverType === 'mysql' || driverType === 'mysql2') {
          await dbDriver.raw(
            `UPDATE ?? SET ?? = SUBSTRING_INDEX(??, ',', 1) WHERE ?? LIKE '%,%';`,
            [
              table.table_name,
              column.column_name,
              column.column_name,
              column.column_name,
            ]
          );
        } else if (driverType === 'pg') {
          await dbDriver.raw(`UPDATE ?? SET ?? = split_part(??, ',', 1);`, [
            table.table_name,
            column.column_name,
            column.column_name,
          ]);
        } else if (driverType === 'mssql') {
          await dbDriver.raw(
            `UPDATE ?? SET ?? = LEFT(cast(?? as varchar(max)), CHARINDEX(',', ??) - 1) WHERE CHARINDEX(',', ??) > 0;`,
            [
              table.table_name,
              column.column_name,
              column.column_name,
              column.column_name,
              column.column_name,
            ]
          );
        } else if (driverType === 'sqlite3') {
          await dbDriver.raw(
            `UPDATE ?? SET ?? = substr(??, 1, instr(??, ',') - 1) WHERE ?? LIKE '%,%';`,
            [
              table.table_name,
              column.column_name,
              column.column_name,
              column.column_name,
              column.column_name,
            ]
          );
        }
      }

      // Handle migrations
      if (column.colOptions?.options) {
        for (const op of column.colOptions.options.filter(
          (el) => el.order === null
        )) {
          op.title = op.title.replace(/^'/, '').replace(/'$/, '');
        }
      }

      // Handle default values
      const optionTitles = colBody.colOptions.options.map((el) =>
        el.title.replace(/'/g, "''")
      );
      if (colBody.cdf) {
        if (colBody.uidt === UITypes.SingleSelect) {
          if (!optionTitles.includes(colBody.cdf.replace(/'/g, "''"))) {
            NcError.badRequest(
              `Default value '${colBody.cdf}' is not a select option.`
            );
          }
        } else {
          for (const cdf of colBody.cdf.split(',')) {
            if (!optionTitles.includes(cdf.replace(/'/g, "''"))) {
              NcError.badRequest(
                `Default value '${cdf}' is not a select option.`
              );
            }
          }
        }

        // handle single quote for default value
        if (driverType === 'mysql' || driverType === 'mysql2') {
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
            : true
        )) {
          if (
            !supportedDrivers.includes(driverType) &&
            column.uidt === UITypes.MultiSelect
          ) {
            NcError.badRequest(
              'Your database not yet supported for this operation. Please remove option from records manually before dropping.'
            );
          }
          if (column.uidt === UITypes.SingleSelect) {
            if (driverType === 'mssql') {
              await dbDriver.raw(`UPDATE ?? SET ?? = NULL WHERE ?? LIKE ?`, [
                table.table_name,
                column.column_name,
                column.column_name,
                option.title,
              ]);
            } else {
              await baseModel.bulkUpdateAll(
                { where: `(${column.title},eq,${option.title})` },
                { [column.column_name]: null },
                { cookie: req }
              );
            }
          } else if (column.uidt === UITypes.MultiSelect) {
            if (driverType === 'mysql' || driverType === 'mysql2') {
              if (colBody.dt === 'set') {
                await dbDriver.raw(
                  `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), ',')) WHERE FIND_IN_SET(?, ??)`,
                  [
                    table.table_name,
                    column.column_name,
                    column.column_name,
                    option.title,
                    option.title,
                    column.column_name,
                  ]
                );
              } else {
                await dbDriver.raw(
                  `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), ','))`,
                  [
                    table.table_name,
                    column.column_name,
                    column.column_name,
                    option.title,
                  ]
                );
              }
            } else if (driverType === 'pg') {
              await dbDriver.raw(
                `UPDATE ?? SET ??  = array_to_string(array_remove(string_to_array(??, ','), ?), ',')`,
                [
                  table.table_name,
                  column.column_name,
                  column.column_name,
                  option.title,
                ]
              );
            } else if (driverType === 'mssql') {
              await dbDriver.raw(
                `UPDATE ?? SET ?? = substring(replace(concat(',', ??, ','), concat(',', ?, ','), ','), 2, len(replace(concat(',', ??, ','), concat(',', ?, ','), ',')) - 2)`,
                [
                  table.table_name,
                  column.column_name,
                  column.column_name,
                  option.title,
                  column.column_name,
                  option.title,
                ]
              );
            } else if (driverType === 'sqlite3') {
              await dbDriver.raw(
                `UPDATE ?? SET ?? = TRIM(REPLACE(',' || ?? || ',', ',' || ? || ',', ','), ',')`,
                [
                  table.table_name,
                  column.column_name,
                  column.column_name,
                  option.title,
                ]
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
            (newOp) => newOp.id === oldOp.id && newOp.title !== oldOp.title
          )
        )) {
          if (
            !supportedDrivers.includes(driverType) &&
            column.uidt === UITypes.MultiSelect
          ) {
            NcError.badRequest(
              'Your database not yet supported for this operation. Please remove option from records manually before updating.'
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
                        NcError.badRequest("Illegal char(',') for MultiSelect");
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
                  if (c.id === req.params.columnId) {
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
                })
              ),
            };

            const sqlMgr = await ProjectMgrv2.getSqlMgr({
              id: base.project_id,
            });
            await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);

            await Column.update(req.params.columnId, {
              ...column,
            });
          }

          if (column.uidt === UITypes.SingleSelect) {
            if (driverType === 'mssql') {
              await dbDriver.raw(`UPDATE ?? SET ?? = ? WHERE ?? LIKE ?`, [
                table.table_name,
                column.column_name,
                newOp.title,
                column.column_name,
                option.title,
              ]);
            } else {
              await baseModel.bulkUpdateAll(
                { where: `(${column.title},eq,${option.title})` },
                { [column.column_name]: newOp.title },
                { cookie: req }
              );
            }
          } else if (column.uidt === UITypes.MultiSelect) {
            if (driverType === 'mysql' || driverType === 'mysql2') {
              if (colBody.dt === 'set') {
                await dbDriver.raw(
                  `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), CONCAT(',', ?, ','))) WHERE FIND_IN_SET(?, ??)`,
                  [
                    table.table_name,
                    column.column_name,
                    column.column_name,
                    option.title,
                    newOp.title,
                    option.title,
                    column.column_name,
                  ]
                );
              } else {
                await dbDriver.raw(
                  `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), CONCAT(',', ?, ',')))`,
                  [
                    table.table_name,
                    column.column_name,
                    column.column_name,
                    option.title,
                    newOp.title,
                  ]
                );
              }
            } else if (driverType === 'pg') {
              await dbDriver.raw(
                `UPDATE ?? SET ??  = array_to_string(array_replace(string_to_array(??, ','), ?, ?), ',')`,
                [
                  table.table_name,
                  column.column_name,
                  column.column_name,
                  option.title,
                  newOp.title,
                ]
              );
            } else if (driverType === 'mssql') {
              await dbDriver.raw(
                `UPDATE ?? SET ?? = substring(replace(concat(',', ??, ','), concat(',', ?, ','), concat(',', ?, ',')), 2, len(replace(concat(',', ??, ','), concat(',', ?, ','), concat(',', ?, ','))) - 2)`,
                [
                  table.table_name,
                  column.column_name,
                  column.column_name,
                  option.title,
                  newOp.title,
                  column.column_name,
                  option.title,
                  newOp.title,
                ]
              );
            } else if (driverType === 'sqlite3') {
              await dbDriver.raw(
                `UPDATE ?? SET ?? = TRIM(REPLACE(',' || ?? || ',', ',' || ? || ',', ',' || ? || ','), ',')`,
                [
                  table.table_name,
                  column.column_name,
                  column.column_name,
                  option.title,
                  newOp.title,
                ]
              );
            }
          }
        }
      }

      for (const ch of interchange) {
        const newOp = ch.def_option;
        if (column.uidt === UITypes.SingleSelect) {
          if (driverType === 'mssql') {
            await dbDriver.raw(`UPDATE ?? SET ?? = ? WHERE ?? LIKE ?`, [
              table.table_name,
              column.column_name,
              newOp.title,
              column.column_name,
              ch.temp_title,
            ]);
          } else {
            await baseModel.bulkUpdateAll(
              { where: `(${column.title},eq,${ch.temp_title})` },
              { [column.column_name]: newOp.title },
              { cookie: req }
            );
          }
        } else if (column.uidt === UITypes.MultiSelect) {
          if (driverType === 'mysql' || driverType === 'mysql2') {
            if (colBody.dt === 'set') {
              await dbDriver.raw(
                `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), CONCAT(',', ?, ','))) WHERE FIND_IN_SET(?, ??)`,
                [
                  table.table_name,
                  column.column_name,
                  column.column_name,
                  ch.temp_title,
                  newOp.title,
                  ch.temp_title,
                  column.column_name,
                ]
              );
            } else {
              await dbDriver.raw(
                `UPDATE ?? SET ?? = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', ??, ','), CONCAT(',', ?, ','), CONCAT(',', ?, ',')))`,
                [
                  table.table_name,
                  column.column_name,
                  column.column_name,
                  ch.temp_title,
                  newOp.title,
                  ch.temp_title,
                  column.column_name,
                ]
              );
            }
          } else if (driverType === 'pg') {
            await dbDriver.raw(
              `UPDATE ?? SET ??  = array_to_string(array_replace(string_to_array(??, ','), ?, ?), ',')`,
              [
                table.table_name,
                column.column_name,
                column.column_name,
                ch.temp_title,
                newOp.title,
              ]
            );
          } else if (driverType === 'mssql') {
            await dbDriver.raw(
              `UPDATE ?? SET ?? = substring(replace(concat(',', ??, ','), concat(',', ?, ','), concat(',', ?, ',')), 2, len(replace(concat(',', ??, ','), concat(',', ?, ','), concat(',', ?, ','))) - 2)`,
              [
                table.table_name,
                column.column_name,
                column.column_name,
                ch.temp_title,
                newOp.title,
                column.column_name,
                ch.temp_title,
                newOp.title,
              ]
            );
          } else if (driverType === 'sqlite3') {
            await dbDriver.raw(
              `UPDATE ?? SET ?? = TRIM(REPLACE(',' || ?? || ',', ',' || ? || ',', ',' || ? || ','), ',')`,
              [
                table.table_name,
                column.column_name,
                column.column_name,
                ch.temp_title,
                newOp.title,
              ]
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
          if (c.id === req.params.columnId) {
            const res = {
              ...c,
              ...colBody,
              cn: colBody.column_name,
              cno: c.column_name,
              altered: Altered.UPDATE_COLUMN,
            };

            // update formula with new column name
            if (c.column_name != colBody.column_name) {
              const formulas = await Noco.ncMeta
                .knex(MetaTable.COL_FORMULA)
                .where('formula', 'like', `%${c.id}%`);
              if (formulas) {
                const new_column = c;
                new_column.column_name = colBody.column_name;
                new_column.title = colBody.title;
                for (const f of formulas) {
                  // the formula with column IDs only
                  const formula = f.formula;
                  // replace column IDs with alias to get the new formula_raw
                  const new_formula_raw = substituteColumnIdWithAliasInFormula(
                    formula,
                    [new_column]
                  );
                  await FormulaColumn.update(c.id, {
                    formula_raw: new_formula_raw,
                  });
                }
              }
            }
            return Promise.resolve(res);
          } else {
            (c as any).cn = c.column_name;
          }
          return Promise.resolve(c);
        })
      ),
    };

    const sqlMgr = await ProjectMgrv2.getSqlMgr({ id: base.project_id });
    await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);

    await Column.update(req.params.columnId, {
      ...colBody,
    });
  } else {
    colBody = getColumnPropsFromUIDT(colBody, base);
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
          if (c.id === req.params.columnId) {
            const res = {
              ...c,
              ...colBody,
              cn: colBody.column_name,
              cno: c.column_name,
              altered: Altered.UPDATE_COLUMN,
            };

            // update formula with new column name
            if (c.column_name != colBody.column_name) {
              const formulas = await Noco.ncMeta
                .knex(MetaTable.COL_FORMULA)
                .where('formula', 'like', `%${c.id}%`);
              if (formulas) {
                const new_column = c;
                new_column.column_name = colBody.column_name;
                new_column.title = colBody.title;
                for (const f of formulas) {
                  // the formula with column IDs only
                  const formula = f.formula;
                  // replace column IDs with alias to get the new formula_raw
                  const new_formula_raw = substituteColumnIdWithAliasInFormula(
                    formula,
                    [new_column]
                  );
                  await FormulaColumn.update(c.id, {
                    formula_raw: new_formula_raw,
                  });
                }
              }
            }
            return Promise.resolve(res);
          } else {
            (c as any).cn = c.column_name;
          }
          return Promise.resolve(c);
        })
      ),
    };

    const sqlMgr = await ProjectMgrv2.getSqlMgr({ id: base.project_id });
    await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);

    await Column.update(req.params.columnId, {
      ...colBody,
    });
  }
  await Audit.insert({
    project_id: base.project_id,
    op_type: AuditOperationTypes.TABLE_COLUMN,
    op_sub_type: AuditOperationSubTypes.UPDATED,
    user: (req as any)?.user?.email,
    description: `updated column ${column.column_name} with alias ${column.title} from table ${table.table_name}`,
    ip: (req as any).clientIp,
  }).then(() => {});

  await table.getColumns();
  Tele.emit('evt', { evt_type: 'column:updated' });

  res.json(table);
}

export async function columnDelete(req: Request, res: Response<TableType>) {
  const column = await Column.get({ colId: req.params.columnId });
  const table = await Model.getWithInfo({
    id: column.fk_model_id,
  });
  const base = await Base.get(table.base_id);

  // const ncMeta = await Noco.ncMeta.startTransaction();
  // const sql-mgr = await ProjectMgrv2.getSqlMgrTrans(
  //   { id: base.project_id },
  //   ncMeta,
  //   base
  // );

  const sqlMgr = await ProjectMgrv2.getSqlMgr({ id: base.project_id });

  switch (column.uidt) {
    case UITypes.Lookup:
    case UITypes.Rollup:
    case UITypes.Formula:
      await Column.delete(req.params.columnId);
      break;
    case UITypes.LinkToAnotherRecord:
      {
        const relationColOpt =
          await column.getColOptions<LinkToAnotherRecordColumn>();
        const childColumn = await relationColOpt.getChildColumn();
        const childTable = await childColumn.getModel();

        const parentColumn = await relationColOpt.getParentColumn();
        const parentTable = await parentColumn.getModel();

        switch (relationColOpt.type) {
          case 'bt':
          case 'hm':
            {
              await deleteHmOrBtRelation({
                relationColOpt,
                base,
                childColumn,
                childTable,
                parentColumn,
                parentTable,
                sqlMgr,
                // ncMeta
              });
            }
            break;
          case 'mm':
            {
              const mmTable = await relationColOpt.getMMModel();
              const mmParentCol = await relationColOpt.getMMParentColumn();
              const mmChildCol = await relationColOpt.getMMChildColumn();

              await deleteHmOrBtRelation(
                {
                  relationColOpt: null,
                  parentColumn: parentColumn,
                  childTable: mmTable,
                  sqlMgr,
                  parentTable: parentTable,
                  childColumn: mmParentCol,
                  base,
                  // ncMeta
                },
                true
              );

              await deleteHmOrBtRelation(
                {
                  relationColOpt: null,
                  parentColumn: childColumn,
                  childTable: mmTable,
                  sqlMgr,
                  parentTable: childTable,
                  childColumn: mmChildCol,
                  base,
                  // ncMeta
                },
                true
              );
              const columnsInRelatedTable: Column[] = await relationColOpt
                .getRelatedTable()
                .then((m) => m.getColumns());

              for (const c of columnsInRelatedTable) {
                if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
                const colOpt =
                  await c.getColOptions<LinkToAnotherRecordColumn>();
                if (
                  colOpt.type === 'mm' &&
                  colOpt.fk_parent_column_id === childColumn.id &&
                  colOpt.fk_child_column_id === parentColumn.id &&
                  colOpt.fk_mm_model_id === mmTable.id &&
                  colOpt.fk_mm_parent_column_id === mmChildCol.id &&
                  colOpt.fk_mm_child_column_id === mmParentCol.id
                ) {
                  await Column.delete(c.id);
                  break;
                }
              }

              await Column.delete(relationColOpt.fk_column_id);

              // delete bt columns in m2m table
              await mmTable.getColumns();
              for (const c of mmTable.columns) {
                if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
                const colOpt =
                  await c.getColOptions<LinkToAnotherRecordColumn>();
                if (colOpt.type === 'bt') {
                  await Column.delete(c.id);
                }
              }

              // delete hm columns in parent table
              await parentTable.getColumns();
              for (const c of parentTable.columns) {
                if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
                const colOpt =
                  await c.getColOptions<LinkToAnotherRecordColumn>();
                if (colOpt.fk_related_model_id === mmTable.id) {
                  await Column.delete(c.id);
                }
              }

              // delete hm columns in child table
              await childTable.getColumns();
              for (const c of childTable.columns) {
                if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
                const colOpt =
                  await c.getColOptions<LinkToAnotherRecordColumn>();
                if (colOpt.fk_related_model_id === mmTable.id) {
                  await Column.delete(c.id);
                }
              }

              // retrieve columns in m2m table again
              await mmTable.getColumns();

              // ignore deleting table if it has more than 2 columns
              // the expected 2 columns would be table1_id & table2_id
              if (mmTable.columns.length === 2) {
                await mmTable.delete();
              }
            }
            break;
        }
      }
      Tele.emit('evt', { evt_type: 'raltion:deleted' });
      break;
    case UITypes.ForeignKey: {
      NcError.notImplemented();
      break;
    }
    // @ts-ignore
    case UITypes.SingleSelect: {
      if (column.uidt === UITypes.SingleSelect) {
        if (await KanbanView.IsColumnBeingUsedAsGroupingField(column.id)) {
          NcError.badRequest(
            `The column '${column.column_name}' is being used in Kanban View. Please delete Kanban View first.`
          );
        }
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
          if (c.id === req.params.columnId) {
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

      await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);

      await Column.delete(req.params.columnId);
    }
  }

  await Audit.insert({
    project_id: base.project_id,
    op_type: AuditOperationTypes.TABLE_COLUMN,
    op_sub_type: AuditOperationSubTypes.DELETED,
    user: (req as any)?.user?.email,
    description: `deleted column ${column.column_name} with alias ${column.title} from table ${table.table_name}`,
    ip: (req as any).clientIp,
  }).then(() => {});

  await table.getColumns();

  const primaryValueColumn = mapDefaultPrimaryValue(table.columns);
  if (primaryValueColumn) {
    await Model.updatePrimaryColumn(
      primaryValueColumn.fk_model_id,
      primaryValueColumn.id
    );
  }

  // await ncMeta.commit();
  // await sql-mgr.commit();
  Tele.emit('evt', { evt_type: 'column:deleted' });

  res.json(table);
  // } catch (e) {
  //   sql-mgr.rollback();
  //   ncMeta.rollback();
  //   throw e;
  // }
}

const deleteHmOrBtRelation = async (
  {
    relationColOpt,
    base,
    childColumn,
    childTable,
    parentColumn,
    parentTable,
    sqlMgr,
    ncMeta = Noco.ncMeta,
  }: {
    relationColOpt: LinkToAnotherRecordColumn;
    base: Base;
    childColumn: Column;
    childTable: Model;
    parentColumn: Column;
    parentTable: Model;
    sqlMgr: SqlMgrv2;
    ncMeta?: NcMetaIO;
  },
  ignoreFkDelete = false
) => {
  // todo: handle relation delete exception
  try {
    await sqlMgr.sqlOpPlus(base, 'relationDelete', {
      childColumn: childColumn.column_name,
      childTable: childTable.table_name,
      parentTable: parentTable.table_name,
      parentColumn: parentColumn.column_name,
      // foreignKeyName: relation.fkn
    });
  } catch (e) {
    console.log(e);
  }

  if (!relationColOpt) return;
  const columnsInRelatedTable: Column[] = await relationColOpt
    .getRelatedTable()
    .then((m) => m.getColumns());
  const relType = relationColOpt.type === 'bt' ? 'hm' : 'bt';
  for (const c of columnsInRelatedTable) {
    if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
    const colOpt = await c.getColOptions<LinkToAnotherRecordColumn>();
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
    const cTable = await Model.getWithInfo({
      id: childTable.id,
    });
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

    await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);
  }
  // delete foreign key column
  await Column.delete(childColumn.id, ncMeta);
};

async function createColumnIndex({
  column,
  sqlMgr,
  base,
  indexName = null,
  nonUnique = true,
}: {
  column: Column;
  sqlMgr: SqlMgrv2;
  base: Base;
  indexName?: string;
  nonUnique?: boolean;
}) {
  const model = await column.getModel();
  const indexArgs = {
    columns: [column.column_name],
    tn: model.table_name,
    non_unique: nonUnique,
    indexName,
  };
  sqlMgr.sqlOpPlus(base, 'indexCreate', indexArgs);
}

const router = Router({ mergeParams: true });
router.post(
  '/api/v1/db/meta/tables/:tableId/columns/',
  metaApiMetrics,
  ncMetaAclMw(columnAdd, 'columnAdd')
);
router.patch(
  '/api/v1/db/meta/columns/:columnId',
  metaApiMetrics,
  ncMetaAclMw(columnUpdate, 'columnUpdate')
);
router.delete(
  '/api/v1/db/meta/columns/:columnId',
  metaApiMetrics,
  ncMetaAclMw(columnDelete, 'columnDelete')
);
router.post(
  '/api/v1/db/meta/columns/:columnId/primary',
  metaApiMetrics,
  ncMetaAclMw(columnSetAsPrimary, 'columnSetAsPrimary')
);
export default router;
