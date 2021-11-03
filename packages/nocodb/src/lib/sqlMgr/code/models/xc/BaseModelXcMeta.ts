import BaseRender from '../../BaseRender';

abstract class BaseModelXcMeta extends BaseRender {
  public abstract getXcColumnsObject(context: any): any[];

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

  public getVitualColumns(): any[] {
    return [
      ...(this.ctx.hasMany || []).map(hm => ({
        hm,
        _cn: `${hm._rtn} => ${hm._tn}`
      })),
      ...(this.ctx.belongsTo || []).map(bt => ({
        bt,
        _cn: `${bt._rtn} <= ${bt._tn}`
      }))
    ];
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
