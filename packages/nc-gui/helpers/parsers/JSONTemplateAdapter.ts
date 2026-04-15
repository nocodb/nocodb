import { UITypes } from 'nocodb-sdk'
import { getCheckboxValue, getColumnUIDTAndMetas } from './parserHelpers'
import TemplateGenerator, { type ProgressMessageType } from './TemplateGenerator'

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
  constructor(data: object, parserConfig = {}, progressCallback?: (msg: ProgressMessageType) => void) {
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

  override async init() {
    this.progress('Initializing json parser')
    const parsedJsonData =
      typeof this._jsonData === 'string'
        ? // for json editor
          JSON.parse(this._jsonData)
        : // for file upload
          JSON.parse(new TextDecoder().decode(this._jsonData as BufferSource))
    this.jsonData = Array.isArray(parsedJsonData) ? parsedJsonData : [parsedJsonData]
  }

  override getColumns(): any {
    return this.columns
  }

  override getData(): any {
    return this.data
  }

  override parse(): any {
    this.progress('Reading json data')
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

  override getTemplate() {
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
      const title = path.join(' ').trim()
      const cn = path.join('_').replace(/\W/g, '_').trim()
      const column: Record<string, any> = {
        title,
        column_name: cn,
        ref_column_name: cn,
        uidt: UITypes.SingleLineText,
        path,
      }
      if (this.config.autoSelectFieldTypes) {
        let initialUidt = jsonTypeToUidt[typeof firstRowVal] || UITypes.SingleLineText
        const colData = jsonData.map((r: any) => extractNestedData(r, path))
        const nonNullData = colData.filter((v: any) => v !== null && v !== undefined && v !== '')

        if (nonNullData.length > 0) {
          const isAllStrings = nonNullData.every((v: any) => typeof v === 'string')
          const isAllNumbers = nonNullData.every((v: any) => typeof v === 'number')
          const isAllObjects = nonNullData.every((v: any) => typeof v === 'object' && !Array.isArray(v))
          const isAllArrays = nonNullData.every((v: any) => Array.isArray(v))

          if (isAllStrings) {
            if (nonNullData.every((v: any) => /^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{2}\/\d{2}\/\d{4}$/.test(v))) initialUidt = UITypes.Date
            else if (nonNullData.every((v: any) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v))) initialUidt = UITypes.DateTime
            else if (nonNullData.every((v: any) => /^([01]\d|2[0-3]):?([0-5]\d):?([0-5]\d)$/.test(v))) initialUidt = UITypes.Time
            else if (nonNullData.every((v: any) => /^\d{4}$/.test(v) && Number(v) >= 1900 && Number(v) <= 2100)) initialUidt = UITypes.Year
            else if (nonNullData.every((v: any) => /^\+?[\d\s-]{7,15}$/.test(v))) initialUidt = UITypes.PhoneNumber
            else if (nonNullData.every((v: any) => /^[\$\€\£\¥]\s?\d+(\.\d{1,2})?$/.test(v))) initialUidt = UITypes.Currency
            else if (nonNullData.every((v: any) => /^\d+(\.\d+)?%$/.test(v))) initialUidt = UITypes.Percent
            else if (nonNullData.every((v: any) => /^\d+(\.\d+)?\s*(h|m|s|hrs|mins|secs)$/i.test(v) || /^\d{2}:\d{2}:\d{2}$/.test(v))) initialUidt = UITypes.Duration
          } else if (isAllNumbers) {
            if (nonNullData.every((v: any) => v >= 1 && v <= 5 && Number.isInteger(v))) initialUidt = UITypes.Rating
            else if (nonNullData.every((v: any) => v >= 1900 && v <= 2100 && Number.isInteger(v))) initialUidt = UITypes.Year
          } else if (isAllArrays) {
            if (nonNullData.every((arr: any) => arr.every((item: any) => typeof item === 'object' && item !== null && 'url' in item && 'name' in item))) {
              initialUidt = UITypes.Attachment
            }
          } else if (isAllObjects) {
            if (nonNullData.every((obj: any) => 'type' in obj && 'coordinates' in obj)) initialUidt = UITypes.Geometry
            else if (nonNullData.every((obj: any) => ('lat' in obj && 'lng' in obj) || ('latitude' in obj && 'longitude' in obj))) initialUidt = UITypes.GeoData
            else if (nonNullData.every((obj: any) => 'email' in obj && 'name' in obj)) initialUidt = UITypes.User
            else initialUidt = UITypes.JSON
          }
        }
        
        column.uidt = initialUidt
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
