export default {
  props: {
    disabledColumns: {
      type: Object,
      default() {
        return {}
      }
    },
    sqlUi: [Object, Function],
    nodes: [Object],
    api: [Object]
  },
  methods: {
    isValid(_columnObj, rowObj, required = false) {
      if (!this.meta) { return }
      let columnObj = _columnObj
      if (columnObj.bt) {
        columnObj = this.meta.columns.find(c => c.cn === columnObj.bt.cn)
      }
      return ((required || columnObj.rqd) &&
        (rowObj[columnObj._cn] === undefined || rowObj[columnObj._cn] === null) &&
        !columnObj.default)
    },
    isRequired(_columnObj, rowObj, required = false) {
      let columnObj = _columnObj
      if (columnObj.bt) {
        columnObj = this.meta.columns.find(c => c.cn === columnObj.bt.cn)
      }
      return ((required || columnObj.rqd) &&
        !columnObj.default)
    }
  }
}
