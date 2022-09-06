import { TemplateGenerator, UITypes } from 'nocodb-sdk'
import {
  extractMultiOrSingleSelectProps,
  getCheckboxValue,
  isCheckboxType, isDecimalType, isEmailType,
  isMultiLineTextType, isUrlType
} from '~/components/import/templateParsers/parserHelpers'

const jsonTypeToUidt = {
  number: UITypes.Number,
  string: UITypes.SingleLineText,
  date: UITypes.DateTime,
  boolean: UITypes.Checkbox,
  object: UITypes.JSON
}

const extractNestedData = (obj, path) => path.reduce((val, key) => val && val[key], obj)

export default class JSONTemplateAdapter extends TemplateGenerator {
  constructor(name = 'test', data, parserConfig = {}) {
    super()
    this.config = {
      maxRowsToParse: 500,
      ...parserConfig
    }
    this.name = name
    this._jsonData = typeof data === 'string' ? JSON.parse(data) : data
    this.project = {
      title: this.name,
      tables: []
    }
    this.data = {}
  }

  async init() {
  }

  parseData() {
    this.columns = this.csv.meta.fields
    this.data = this.csv.data
  }

  getColumns() {
    return this.columns
  }

  getData() {
    return this.data
  }

  get jsonData() {
    return Array.isArray(this._jsonData) ? this._jsonData : [this._jsonData]
  }

  parse() {
    const jsonData = this.jsonData
    const tn = 'table'
    const table = { table_name: tn, ref_table_name: tn, columns: [] }

    this.data[tn] = []

    for (const col of Object.keys(jsonData[0])) {
      const columns = this._parseColumn([col], jsonData)
      table.columns.push(...columns)
    }

    if (this.config.importData) { this._parseTableData(table) }

    this.project.tables.push(table)
  }

  getTemplate() {
    return this.project
  }

  _parseColumn(path = [], jsonData = this.jsonData, firstRowVal = path.reduce((val, k) => val && val[k], this.jsonData[0])) {
    const columns = []
    // parse nested
    if (firstRowVal && typeof firstRowVal === 'object' && !Array.isArray(firstRowVal) && this.config.normalizeNested) {
      for (const key of Object.keys(firstRowVal)) {
        const normalizedNestedColumns = this._parseColumn([...path, key], this.jsonData, firstRowVal[key])
        columns.push(...normalizedNestedColumns)
      }
    } else {
      const cn = path.join('_').replace(/\W/g, '_').trim()

      const column = {
        column_name: cn,
        ref_column_name: cn,
        path
      }

      column.uidt = jsonTypeToUidt[typeof firstRowVal] || UITypes.SingleLineText

      const colData = jsonData.map(r => extractNestedData(r, path))
      Object.assign(column, this._getColumnUIDTAndMetas(colData, column.uidt))
      columns.push(column)
    }

    return columns
  }

  _getColumnUIDTAndMetas(colData, defaultType) {
    const colProps = { uidt: defaultType }
    // todo: optimize
    if (colProps.uidt === UITypes.SingleLineText) {
      // check for long text
      if (isMultiLineTextType(colData)) {
        colProps.uidt = UITypes.LongText
      } if (isEmailType(colData)) {
        colProps.uidt = UITypes.Email
      } if (isUrlType(colData)) {
        colProps.uidt = UITypes.URL
      } else {
        const checkboxType = isCheckboxType(colData)
        if (checkboxType.length === 1) {
          colProps.uidt = UITypes.Checkbox
        } else {
          Object.assign(colProps, extractMultiOrSingleSelectProps(colData))
        }
      }
    } else if (colProps.uidt === UITypes.Number) {
      if (isDecimalType(colData)) {
        colProps.uidt = UITypes.Decimal
      }
    }
    return colProps
  }

  _parseTableData(tableMeta) {
    for (const row of this.jsonData) {
      const rowData = {}
      for (let i = 0; i < tableMeta.columns.length; i++) {
        const value = extractNestedData(row, tableMeta.columns[i].path || [])
        if (tableMeta.columns[i].uidt === UITypes.Checkbox) {
          rowData[tableMeta.columns[i].ref_column_name] = getCheckboxValue(value)
        } else if (tableMeta.columns[i].uidt === UITypes.SingleSelect || tableMeta.columns[i].uidt === UITypes.MultiSelect) {
          rowData[tableMeta.columns[i].ref_column_name] = (value || '').toString().trim() || null
        } else if (tableMeta.columns[i].uidt === UITypes.JSON) {
          rowData[tableMeta.columns[i].ref_column_name] = JSON.stringify(value)
        } else {
          // toto: do parsing if necessary based on type
          rowData[tableMeta.columns[i].column_name] = value
        }
      }
      this.data[tableMeta.ref_table_name].push(rowData)
      // rowIndex++
    }
  }
}
