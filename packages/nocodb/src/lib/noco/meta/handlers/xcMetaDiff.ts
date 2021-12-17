import NcMetaMgr from '../NcMetaMgr';

enum XcMetaDiffType {
  TABLE_NEW = 'TABLE_NEW',
  TABLE_REMOVE = 'TABLE_REMOVE',
  TABLE_COLUMN_ADD = 'TABLE_COLUMN_ADD',
  TABLE_COLUMN_TYPE_CHANGE = 'TABLE_COLUMN_TYPE_CHANGE',
  TABLE_COLUMN_REMOVE = 'TABLE_COLUMN_REMOVE',
  TABLE_RELATION_ADD = 'TABLE_RELATION_ADD',
  TABLE_RELATION_REMOVE = 'TABLE_RELATION_REMOVE',
  TABLE_VIRTUAL_RELATION_ADD = 'TABLE_VIRTUAL_RELATION_ADD',
  TABLE_VIRTUAL_RELATION_DELETE = 'TABLE_VIRTUAL_RELATION_DELETE'
}

interface NcMetaDiff {
  tn: string;
  detectedChanges: Array<{
    type: XcMetaDiffType;
    msg?: string;
    [key: string]: any;
  }>;
}

// @ts-ignore
export default async function(
  this: NcMetaMgr,
  { args }: { args: any; req: any }
): Promise<Array<NcMetaDiff>> {
  const changes = [];

  // @ts-ignore
  const sqlClient = this.projectGetSqlClient(args);

  // @ts-ignore
  const tableList = (await sqlClient.tableList())?.data?.list;

  // @ts-ignore
  const oldMetas = (
    await this.xcMeta.metaList(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_models',
      { condition: { type: 'table' } }
    )
  ).map(m => JSON.parse(m.meta));

  for (const table of tableList) {
    if (table.tn === 'nc_evolutions') continue;

    const oldMetaIdx = oldMetas.findIndex(m => m.tn === table.tn);

    // new table
    if (oldMetaIdx === -1) {
      changes.push({
        tn: table.tn,
        detectedChanges: [
          {
            type: XcMetaDiffType.TABLE_NEW,
            msg: `New table`
          }
        ]
      });
      continue;
    }

    const oldMeta = oldMetas[oldMetaIdx];
    oldMetas.splice(oldMetaIdx, 1);

    const tableProp = {
      tn: table.tn,
      detectedChanges: []
    };
    changes.push(tableProp);

    // check for column change
    const columnList = (await sqlClient.columnList({ tn: table.tn }))?.data
      ?.list;

    for (const column of columnList) {
      const oldColIdx = oldMeta.columns.findIndex(c => c.cn === column.cn);

      // new table
      if (oldColIdx === -1) {
        tableProp.detectedChanges.push({
          type: XcMetaDiffType.TABLE_COLUMN_ADD,
          msg: `New column(${column.cn})`,
          cn: column.cn
        });
        continue;
      }

      const oldCol = oldMeta.columns[oldColIdx];
      oldMeta.columns.splice(oldColIdx, 1);

      if (oldCol.dt !== column.dt) {
        tableProp.detectedChanges.push({
          type: XcMetaDiffType.TABLE_COLUMN_TYPE_CHANGE,
          msg: `Column type changed(${column.cn})`,
          cn: oldCol.cn
        });
      }
    }
    for (const { cn } of oldMeta.columns) {
      tableProp.detectedChanges.push({
        type: XcMetaDiffType.TABLE_COLUMN_REMOVE,
        msg: `Column removed(${cn})`,
        cn
      });
    }
  }

  for (const { tn } of oldMetas) {
    changes.push({
      tn: tn,
      detectedChanges: [
        {
          type: XcMetaDiffType.TABLE_REMOVE,
          msg: `Table removed`
        }
      ]
    });
  }

  // @ts-ignore
  const relationList = (await sqlClient.relationListAll())?.data?.list;

  // todo: handle virtual
  const oldRelations = await this.xcMeta.metaList(
    this.getProjectId(args),
    this.getDbAlias(args),
    'nc_relations',
    {
      condition: {
        type: 'real'
      }
    }
  );

  // check relations
  for (const rel of relationList) {
    const oldRelIdx = oldRelations.findIndex(oldRel => {
      return (
        rel.tn === oldRel.tn &&
        rel.rtn === oldRel.rtn &&
        rel.cn === oldRel.cn &&
        rel.rcn === oldRel.rcn
      );
    });

    // new table
    if (oldRelIdx === -1) {
      changes
        .find(t => t.tn === rel.tn)
        ?.detectedChanges.push({
          type: XcMetaDiffType.TABLE_RELATION_ADD,
          tn: rel.tn,
          rtn: rel.rtn,
          cn: rel.cn,
          rcn: rel.rcn,
          msg: `New relation added`
        });
      changes
        .find(t => t.tn === rel.rtn)
        ?.detectedChanges.push({
          type: XcMetaDiffType.TABLE_RELATION_ADD,
          tn: rel.tn,
          rtn: rel.rtn,
          cn: rel.cn,
          rcn: rel.rcn,
          msg: `New relation added`
        });
      continue;
    }
    oldRelations.splice(oldRelIdx, 1);
  }

  for (const oldRel of oldRelations) {
    changes
      .find(t => t.tn === oldRel.tn)
      ?.detectedChanges.push({
        type: XcMetaDiffType.TABLE_RELATION_REMOVE,
        tn: oldRel.tn,
        rtn: oldRel.rtn,
        cn: oldRel.cn,
        rcn: oldRel.rcn,
        msg: `Relation removed`
      });
    changes
      .find(t => t.tn === oldRel.rtn)
      ?.detectedChanges.push({
        type: XcMetaDiffType.TABLE_RELATION_REMOVE,
        tn: oldRel.tn,
        rtn: oldRel.rtn,
        cn: oldRel.cn,
        rcn: oldRel.rcn,
        msg: `Relation removed`
      });
  }

  return changes;
}
export { XcMetaDiffType, NcMetaDiff };
