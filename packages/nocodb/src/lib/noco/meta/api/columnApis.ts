import { Request, Response, Router } from 'express';
import Model from '../../../noco-models/Model';
import UITypes from '../../../sqlUi/UITypes';
import ProjectMgrv2 from '../../../sqlMgr/v2/ProjectMgrv2';
import Base from '../../../noco-models/Base';
import Column from '../../../noco-models/Column';
import { substituteColumnAliasWithIdInFormula } from '../helpers/formulaHelpers';
import validateParams from '../helpers/validateParams';
import { Tele } from 'nc-help';

import { customAlphabet } from 'nanoid';
import LinkToAnotherRecordColumn from '../../../noco-models/LinkToAnotherRecordColumn';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName
} from '../helpers/getUniqueName';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  isVirtualCol,
  LinkToAnotherRecordType,
  RelationTypes,
  TableType
} from 'nocodb-sdk';
import Audit from '../../../noco-models/Audit';
import SqlMgrv2 from '../../../sqlMgr/v2/SqlMgrv2';
import Noco from '../../Noco';
import NcMetaIO from '../NcMetaIO';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { NcError } from '../helpers/catchError';
import getColumnPropsFromUIDT from '../helpers/getColumnPropsFromUIDT';
import mapDefaultPrimaryValue from '../helpers/mapDefaultPrimaryValue';

const randomID = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 10);

export enum Altered {
  NEW_COLUMN = 1,
  DELETE_COLUMN = 4,
  UPDATE_COLUMN = 8
}

async function createHmAndBtColumn(
  child: Model,
  parent: Model,
  childColumn: Column,
  type?: RelationTypes,
  alias?: string,
  isSystemCol = false
) {
  // save bt column
  {
    const title = getUniqueColumnAliasName(
      await child.getColumns(),
      type === 'bt' ? alias : `${parent.title}Read`
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
      system: isSystemCol
    });
  }
  // save hm column
  {
    const title = getUniqueColumnAliasName(
      await parent.getColumns(),
      type === 'hm' ? alias : `${child.title}List`
    );
    await Column.insert({
      title,
      fk_model_id: parent.id,
      uidt: UITypes.LinkToAnotherRecord,
      type: 'hm',
      fk_child_column_id: childColumn.id,
      fk_parent_column_id: parent.primaryKey.id,
      fk_related_model_id: child.id,
      system: isSystemCol
    });
  }
}

