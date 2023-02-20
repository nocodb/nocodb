import NcMetaMgr from '../NcMetaMgr';

enum XcMetaDiffType {
  TABLE_NEW = 'TABLE_NEW',
  TABLE_REMOVE = 'TABLE_REMOVE',
  TABLE_COLUMN_ADD = 'TABLE_COLUMN_ADD',
  TABLE_COLUMN_TYPE_CHANGE = 'TABLE_COLUMN_TYPE_CHANGE',
  TABLE_COLUMN_REMOVE = 'TABLE_COLUMN_REMOVE',
  VIEW_NEW = 'VIEW_NEW',
  VIEW_REMOVE = 'VIEW_REMOVE',
  VIEW_COLUMN_ADD = 'VIEW_COLUMN_ADD',
  VIEW_COLUMN_TYPE_CHANGE = 'VIEW_COLUMN_TYPE_CHANGE',
  VIEW_COLUMN_REMOVE = 'VIEW_COLUMN_REMOVE',
  TABLE_RELATION_ADD = 'TABLE_RELATION_ADD',
  TABLE_RELATION_REMOVE = 'TABLE_RELATION_REMOVE',
  TABLE_VIRTUAL_RELATION_ADD = 'TABLE_VIRTUAL_RELATION_ADD',
  TABLE_VIRTUAL_RELATION_REMOVE = 'TABLE_VIRTUAL_RELATION_REMOVE',
  TABLE_VIRTUAL_M2M_REMOVE = 'TABLE_VIRTUAL_M2M_REMOVE',
}

