import { UITypes } from 'nocodb-sdk'
import {
  extractMultiOrSingleSelectProps,
  getCheckboxValue,
  isCheckboxType,
  isDecimalType,
  isEmailType,
  isMultiLineTextType,
  isUrlType,
} from './parserHelpers'
import TemplateGenerator from './TemplateGenerator'

const jsonTypeToUidt: Record<string, string> = {
  number: UITypes.Number,
  string: UITypes.SingleLineText,
  date: UITypes.DateTime,
  boolean: UITypes.Checkbox,
  object: UITypes.JSON,
}

const extractNestedData: any = (obj: any, path: any) => path.reduce((val: any, key: any) => val && val[key], obj)

export default class JSONTemplateAdapter extends TemplateGenerator {
  config: Record<string, any>
  name: string
  _jsonData: string | object
  project: Record<string, any>
  data: Record<string, any>
  columns: object
  csv: Record<string, any>
  constructor(name = 'test', data: object, parserConfig = {}) {
    super()
    this.config = {
      maxRowsToParse: 500,
      ...parserConfig,
    }
    this.name = name
    this._jsonData = typeof data === 'string' ? JSON.parse(data) : data
    this.project = {
      title: this.name,
      tables: [],
    }
    this.columns = {}
    this.data = {}
    this.csv = {}
  }

  async init() {}

  parseData(): any {
    this.columns = this.csv.meta.fields
    this.data = this.csv.data
  }

  getColumns(): any {
    return this.columns
  }

  getData(): any {
    return this.data
  }

  get jsonData(): any {
    return Array.isArray(this._jsonData) ? this._jsonData : [this._jsonData]
  }

  parse(): any {
    const jsonData = this.jsonData
    const tn = 'table'
    const table: any = { table_name: tn, ref_table_name: tn, columns: [] }

    this.data[tn] = []

    for (const col of Object.keys(jsonData[0])) {
      const columns = this._parseColumn([col], jsonData)
      table.columns.push(...columns)
    }

    if (this.config.importData) {
      this._parseTableData(table)
    }

    this.project.tables.push(table)
  }

  getTemplate() {
    return this.project
  }

  _parseColumn(
    path: any = [],
    jsonData = this.jsonData,
    firstRowVal = path.reduce((val: any, k: any) => val && val[k], this.jsonData[0]),
  ): any {
    const columns = []
    // parse nested
    if (firstRowVal && typeof firstRowVal === 'object' && !Array.isArray(firstRowVal) && this.config.normalizeNested) {
      for (const key of Object.keys(firstRowVal)) {
        const normalizedNestedColumns = this._parseColumn([...path, key], this.jsonData, firstRowVal[key])
        columns.push(...normalizedNestedColumns)
      }
    } else {
      const cn = path.join('_').replace(/\W/g, '_').trim()

      const column: Record<string, any> = {
        column_name: cn,
        ref_column_name: cn,
        path,
      }

      column.uidt = jsonTypeToUidt[typeof firstRowVal] || UITypes.SingleLineText

      const colData = jsonData.map((r: any) => extractNestedData(r, path))
      Object.assign(column, this._getColumnUIDTAndMetas(colData, column.uidt))
      columns.push(column)
    }

    return columns
  }

  _getColumnUIDTAndMetas(colData: any, defaultType: any) {
    const colProps = { uidt: defaultType }
    // todo: optimize
    if (colProps.uidt === UITypes.SingleLineText) {
      // check for long text
      if (isMultiLineTextType(colData)) {
        colProps.uidt = UITypes.LongText
      }
      if (isEmailType(colData)) {
        colProps.uidt = UITypes.Email
      }
      if (isUrlType(colData)) {
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

  _parseTableData(tableMeta: any) {
    for (const row of this.jsonData) {
      const rowData: any = {}
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
    }
  }
}
