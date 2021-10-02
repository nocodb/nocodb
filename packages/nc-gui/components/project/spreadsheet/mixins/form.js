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
    isRequired(_columnObj, rowObj) {
      let columnObj = _columnObj
      if (columnObj.bt) {
        columnObj = this.meta.columns.find(c => c.cn === columnObj.bt.cn)
      }
      return (columnObj.rqd &&
        (rowObj[columnObj._cn] === undefined || rowObj[columnObj._cn] === null) &&
        !columnObj.default)
    }
  }
}
