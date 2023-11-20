import { UITypes } from 'nocodb-sdk'
import { getCheckboxValue, getColumnUIDTAndMetas } from './parserHelpers'
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
  data: Record<string, any>
  _jsonData: string | Record<string, any>
  jsonData: Record<string, any>
  base: {
    tables: Record<string, any>[]
  }

  columns: object
  constructor(data: object, parserConfig = {}, progressCallback?: (msg: string) => void) {
    super(progressCallback)
    this.config = parserConfig
    this._jsonData = data
    this.base = {
      tables: [],
    }
    this.jsonData = []
    this.data = []
    this.columns = {}
  }

  async init() {
    this.progress('Initializing json parser')
    const parsedJsonData =
      typeof this._jsonData === 'string'
        ? // for json editor
          JSON.parse(this._jsonData)
        : // for file upload
          JSON.parse(new TextDecoder().decode(this._jsonData as BufferSource))
    this.jsonData = Array.isArray(parsedJsonData) ? parsedJsonData : [parsedJsonData]
  }

  getColumns(): any {
    return this.columns
  }

  getData(): any {
    return this.data
  }

  parse(): any {
    this.progress('Parsing json data')
    const jsonData = this.jsonData
    const tn = 'table'
    const table: any = { table_name: tn, ref_table_name: tn, columns: [] }

    this.data[tn] = []

    for (const col of Object.keys(jsonData[0])) {
      const columns = this._parseColumn([col], jsonData)
      table.columns.push(...columns)
    }

    if (this.config.shouldImportData) {
      this._parseTableData(table)
    }

    this.base.tables.push(table)
  }

  getTemplate() {
    return this.base
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
        uidt: UITypes.SingleLineText,
        path,
      }
      if (this.config.autoSelectFieldTypes) {
        column.uidt = jsonTypeToUidt[typeof firstRowVal] || UITypes.SingleLineText
        const colData = jsonData.map((r: any) => extractNestedData(r, path))
        Object.assign(column, getColumnUIDTAndMetas(colData, column.uidt))
      }
      columns.push(column)
    }

    return columns
  }

  _parseTableData(tableMeta: any) {
    for (const row of this.jsonData as any) {
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
