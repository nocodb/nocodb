import { UITypes } from 'nocodb-sdk';
import BaseRender from '../../BaseRender';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';

abstract class BaseModelXcMeta extends BaseRender {
  protected abstract _getAbstractType(column: any): any;

  public abstract getUIDataType(column: any): any;

  public getXcColumnsObject(args) {
    const columnsArr = [];

    for (const column of args.columns) {
      if (this.ctx?.belongsTo?.find((c) => c.cn === column.cn))
        column.uidt = UITypes.ForeignKey;

      const columnObj = {
        validate: {
          func: [],
          args: [],
          msg: [],
        },
        column_name: column.cn || column.column_name,
        title: column._cn || column.cn || column.column_name || column.title,
        type: this._getAbstractType(column),
        dt: column.dt,

        uidt: column.uidt || this.getUIDataType(column),
        uip: column.uip,
        uicn: column.uicn,
        ...column,
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

      const oldColMeta = this.ctx?.oldMeta?.columns?.find((c) => {
        return columnObj.cn == c.cn && columnObj.type == c.type;
      });

      if (oldColMeta) {
        columnObj._cn = oldColMeta._cn || columnObj._cn;
        columnObj.uidt = oldColMeta.uidt;
        if (
          (columnObj.uidt === UITypes.MultiSelect ||
            columnObj.uidt === UITypes.SingleSelect) &&
          columnObj.dt !== 'set' &&
          columnObj.dt !== 'enum'
        ) {
          columnObj.dtxp = columnObj.dtxp || oldColMeta.dtxp;
        }
      }

      columnsArr.push(columnObj);
    }
    this.mapDefaultDisplayValue(columnsArr);
    return columnsArr;
  }

  protected renderXcHasMany(args) {
    return JSON.stringify(args.hasMany);
  }

  protected renderXcBelongsTo(args) {
    return JSON.stringify(args.belongsTo);
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
      v: this.getVirtualColumns(),
    };
  }

  public getVirtualColumns(): any[] {
    // todo: handle duplicate relation
    const virtualColumns = [
      ...(this.ctx.hasMany || []).map((hm) => {
        return {
          uidt: UITypes.LinkToAnotherRecord,
          type: 'hm',
          hm,
          _cn: `${hm._tn}List`,
        };
      }),
      ...(this.ctx.belongsTo || []).map((bt) => ({
        uidt: UITypes.LinkToAnotherRecord,
        type: 'bt',
        bt,
        _cn: `${bt._rtn}Read`,
      })),
    ];

    const oldVirtualCols = this.ctx?.oldMeta?.v || [];

    for (const oldVCol of oldVirtualCols) {
      if (oldVCol.lk || oldVCol.rl || oldVCol.formula)
        virtualColumns.push(oldVCol);
    }

    return virtualColumns;
  }

  public mapDefaultDisplayValue(columnsArr: any[]): void {
    mapDefaultDisplayValue(columnsArr);
  }

  /**
   *
   * @param args
   * @param args.columns
   * @param args.relations
   * @returns {string}
   * @private
   */
  protected renderXcColumns(args) {
    let str = '[\r\n';

    for (let i = 0; i < args.columns.length; ++i) {
      str += `{\r\n`;
      str += `cn: '${args.columns[i].cn}',\r\n`;
      str += `type: '${this._getAbstractType(args.columns[i])}',\r\n`;
      str += `dt: '${args.columns[i].dt}',\r\n`;
      if (args.columns[i].rqd) str += `rqd: ${args.columns[i].rqd},\r\n`;

      if (args.columns[i].cdf) {
        str += `default: "${args.columns[i].cdf}",\r\n`;
        str += `columnDefault: "${args.columns[i].cdf}",\r\n`;
      }

      if (args.columns[i].un) str += `un: ${args.columns[i].un},\r\n`;

      if (args.columns[i].pk) str += `pk: ${args.columns[i].pk},\r\n`;

      if (args.columns[i].ai) str += `ai: ${args.columns[i].ai},\r\n`;

      if (args.columns[i].dtxp) str += `dtxp: "${args.columns[i].dtxp}",\r\n`;

      if (args.columns[i].dtxs) str += `dtxs: ${args.columns[i].dtxs},\r\n`;

      str += `validate: {
                func: [],
                args: [],
                msg: []
              },`;
      str += `},\r\n`;
    }

    str += ']\r\n';

    return str;
  }
}

export default BaseModelXcMeta;
