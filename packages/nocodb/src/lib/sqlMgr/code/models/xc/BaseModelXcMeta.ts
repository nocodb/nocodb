import BaseRender from '../../BaseRender';
import UITypes from '../../../../sqlUi/UITypes';

abstract class BaseModelXcMeta extends BaseRender {
  protected abstract _getAbstractType(column: any): any;

  protected abstract _getUIDataType(column: any): any;

  public getXcColumnsObject(args) {
    const columnsArr = [];

    for (const column of args.columns) {
      const columnObj = {
        validate: {
          func: [],
          args: [],
          msg: []
        },
        cn: column.cn,
        _cn: column._cn || column.cn,
        type: this._getAbstractType(column),
        dt: column.dt,

        uidt: column.uidt || this._getUIDataType(column),
        uip: column.uip,
        uicn: column.uicn,
        ...column
      };

      if (column.rqd) {
        columnObj.rqd = column.rqd;
      }

      if (column.cdf) {
        columnObj.default = column.cdf;
        columnObj.columnDefault = column.cdf;
      }

      if (column.un) {
        columnObj.un = column.un;
      }

      if (column.pk) {
        columnObj.pk = column.pk;
      }

      if (column.ai) {
        columnObj.ai = column.ai;
      }

      if (column.dtxp) {
        columnObj.dtxp = column.dtxp;
      }

      if (column.dtxs) {
        columnObj.dtxs = column.dtxs;
      }

      const oldColMeta = this.ctx?.oldMeta?.columns?.find(c => {
        return (
          columnObj.cn == c.cn &&
          (columnObj.type == c.type || c.dtx === 'specificType')
        );
      });

      if (oldColMeta) {
        columnObj._cn = oldColMeta._cn || columnObj._cn;
        columnObj.uidt = oldColMeta.uidt;
        columnObj.validate = oldColMeta.validate || columnObj.validate
        if (
          (columnObj.dtxp === UITypes.MultiSelect ||
            columnObj.dtxp === UITypes.SingleSelect) &&
          columnObj.dt !== 'set' &&
          columnObj.dt !== 'enum'
        ) {
          columnObj.dtxp = columnObj.dtxp || oldColMeta.dtxp;
        }
      }

      columnsArr.push(columnObj);
    }
    this.mapDefaultPrimaryValue(columnsArr);
    return columnsArr;
  }

  public getObject() {
    return {
      tn: this.ctx.tn,
      _tn: this.ctx._tn,
      columns: this.getXcColumnsObject(this.ctx),
      pks: [],
      hasMany: this.ctx.hasMany,
      belongsTo: this.ctx.belongsTo,
      db_type: this.ctx.db_type,
      type: this.ctx.type,

      v: this.getVitualColumns()
    };
  }

  public findOldVirtualColumnName(relation, type: 'hm' | 'bt') {
    const oldVirtualCols = this.ctx?.oldMeta?.v;
    if (!oldVirtualCols) return;

    return oldVirtualCols.find(
      v =>
        v?.[type]?.rtn === relation?.rtn &&
        v?.[type]?.tn === relation?.tn &&
        v?.[type]?.cn === relation?.cn
    )?._cn;
  }

  public suffixRelationNumber(_cn, cn) {
    const cnRegex = /[\w]+(\d)+$/;
    const matches = cnRegex.exec(cn);
    if (matches) _cn = _cn + ' ' + matches[1];
    return _cn;
  }

  public getVitualColumns(): any[] {
    const virtualColumns = [
      ...(this.ctx.hasMany || []).map(hm => {
        return {
          hm,
          _cn:
            this.findOldVirtualColumnName(hm, 'hm') ||
            this.suffixRelationNumber(`${hm._rtn} => ${hm._tn}`, hm.cn)
        };
      }),
      ...(this.ctx.belongsTo || []).map(bt => {
        return {
          bt,
          _cn:
            this.findOldVirtualColumnName(bt, 'bt') ||
            this.suffixRelationNumber(`${bt._rtn} => ${bt._tn}`, bt.cn)
        };
      })
    ];

    const oldVirtualCols = this.ctx?.oldMeta?.v || [];

    for (const oldVCol of oldVirtualCols) {
      if (oldVCol.lk || oldVCol.rl || oldVCol.formula)
        virtualColumns.push(oldVCol);
    }

    return virtualColumns;
  }

  public mapDefaultPrimaryValue(columnsArr: any[]): void {
    // pk can be at the end

    //

    /*

      if PK is at the end of table
         if (there is a column for PV)
              make that PV
         else
              lets think
      else if (pk is not at the end of table)
         if (there is a column for PV)
              make that PV
         else
              lets think
      else if ( no pk at all)
          let's think
        */

    if (!columnsArr.some(column => column.pv)) {
      let len = columnsArr.length;
      let pkIndex = -1;

      while (len--) {
        if (columnsArr[len].pk) {
          pkIndex = len;
          break;
        }
      }

      // if PK is at the end of table
      if (pkIndex === columnsArr.length - 1) {
        if (pkIndex > 0) {
          columnsArr[pkIndex - 1].pv = true;
        }
      }
      // pk is not at the end of table
      else if (pkIndex > -1) {
        columnsArr[pkIndex + 1].pv = true;
      }
      //  no pk at all
      else {
        // todo:
      }
    }
  }
}

export default BaseModelXcMeta;