export async function columnAdd(req: Request, res: Response<TableType>) {
  const table = await Model.getWithInfo({
    id: req.params.tableId
  });
  const base = await Base.get(table.base_id);
  const project = await base.getProject();

  if (
    !isVirtualCol(req.body) &&
    !(await Column.checkTitleAvailable({
      column_name: req.body.column_name,
      fk_model_id: req.params.tableId
    }))
  ) {
    NcError.badRequest('Duplicate column name');
  }
  if (
    !(await Column.checkAliasAvailable({
      title: req.body.title || req.body.column_name,
      fk_model_id: req.params.tableId
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
            'rollup_function'
          ],
          req.body
        );

        const relation = await (
          await Column.get({
            colId: req.body.fk_relation_column_id
          })
        ).getColOptions<LinkToAnotherRecordType>();

        if (!relation) {
          throw new Error('Relation column not found');
        }

        let relatedColumn: Column;
        switch (relation.type) {
          case 'hm':
            relatedColumn = await Column.get({
              colId: relation.fk_child_column_id
            });
            break;
          case 'mm':
          case 'bt':
            relatedColumn = await Column.get({
              colId: relation.fk_parent_column_id
            });
            break;
        }

        const relatedTable = await relatedColumn.getModel();
        if (
          !(await relatedTable.getColumns()).find(
            c => c.id === req.body.fk_rollup_column_id
          )
        )
          throw new Error('Rollup column not found in related table');

        await Column.insert({
          ...colBody,
          fk_model_id: table.id
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
            colId: req.body.fk_relation_column_id
          })
        ).getColOptions<LinkToAnotherRecordType>();

        if (!relation) {
          throw new Error('Relation column not found');
        }

        let relatedColumn: Column;
        switch (relation.type) {
          case 'hm':
            relatedColumn = await Column.get({
              colId: relation.fk_child_column_id
            });
            break;
          case 'mm':
          case 'bt':
            relatedColumn = await Column.get({
              colId: relation.fk_parent_column_id
            });
            break;
        }

        const relatedTable = await relatedColumn.getModel();
        if (
          !(await relatedTable.getColumns()).find(
            c => c.id === req.body.fk_lookup_column_id
          )
        )
          throw new Error('Lookup column not found in related table');

        await Column.insert({
          ...colBody,
          fk_model_id: table.id
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
          id: base.project_id
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
              altered: Altered.NEW_COLUMN
            };
            const tableUpdateBody = {
              ...child,
              tn: child.table_name,
              originalColumns: child.columns.map(c => ({
                ...c,
                cn: c.column_name
              })),
              columns: [
                ...child.columns.map(c => ({
                  ...c,
                  cn: c.column_name
                })),
                newColumn
              ]
            };

            await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);

            const { id } = await Column.insert({
              ...newColumn,
              uidt: UITypes.ForeignKey,
              fk_model_id: child.id
            });

            childColumn = await Column.get({ colId: id });

            // create relation
            await sqlMgr.sqlOpPlus(base, 'relationCreate', {
              childColumn: fkColName,
              childTable: child.table_name,
              parentTable: parent.table_name,
              onDelete: 'NO ACTION',
              onUpdate: 'NO ACTION',
              type: 'real',
              parentColumn: parent.primaryKey.column_name
            });
          }
          await createHmAndBtColumn(
            child,
            parent,
            childColumn,
            req.body.type,
            req.body.title
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
              uidt: UITypes.ForeignKey
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
              uidt: UITypes.ForeignKey
            }
          );

          await sqlMgr.sqlOpPlus(base, 'tableCreate', {
            tn: aTn,
            _tn: aTnAlias,
            columns: associateTableCols
          });

          const assocModel = await Model.insert(project.id, base.id, {
            table_name: aTn,
            title: aTnAlias,
            // todo: sanitize
            mm: true,
            columns: associateTableCols
          });

          const rel1Args = {
            ...req.body,
            childTable: aTn,
            childColumn: parentCn,
            parentTable: parent.table_name,
            parentColumn: parentPK.column_name,
            type: 'real'
          };
          const rel2Args = {
            ...req.body,
            childTable: aTn,
            childColumn: childCn,
            parentTable: child.table_name,
            parentColumn: childPK.column_name,
            type: 'real'
          };

          await sqlMgr.sqlOpPlus(base, 'relationCreate', rel1Args);
          await sqlMgr.sqlOpPlus(base, 'relationCreate', rel2Args);

          const parentCol = (await assocModel.getColumns())?.find(
            c => c.column_name === parentCn
          );
          const childCol = (await assocModel.getColumns())?.find(
            c => c.column_name === childCn
          );

          await createHmAndBtColumn(
            assocModel,
            child,
            childCol,
            null,
            null,
            true
          );
          await createHmAndBtColumn(
            assocModel,
            parent,
            parentCol,
            null,
            null,
            true
          );

          await Column.insert({
            title: getUniqueColumnAliasName(
              await child.getColumns(),
              `${child.title}MMList`
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
            fk_related_model_id: parent.id
          });
          await Column.insert({
            title: getUniqueColumnAliasName(
              await parent.getColumns(),
              req.body.title ?? `${parent.title}MMList`
            ),

            uidt: UITypes.LinkToAnotherRecord,
            type: 'mm',

            fk_model_id: parent.id,

            fk_child_column_id: parentPK.id,
            fk_parent_column_id: childPK.id,

            fk_mm_model_id: assocModel.id,
            fk_mm_child_column_id: parentCol.id,
            fk_mm_parent_column_id: childCol.id,
            fk_related_model_id: child.id
          });
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
        fk_model_id: table.id
      });

      break;
    default:
      {
        colBody = getColumnPropsFromUIDT(colBody, base);
        const tableUpdateBody = {
          ...table,
          tn: table.table_name,
          originalColumns: table.columns.map(c => ({
            ...c,
            cn: c.column_name
          })),
          columns: [
            ...table.columns.map(c => ({ ...c, cn: c.column_name })),
            {
              ...colBody,
              cn: colBody.column_name,
              altered: Altered.NEW_COLUMN
            }
          ]
        };

        const sqlMgr = await ProjectMgrv2.getSqlMgr({ id: base.project_id });
        await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);
        await Column.insert({
          ...colBody,
          fk_model_id: table.id
        });
      }
      break;
  }

  await table.getColumns();

  Audit.insert({
    project_id: base.project_id,
    op_type: AuditOperationTypes.TABLE_COLUMN,
    op_sub_type: AuditOperationSubTypes.CREATED,
    user: (req as any)?.user?.email,
    description: `created column ${colBody.column_name} with alias ${colBody.title} from table ${table.table_name}`,
    ip: (req as any).clientIp
  }).then(() => {});

  Tele.emit('evt', { evt_type: 'column:created' });

  res.json(table);
}

