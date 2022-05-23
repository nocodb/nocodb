import { RelationTypes, UITypes } from 'nocodb-sdk'

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
      if (columnObj.uidt === UITypes.LinkToAnotherRecord && columnObj.colOptions && columnObj.colOptions.type === RelationTypes.BELONGS_TO) {
        columnObj = this.meta.columns.find(c => c.id === columnObj.colOptions.fk_child_column_id)
      }
      return ((required || columnObj.rqd) &&
        (rowObj[columnObj.title] === undefined || rowObj[columnObj.title] === null) &&
        !columnObj.cdf)
    },
    isRequired(_columnObj, rowObj, required = false) {
      let columnObj = _columnObj
      if (columnObj.uidt === UITypes.LinkToAnotherRecord && columnObj.colOptions && columnObj.colOptions.type === RelationTypes.BELONGS_TO) {
        columnObj = this.meta.columns.find(c => c.id === columnObj.colOptions.fk_child_column_id)
      }

      return required || (columnObj && columnObj.rqd &&
        !columnObj.cdf)
    }
  }
}