enum XcMetaType {
  TABLE = 'table',
  VIEW = 'view',
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
export default async function (
  this: NcMetaMgr,
  { args }: { args: any; req: any }
): Promise<Array<NcMetaDiff>> {
  const changes = [];

  const builder = this.getBuilder(args);

  // @ts-ignore
  const sqlClient = await this.projectGetSqlClient(args);

  // @ts-ignore
  const tableList = (await sqlClient.tableList())?.data?.list?.filter((t) => {
    if (builder?.prefix) {
      return t.tn?.startsWith(builder?.prefix);
    }
    return true;
  }); // @ts-ignore

  const colListRef = {};
  // @ts-ignore
  const oldMetas = (
    await this.xcMeta.metaList(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_models',
      {
        condition: { type: 'table' },
      }
    )
  ).map((m) => JSON.parse(m.meta));

  // @ts-ignore
  const relationList = (await sqlClient.relationListAll())?.data?.list;

  for (const table of tableList) {
    if (table.tn === 'nc_evolutions') continue;

    const oldMetaIdx = oldMetas.findIndex((m) => m.tn === table.tn);

    // new table
    if (oldMetaIdx === -1) {
      changes.push({
        tn: table.tn,
        type: XcMetaType.TABLE,
        detectedChanges: [
          {
            type: XcMetaDiffType.TABLE_NEW,
            msg: `New table`,
          },
        ],
      });
      continue;
    }

    const oldMeta = oldMetas[oldMetaIdx];
    oldMetas.splice(oldMetaIdx, 1);

    const tableProp = {
      _tn: oldMeta._tn,
      tn: table.tn,
      type: XcMetaType.TABLE,
      detectedChanges: [],
    };
    changes.push(tableProp);

    // check for column change
    colListRef[table.tn] = (
      await sqlClient.columnList({ tn: table.tn })
    )?.data?.list;

    for (const column of colListRef[table.tn]) {
      const oldColIdx = oldMeta.columns.findIndex((c) => c.cn === column.cn);

      // new table
      if (oldColIdx === -1) {
        tableProp.detectedChanges.push({
          type: XcMetaDiffType.TABLE_COLUMN_ADD,
          msg: `New column(${column.cn})`,
          cn: column.cn,
        });
        continue;
      }

      const oldCol = oldMeta.columns[oldColIdx];
      oldMeta.columns.splice(oldColIdx, 1);

      if (oldCol.dt !== column.dt) {
        tableProp.detectedChanges.push({
          type: XcMetaDiffType.TABLE_COLUMN_TYPE_CHANGE,
          msg: `Column type changed(${column.cn})`,
          cn: oldCol.cn,
        });
      }
    }
    for (const { cn } of oldMeta.columns) {
      tableProp.detectedChanges.push({
        type: XcMetaDiffType.TABLE_COLUMN_REMOVE,
        msg: `Column removed(${cn})`,
        cn,
      });
    }
    for (const vCol of oldMeta.v) {
      if (!vCol.mm) continue;

      // check related tables & columns

      const rTable = tableList.find((t) => t.tn === vCol.mm?.rtn);
      const m2mTable = tableList.find((t) => t.tn === vCol.mm?.vtn);

      if (!rTable) {
        tableProp.detectedChanges.push({
          ...vCol,
          type: XcMetaDiffType.TABLE_VIRTUAL_M2M_REMOVE,
          msg: `Many to many removed(${vCol.mm?.rtn} removed)`,
        });
        continue;
      }
      if (!m2mTable) {
        tableProp.detectedChanges.push({
          ...vCol,
          type: XcMetaDiffType.TABLE_VIRTUAL_M2M_REMOVE,
          msg: `Many to many removed(${vCol.mm?.vtn} removed)`,
        });
        continue;
      }

      // verify columns

      const pColumns = (colListRef[vCol.mm.tn] =
        colListRef[vCol.mm.tn] ||
        (await sqlClient.columnList({ tn: vCol.mm.tn }))?.data?.list);

      const cColumns = (colListRef[vCol.mm.rtn] =
        colListRef[vCol.mm.rtn] ||
        (await sqlClient.columnList({ tn: vCol.mm.rtn }))?.data?.list);

      const vColumns = (colListRef[vCol.mm.vtn] =
        colListRef[vCol.mm.vtn] ||
        (await sqlClient.columnList({ tn: vCol.mm.vtn }))?.data?.list);

      if (
        pColumns.every((c) => c.cn !== vCol.mm.cn) ||
        cColumns.every((c) => c.cn !== vCol.mm.rcn) ||
        vColumns.every((c) => c.cn !== vCol.mm.vcn) ||
        vColumns.every((c) => c.cn !== vCol.mm.vrcn)
      ) {
        tableProp.detectedChanges.push({
          ...vCol,
          type: XcMetaDiffType.TABLE_VIRTUAL_M2M_REMOVE,
          msg: `Many to many removed(One of the relation column removed)`,
        });
        continue;
      }
    }
  }

  for (const { tn } of oldMetas) {
    changes.push({
      tn: tn,
      type: XcMetaType.TABLE,
      detectedChanges: [
        {
          type: XcMetaDiffType.TABLE_REMOVE,
          msg: `Table removed`,
        },
      ],
    });
  }

  // @ts-ignore
  const viewList = (await sqlClient.viewList())?.data?.list
    ?.map((v) => {
      v.type = 'view';
      v.tn = v.view_name;
      return v;
    })
    .filter((t) => {
      if (builder?.prefix) {
        return t.tn?.startsWith(builder?.prefix);
      }
      return true;
    }); // @ts-ignore

  const oldViewMetas = (
    await this.xcMeta.metaList(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_models',
      {
        condition: { type: 'view' },
      }
    )
  ).map((m) => JSON.parse(m.meta));

  for (const view of viewList) {
    const oldViewMetaIdx = oldViewMetas.findIndex((m) => m.tn === view.tn);

    // new table
    if (oldViewMetaIdx === -1) {
      changes.push({
        tn: view.tn,
        type: XcMetaType.VIEW,
        detectedChanges: [
          {
            type: XcMetaDiffType.VIEW_NEW,
            msg: `New view`,
          },
        ],
      });
      continue;
    }

    const oldViewMeta = oldViewMetas[oldViewMetaIdx];
    oldViewMetas.splice(oldViewMetaIdx, 1);

    const viewProp = {
      tn: view.tn,
      type: XcMetaType.VIEW,
      detectedChanges: [],
    };
    changes.push(viewProp);

    // check for column change
    colListRef[view.tn] = (
      await sqlClient.columnList({ tn: view.tn })
    )?.data?.list;

    for (const column of colListRef[view.tn]) {
      const oldColIdx = oldViewMeta.columns.findIndex(
        (c) => c.cn === column.cn
      );

      // new table
      if (oldColIdx === -1) {
        viewProp.detectedChanges.push({
          type: XcMetaDiffType.VIEW_COLUMN_ADD,
          msg: `New column(${column.cn})`,
          cn: column.cn,
        });
        continue;
      }

      const oldCol = oldViewMeta.columns[oldColIdx];
      oldViewMeta.columns.splice(oldColIdx, 1);

      if (oldCol.dt !== column.dt) {
        viewProp.detectedChanges.push({
          type: XcMetaDiffType.VIEW_COLUMN_TYPE_CHANGE,
          msg: `Column type changed(${column.cn})`,
          cn: oldCol.cn,
        });
      }
    }
    for (const { cn } of oldViewMeta.columns) {
      viewProp.detectedChanges.push({
        type: XcMetaDiffType.VIEW_COLUMN_REMOVE,
        msg: `Column removed(${cn})`,
        cn,
      });
    }
    /*  for (const vCol of oldViewMeta.v) {
      if (!vCol.mm) continue;

      // check related tables & columns

      const rTable = tableList.find(t => t.tn === vCol.mm?.rtn);
      const m2mTable = tableList.find(t => t.tn === vCol.mm?.vtn);

      if (!rTable) {
        viewProp.detectedChanges.push({
          ...vCol,
          type: XcMetaDiffType.VIEW_VIRTUAL_M2M_REMOVE,
          msg: `Many to many removed(${vCol.mm?.rtn} removed)`
        });
        continue;
      }
      if (!m2mTable) {
        viewProp.detectedChanges.push({
          ...vCol,
          type: XcMetaDiffType.VIEW_VIRTUAL_M2M_REMOVE,
          msg: `Many to many removed(${vCol.mm?.vtn} removed)`
        });
        continue;
      }

      // verify columns

      const pColumns = (colListRef[vCol.mm.tn] =
        colListRef[vCol.mm.tn] ||
        (await sqlClient.columnList({ tn: vCol.mm.tn }))?.data?.list);

      const cColumns = (colListRef[vCol.mm.rtn] =
        colListRef[vCol.mm.rtn] ||
        (await sqlClient.columnList({ tn: vCol.mm.rtn }))?.data?.list);

      const vColumns = (colListRef[vCol.mm.vtn] =
        colListRef[vCol.mm.vtn] ||
        (await sqlClient.columnList({ tn: vCol.mm.vtn }))?.data?.list);

      if (
        pColumns.every(c => c.cn !== vCol.mm.cn) ||
        cColumns.every(c => c.cn !== vCol.mm.rcn) ||
        vColumns.every(c => c.cn !== vCol.mm.vcn) ||
        vColumns.every(c => c.cn !== vCol.mm.vrcn)
      ) {
        viewProp.detectedChanges.push({
          ...vCol,
          type: XcMetaDiffType.VIEW_VIRTUAL_M2M_REMOVE,
          msg: `Many to many removed(One of the relation column removed)`
        });
        continue;
      }
    }*/
  }

  for (const { tn } of oldViewMetas) {
    changes.push({
      tn: tn,
      type: XcMetaType.VIEW,
      detectedChanges: [
        {
          type: XcMetaDiffType.VIEW_REMOVE,
          msg: `View removed`,
        },
      ],
    });
  }

  // extract unique relations
  const oldRelations = (
    await this.xcMeta.metaList(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_relations',
      {
        condition: {
          type: 'real',
        },
      }
    )
  ).filter((r, i, arr) => {
    return (
      i ===
      arr.findIndex(
        (r1) =>
          r1.tn === r.tn &&
          r1.rtn === r.rtn &&
          r1.cn === r.cn &&
          r1.rcn === r.rcn
      )
    );
  });

  // check relations
  for (const rel of relationList) {
    const oldRelIdx = oldRelations.findIndex((oldRel) => {
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
        .find((t) => t.tn === rel.tn)
        ?.detectedChanges.push({
          type: XcMetaDiffType.TABLE_RELATION_ADD,
          tn: rel.tn,
          rtn: rel.rtn,
          cn: rel.cn,
          rcn: rel.rcn,
          msg: `New relation added`,
        });
      changes
        .find((t) => t.tn === rel.rtn)
        ?.detectedChanges.push({
          type: XcMetaDiffType.TABLE_RELATION_ADD,
          tn: rel.tn,
          rtn: rel.rtn,
          cn: rel.cn,
          rcn: rel.rcn,
          msg: `New relation added`,
        });
      continue;
    }
    oldRelations.splice(oldRelIdx, 1);
  }

  for (const oldRel of oldRelations) {
    changes
      .find((t) => t.tn === oldRel.tn)
      ?.detectedChanges.push({
        type: XcMetaDiffType.TABLE_RELATION_REMOVE,
        tn: oldRel.tn,
        rtn: oldRel.rtn,
        cn: oldRel.cn,
        rcn: oldRel.rcn,
        msg: `Relation removed`,
      });
    changes
      .find((t) => t.tn === oldRel.rtn)
      ?.detectedChanges.push({
        type: XcMetaDiffType.TABLE_RELATION_REMOVE,
        tn: oldRel.tn,
        rtn: oldRel.rtn,
        cn: oldRel.cn,
        rcn: oldRel.rcn,
        msg: `Relation removed`,
      });
  }

  const oldVirtualRelations = await this.xcMeta.metaList(
    this.getProjectId(args),
    this.getDbAlias(args),
    'nc_relations',
    {
      condition: {
        type: 'virtual',
      },
    }
  );

  // check relations
  for (const vRel of oldVirtualRelations) {
    if (tableList.every((t) => t.tn !== vRel.tn && t.tn !== vRel.rtn)) {
      changes
        .find((t) => t.tn === vRel.tn)
        ?.detectedChanges.push({
          type: XcMetaDiffType.TABLE_VIRTUAL_RELATION_REMOVE,
          tn: vRel.tn,
          rtn: vRel.rtn,
          cn: vRel.cn,
          rcn: vRel.rcn,
          msg: `Virtual relation removed`,
        });
      changes
        .find((t) => t.tn === vRel.rtn)
        ?.detectedChanges.push({
          type: XcMetaDiffType.TABLE_VIRTUAL_RELATION_REMOVE,
          tn: vRel.tn,
          rtn: vRel.rtn,
          cn: vRel.cn,
          rcn: vRel.rcn,
          msg: `Virtual relation removed`,
        });
      continue;
    }

    colListRef[vRel.tn] = (
      await sqlClient.columnList({ tn: vRel.tn })
    )?.data?.list;
    colListRef[vRel.rtn] = (
      await sqlClient.columnList({ tn: vRel.rtn })
    )?.data?.list;

    if (
      colListRef[vRel.tn].every((c) => c.cn !== vRel.cn) ||
      colListRef[vRel.rtn].every((c) => c.cn !== vRel.rcn)
    ) {
      changes
        .find((t) => t.tn === vRel.tn)
        ?.detectedChanges.push({
          type: XcMetaDiffType.TABLE_VIRTUAL_RELATION_REMOVE,
          tn: vRel.tn,
          rtn: vRel.rtn,
          cn: vRel.cn,
          rcn: vRel.rcn,
          msg: `Virtual relation column missing`,
        });
      changes
        .find((t) => t.tn === vRel.rtn)
        ?.detectedChanges.push({
          type: XcMetaDiffType.TABLE_VIRTUAL_RELATION_REMOVE,
          tn: vRel.tn,
          rtn: vRel.rtn,
          cn: vRel.cn,
          rcn: vRel.rcn,
          msg: `Virtual relation column missing`,
        });
    }

    // colListRef[table.tn]= (await sqlClient.columnList({ tn: table.tn }))?.data
    //   ?.list;
  }

  return changes;
}
export { XcMetaDiffType, NcMetaDiff };