export async function columnSetAsPrimary(req: Request, res: Response) {
  res.json(
    await Model.updatePrimaryColumn(req.params.tableId, req.params.columnId)
  );
}

export async function columnUpdate(req: Request, res: Response<TableType>) {
  const table = await Model.getWithInfo({
    id: req.params.tableId
  });
  const base = await Base.get(table.base_id);

  if (
    !isVirtualCol(req.body) &&
    !(await Column.checkTitleAvailable({
      column_name: req.body.column_name,
      fk_model_id: req.params.tableId,
      exclude_id: req.params.columnId
    }))
  ) {
    NcError.badRequest('Duplicate column name');
  }
  if (
    !(await Column.checkAliasAvailable({
      title: req.body.title,
      fk_model_id: req.params.tableId,
      exclude_id: req.params.columnId
    }))
  ) {
    NcError.badRequest('Duplicate column alias');
  }

  const column = table.columns.find(c => c.id === req.params.columnId);
  let colBody = req.body;
  if (
    [
      UITypes.Lookup,
      UITypes.Rollup,
      UITypes.LinkToAnotherRecord,
      UITypes.Formula,
      UITypes.ForeignKey
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
          ...colBody
        });
      } else if (colBody.title !== column.title) {
        await Column.updateAlias(req.params.columnId, {
          title: colBody.title
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
      UITypes.ForeignKey
    ].includes(colBody.uidt)
  ) {
    NcError.notImplemented(
      `Updating ${colBody.uidt} => ${colBody.uidt} is not implemented`
    );
  } else {
    colBody = getColumnPropsFromUIDT(colBody, base);
    const tableUpdateBody = {
      ...table,
      tn: table.table_name,
      originalColumns: table.columns.map(c => ({
        ...c,
        cn: c.column_name,
        cno: c.column_name
      })),
      columns: table.columns.map(c => {
        if (c.id === req.params.columnId) {
          return {
            ...c,
            ...colBody,
            cn: colBody.column_name,
            cno: c.column_name,
            altered: Altered.UPDATE_COLUMN
          };
        } else {
          (c as any).cn = c.column_name;
        }
        return c;
      })
    };

    const sqlMgr = await ProjectMgrv2.getSqlMgr({ id: base.project_id });
    await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);

    await Column.update(req.params.columnId, {
      ...colBody
    });
  }
  Audit.insert({
    project_id: base.project_id,
    op_type: AuditOperationTypes.TABLE_COLUMN,
    op_sub_type: AuditOperationSubTypes.UPDATED,
    user: (req as any)?.user?.email,
    description: `updated column ${column.column_name} with alias ${column.title} from table ${table.table_name}`,
    ip: (req as any).clientIp
  }).then(() => {});

  await table.getColumns();
  Tele.emit('evt', { evt_type: 'column:updated' });

  res.json(table);
}

