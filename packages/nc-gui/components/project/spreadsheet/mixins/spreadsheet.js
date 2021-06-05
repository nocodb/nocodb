export default {
  data: () => ({
    viewStatus: {},
    showSystemFields: false,
    fieldFilter: '',
    filtersKey: 0,
    filters: [],
    sortList: [],
    showFields: {},
    // fieldList: [],
    meta: {},
    data: [],
  }),
  methods: {
    mapFieldsAndShowFields() {
      // this.fieldList = this.availableColumns.map(c => c._cn);
      this.showFields = this.fieldList.reduce((obj, k) => {
        obj[k] = k in this.showFields ? this.showFields[k] : true;
        return obj;
      }, {});
    },
    syncDataDebounce() {
      // not implemented
    },
    onKeyDown(e) {
      if (this.selected.col === null || this.selected.row === null) return;
      switch (e.keyCode) {
        // left
        case 37:
          if (this.selected.col > 0) this.selected.col--;
          break;
        // right
        case 39:
          if (this.selected.col < this.colLength - 1) this.selected.col++;
          break;
        // up
        case 38:
          if (this.selected.row > 0) this.selected.row--;
          break;
        // down
        case 40:
          if (this.selected.row < this.rowLength - 1) this.selected.row++;
          break;
        // enter
        case 13:
          this.makeEditable(this.selected.col, this.selected.row)
          break;
      }
    },
  },
  computed: {
    isLocked() {
      return this.viewStatus && this.viewStatus.type === 'locked'
    },
    fieldList() {
      return this.availableColumns.map(c => {
        return c._cn;
      })
    },
    availableColumns() {
      let columns = [];
      // todo: generate hideCols based on default values
      const hideCols = ['created_at', 'updated_at'];

      if (this.showSystemFields) {
        columns = this.meta.columns || [];
      } else if (this.data && this.data.length) {
        // c._cn in this.data[0].row &&
        columns = (this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.cn))) || [];
      } else {
        columns = (this.meta && this.meta.columns && this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.cn))) || [];
      }


      if (this.fieldsOrder.length) {
        return [...columns].sort((c1, c2) => {
          const i1 = this.fieldsOrder.indexOf(c1._cn);
          const i2 = this.fieldsOrder.indexOf(c2._cn);
          return (i1 === -1 ? Infinity : i1) - (i2 === -1 ? Infinity : i2)
        })
      }

      return columns;
    },
    concatenatedXWhere() {
      let where = '';
      if (this.searchField && this.searchQuery.trim()) {
        if (['text', 'string'].includes(this.sqlUi.getAbstractType(this.availableColumns.find(({_cn}) => _cn === this.searchField) || this.availableColumns[0]))) {
          where = `(${this.searchField},like,%${this.searchQuery.trim()}%)`
        } else {
          where = `(${this.searchField},eq,${this.searchQuery.trim()})`
        }
      }

      if (!where) {
        return this.xWhere;
      }

      return this.xWhere ? where + `~and(${this.xWhere})` : where;
    },
    queryParams() {
      return {
        limit: this.size,
        offset: this.size * (this.page - 1),
        where: this.concatenatedXWhere,
        sort: this.sort
      }
    }, colLength() {
      return (this.availableColumns && this.availableColumns.length) || 0
    },
    visibleColLength() {
      return (this.availableColumns && this.availableColumns.length) || 0
    },
    rowLength() {
      return (this.data && this.data.length) || 0
    }, edited() {
      return this.data && this.data.some(r => r.rowMeta && (r.rowMeta.new || r.rowMeta.changed))
    },
    hasMany() {
      // todo: use cn alias
      return this.meta && this.meta.hasMany ? this.meta.hasMany.reduce((hm, o) => {
        const _rcn = this.meta.columns.find(c => c.cn === o.rcn)._cn
        hm[_rcn] = hm[_rcn] || [];
        hm[_rcn].push(o);
        return hm;
      }, {}) : {};
    },
    haveHasManyrelation() {
      return !!Object.keys(this.hasMany).length;
    },
    belongsTo() {
      return this.meta && this.meta.belongsTo ? this.meta.belongsTo.reduce((bt, o) => {
        const _cn = this.meta.columns.find(c => c.cn === o.cn)._cn
        bt[_cn] = o;
        return bt;
      }, {}) : {};
    },
    table() {

      if (this.relationType === 'hm') {
        return this.relation.tn;
      } else if (this.relationType === 'bt') {
        return this.relation.rtn;
      }

      return this.nodes.tn || this.nodes.view_name
    },
    primaryValueColumn() {
      if (!this.meta || !this.availableColumns || !this.availableColumns.length) return '';
      return (this.availableColumns.find(col => col.pv) || {_cn: ''})._cn;
    },
  },
  watch: {
    'viewStatus.type': function () {
      if (!this.loadingMeta || !this.loadingData)
        this.syncDataDebounce(this);
    },
    showFields: {
      handler(v) {
        if (!this.loadingMeta || !this.loadingData)
          this.syncDataDebounce(this);
      },
      deep: true
    },
    fieldsOrder: {
      handler(v) {
        if (!this.loadingMeta || !this.loadingData)
          this.syncDataDebounce(this);
      },
      deep: true
    }, filters: {
      async handler(filter) {
        let defaultQuery = '';
        let j = 0;
        const xWhere = filter.reduce((condition, filt, k) => {

          if (filt.readOnly) {
            defaultQuery += `(${filt.field},eq,${filt.value})`
            j++;
            return condition;
          }
          let i = k - j;

          if (i && !filt.logicOp) {
            return condition;
          }
          if (!(filt.field && filt.op)) {
            return condition;
          }

          condition += (i ? `~${filt.logicOp}` : '');
          switch (filt.op) {
            case 'is equal':
              return condition + `(${filt.field},eq,${filt.value})`;
            case 'is not equal':
              return condition + `~not(${filt.field},eq,${filt.value})`;
            case 'is like':
              return condition + `(${filt.field},like,%${filt.value}%)`;
            case 'is not like':
              return condition + `~not(${filt.field},like,%${filt.value}%)`;
            case 'is empty':
              return condition + `(${filt.field},in,)`;
            case 'is not empty':
              return condition + `~not(${filt.field},in,)`;
            case 'is null':
              return condition + `(${filt.field},is,null)`;
            case '<':
              return condition + `(${filt.field},lt,${filt.value})`;
            case '<=':
              return condition + `(${filt.field},le,${filt.value})`;
            case '>':
              return condition + `(${filt.field},gt,${filt.value})`;
            case '>=':
              return condition + `(${filt.field},ge,${filt.value})`;
          }
          return condition;

        }, '');

        this.xWhere = defaultQuery ? defaultQuery + (xWhere ? `~and(${xWhere})` : xWhere) : xWhere;

        // if (!this.progress) {
        //   await this.loadTableData();
        // }
        if (!this.loadingMeta || !this.loadingData)
          this.syncDataDebounce(this);
      },
      deep: true
    },
    sortList: {
      async handler(sortList) {
        const sort = sortList.map((sort) => {
          return sort.field ? `${sort.order}${sort.field}` : '';
        }).filter(Boolean).join(',');
        this.sort = sort;
        // if (!this.progress) {
        //   await this.loadTableData();
        // }
        if (!this.loadingMeta || !this.loadingData)
          this.syncDataDebounce(this);
      },
      deep: true
    },
    columnsWidth() {
      if (!this.loadingMeta || !this.loadingData)
        this.syncDataDebounce(this);
    },
    sort(n, o) {
      if (o !== n) {
        this.loadTableData();
      }
    },
    concatenatedXWhere(n, o) {
      if (o !== n) {
        this.loadTableData();
      }
    }
  }
}
