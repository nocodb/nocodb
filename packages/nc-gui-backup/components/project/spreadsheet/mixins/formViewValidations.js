export default {
  props: {
    disabledColumns: {
      type: Object,
      default() {
        return {}
      }
    },
    meta: Object,
    sqlUi: [Object, Function],
    nodes: [Object],
    api: [Object]
  },
  methods: {
    isValid(_columnObj, rowObj, required = false) {
      let columnObj = _columnObj
      if (columnObj.bt) {
        columnObj = this.meta.columns.find(c => c.column_name === columnObj.bt.column_name)
      }
      return ((required || columnObj.rqd) &&
        (rowObj[columnObj.title] === undefined || rowObj[columnObj.title] === null) &&
        !columnObj.default)
    },
    isRequired(_columnObj, rowObj, required = false) {
      let columnObj = _columnObj
      if (columnObj.bt) {
        columnObj = this.meta.columns.find(c => c.column_name === columnObj.bt.column_name)
      }
      return ((required || columnObj.rqd) &&
        !columnObj.default)
    }
  }
}