export async function columnDelete(req: Request, res: Response<TableType>) {
  const table = await Model.getWithInfo({
    id: req.params.tableId
  });
  const base = await Base.get(table.base_id);

  // const ncMeta = await Noco.ncMeta.startTransaction();
  // const sqlMgr = await ProjectMgrv2.getSqlMgrTrans(
  //   { id: base.project_id },
  //   ncMeta,
  //   base
  // );

  const sqlMgr = await ProjectMgrv2.getSqlMgr({ id: base.project_id });

  // try {
  const column: Column = table.columns.find(c => c.id === req.params.columnId);

  switch (column.uidt) {
    case UITypes.Lookup:
    case UITypes.Rollup:
    case UITypes.Formula:
      await Column.delete(req.params.columnId);
      break;
    case UITypes.LinkToAnotherRecord:
      {
        const relationColOpt = await column.getColOptions<
          LinkToAnotherRecordColumn
        >();
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
                sqlMgr
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
                  base
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
                  base
                  // ncMeta
                },
                true
              );

              const columnsInRelatedTable: Column[] = await relationColOpt
                .getRelatedTable()
                .then(m => m.getColumns());
              let columnInRelatedTable: Column;

              for (const c of columnsInRelatedTable) {
                if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
                const colOpt = await c.getColOptions<
                  LinkToAnotherRecordColumn
                >();
                if (
                  colOpt.fk_parent_column_id === childColumn.id &&
                  colOpt.fk_child_column_id === parentColumn.id &&
                  colOpt.type === 'mm' &&
                  colOpt.fk_mm_model_id === mmTable.id &&
                  colOpt.fk_mm_parent_column_id === mmChildCol.id &&
                  colOpt.fk_mm_child_column_id === mmParentCol.id
                ) {
                  columnInRelatedTable = c;
                  break;
                }
              }

              await Column.delete(relationColOpt.fk_column_id);
              await Column.delete(columnInRelatedTable.id);

              await mmTable.getColumns();

              // ignore deleting table if it have more than 2 columns
              if (mmTable.columns.length === 2) {
                await sqlMgr.sqlOpPlus(base, 'tableDelete', mmTable);
              }
            }
            break;
        }
      }
      Tele.emit('evt', { evt_type: 'raltion:deleted' });
      break;
    case UITypes.ForeignKey:
      NcError.notImplemented();
      break;
    default: {
      const tableUpdateBody = {
        ...table,
        tn: table.table_name,
        originalColumns: table.columns.map(c => ({
          ...c,
          cn: c.column_name,
          cno: c.column_name
        })),
        columns: table.columns.map(c => {
          if (c.id === req.params.columnId) {
            return {
              ...c,
              cn: c.column_name,
              cno: c.column_name,
              altered: Altered.DELETE_COLUMN
            };
          } else {
            (c as any).cn = c.column_name;
          }
          return c;
        })
      };

      await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);

      await Column.delete(req.params.columnId);
    }
  }

  Audit.insert({
    project_id: base.project_id,
    op_type: AuditOperationTypes.TABLE_COLUMN,
    op_sub_type: AuditOperationSubTypes.DELETED,
    user: (req as any)?.user?.email,
    description: `deleted column ${column.column_name} with alias ${column.title} from table ${table.table_name}`,
    ip: (req as any).clientIp
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
  // await sqlMgr.commit();
  Tele.emit('evt', { evt_type: 'column:deleted' });

  res.json(table);
  // } catch (e) {
  //   sqlMgr.rollback();
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
    ncMeta = Noco.ncMeta
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
      parentColumn: parentColumn.column_name
      // foreignKeyName: relation.fkn
    });
  } catch (e) {
    console.log(e);
  }

  if (!relationColOpt) return;
  const columnsInRelatedTable: Column[] = await relationColOpt
    .getRelatedTable()
    .then(m => m.getColumns());
  let columnInRelatedTable: Column;
  const relType = relationColOpt.type === 'bt' ? 'hm' : 'bt';
  for (const c of columnsInRelatedTable) {
    if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
    const colOpt = await c.getColOptions<LinkToAnotherRecordColumn>();
    if (
      colOpt.fk_parent_column_id === parentColumn.id &&
      colOpt.fk_child_column_id === childColumn.id &&
      colOpt.type === relType
    ) {
      columnInRelatedTable = c;
      break;
    }
  }

  // delete virtual columns
  await Column.delete(relationColOpt.fk_column_id, ncMeta);
  await Column.delete(columnInRelatedTable.id, ncMeta);

  if (!ignoreFkDelete) {
    const cTable = await Model.getWithInfo({
      id: childTable.id
    });
    const tableUpdateBody = {
      ...cTable,
      tn: cTable.table_name,
      originalColumns: cTable.columns.map(c => ({
        ...c,
        cn: c.column_name,
        cno: c.column_name
      })),
      columns: cTable.columns.map(c => {
        if (c.id === childColumn.id) {
          return {
            ...c,
            cn: c.column_name,
            cno: c.column_name,
            altered: Altered.DELETE_COLUMN
          };
        } else {
          (c as any).cn = c.column_name;
        }
        return c;
      })
    };

    await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);
  }
  // delete foreign key column
  await Column.delete(childColumn.id, ncMeta);
};

const router = Router({ mergeParams: true });
router.post('/tables/:tableId/columns/', ncMetaAclMw(columnAdd));
router.put('/tables/:tableId/columns/:columnId', ncMetaAclMw(columnUpdate));
router.delete('/tables/:tableId/columns/:columnId', ncMetaAclMw(columnDelete));
router.post(
  '/tables/:tableId/columns/:columnId/primary',
  ncMetaAclMw(columnSetAsPrimary)
);
export default router;
