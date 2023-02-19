import { UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import TemplateGenerator from './TemplateGenerator'
import {
  extractMultiOrSingleSelectProps,
  getCheckboxValue,
  getDateFormat,
  isCheckboxType,
  isEmailType,
  isMultiLineTextType,
  isUrlType,
} from '#imports'

const excelTypeToUidt: Record<string, UITypes> = {
  d: UITypes.DateTime,
  b: UITypes.Checkbox,
  n: UITypes.Number,
  s: UITypes.SingleLineText,
}
interface ParserConfig {
  firstRowAsHeaders: boolean
  autoSelectFieldTypes: boolean
  maxRowsToParse: number
  shouldImportData: boolean
  normalizedNested?: boolean
  dynamicHeaders?: boolean
  decimalSeparator?: string // TODO: not used
  thousandsSeparator?: string // TODO: not used
}

const isDecimalVal = (vals: any[], limitRows: number) =>
  vals.slice(0, limitRows).some((v) => !v[1].w || v[1].v?.toString().includes('.'))

const isCurrencyVal = (vals: any[], limitRows: number) =>
  vals.slice(0, limitRows).every((v) => !v[1].w || v[1].w?.toString().includes('$'))

const isPercentageVal = (vals: any[], limitRows: number) =>
  vals.slice(0, limitRows).every((v) => !v[1].w || v[1].w?.toString().includes('%'))

const isMultiLineTextVal = (vals: any[], limitRows: number) =>
  isMultiLineTextType(vals.slice(0, limitRows).map((v: any) => v[1].v) as [])

const isEmailVal = (vals: any[], limitRows: number) => isEmailType(vals.slice(0, limitRows).map((v: any) => v[1].v) as [])

const isUrlVal = (vals: any[], limitRows: number) => isUrlType(vals.slice(0, limitRows).map((v: any) => v[1].v) as [])

const isCheckboxVal = (vals: any[], limitRows: number) =>
  isCheckboxType(vals.slice(0, limitRows).map((v: any) => v[1].v) as []).length === 1

const isNumberVal = (vals: any[], limitRows: number) =>
  isUrlType(
    vals
      .slice(0, limitRows)
      .map((v: any) => isNaN(v[1].w) || (v[1].w && !isNaN(Number(v[1].w)) && isNaN(parseFloat(v[1].w)))) as [],
  )

const defaultFormater = (cell: any) => cell.v || null

const defaultRawFormater = (cell: any) => cell.w || null

const dateFormatter = (cell: any, format: string) => dayjs(cell.v).format(format) || null
const dateTimeFormatter = (cell: any) => cell.v || null

const checkBoxFormatter = (cell: any) => getCheckboxValue(cell.v) || null

const currencyFormatter = (cell: any) => cell.w.replace(/[^\d.]+/g, '') || null
const percentFormatter = (cell: any) => parseFloat(cell.w.slice(0, -1)) / 100 || null

const isAllDate = (vals: any[], dateFormat: Record<string, number>) =>
  vals.every(([_, cell]) => {
    // TODO: more date types and more checks!
    const onlyDate = !cell.w || cell.w?.split(' ').length === 1
    if (onlyDate) {
      const format = getDateFormat(cell.w)
      dateFormat[format] = (dateFormat[format] || 0) + 1
    }
    return onlyDate
  })

const specialCharRegex = /[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g

export default class ExcelTemplateAdapter extends TemplateGenerator {
  config: ParserConfig

  excelData: any

  project: {
    tables: Record<string, any>[]
  }

  data: Record<string, any> = {}

  wb: any

  xlsx: typeof import('xlsx')

  basedate: Date
  dnthresh: number
  day_ms: number

  constructor(
    data = {},
    parserConfig: ParserConfig = {
      firstRowAsHeaders: true,
      autoSelectFieldTypes: true,
      maxRowsToParse: 500,
      dynamicHeaders: true,
      shouldImportData: true,
      normalizedNested: false,
    },
  ) {
    super()
    this.config = Object.assign(
      {
        firstRowAsHeaders: true,
        autoSelectFieldTypes: true,
        maxRowsToParse: 500,
        dynamicHeaders: true,
        shouldImportData: true,
        normalizedNested: false,
      },
      parserConfig,
    )
    this.excelData = data
    this.project = {
      tables: [],
    }
    this.xlsx = {} as any
    // fix precision bug & timezone offset issues introduced by xlsx
    this.basedate = new Date(1899, 11, 30, 0, 0, 0)
    // number of milliseconds since base date
    this.dnthresh = this.basedate.getTime() + (new Date().getTimezoneOffset() - this.basedate.getTimezoneOffset()) * 60000

    // number of milliseconds in a day
    this.day_ms = 24 * 60 * 60 * 1000
  }

  async init() {
    this.xlsx = await import('xlsx')

    const options = {
      cellText: true,
      cellDates: true,
    }

    this.wb = this.xlsx.read(new Uint8Array(this.excelData), {
      type: 'array',
      ...options,
    })
  }

  // handle date1904 property
  fixImportedDate = (date: Date) => {
    const parsed = this.xlsx.SSF.parse_date_code((date.getTime() - this.dnthresh) / this.day_ms, {
      date1904: this.wb.Workbook.WBProps.date1904,
    })
    return new Date(parsed.y, parsed.m, parsed.d, parsed.H, parsed.M, parsed.S)
  }

  getCellObj = (ws: any, col: number, row: number) => {
    const cellId = this.xlsx.utils.encode_cell({
      c: col,
      r: row,
    })

    return ws[cellId] || {}
  }

  addDataRows = (tableName: string, columnName: string, vals: any[], formatter: any, ...args: any[]) => {
    for (const [key, cell] of vals) {
      this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] = formatter(
        cell,
        ...args,
      )
    }
  }

  async parse() {
    const tableNamePrefixRef: Record<string, any> = {}
    await Promise.all(
      this.wb.SheetNames.map((sheetName: string) =>
        (async (sheet) => {
          await new Promise((resolve) => {
            const columnNamePrefixRef: Record<string, any> = { id: 0 }
            let tableName: string = (sheet || 'table').replace(specialCharRegex, '_').trim()

            while (tableName in tableNamePrefixRef) {
              tableName = `${tableName}${++tableNamePrefixRef[tableName]}`
            }
            tableNamePrefixRef[tableName] = 0

            const table = { table_name: tableName, ref_table_name: tableName, columns: [] as any[] }
            this.project.tables.push(table)
            const ws: any = this.wb.Sheets[sheet]
            const range = this.xlsx.utils.decode_range(ws['!ref'])

            const skippedValues: any[] = []
            if (this.config.dynamicHeaders) {
              // The dynamicHeaders property is likely used when the Excel file does not have a fixed header row, or when the location of the header row may vary.
              for (let col = 0; col < range.e.c; col++) {
                let skip = 0
                let cell
                while (true) {
                  cell = this.getCellObj(ws, range.s.c + col, skip)
                  if (cell || skip > this.config.maxRowsToParse) {
                    break
                  }
                  skip++
                }
                if (skip) {
                  skippedValues.push(cell)
                }
              }
            }

            this.data[tableName] = []

            for (const cellChar in Object.entries(ws).slice(skippedValues.length + 1, skippedValues.length + range.e.c + 1)) {
              const cellIdx = this.xlsx.utils.decode_cell(cellChar)

              const vals = Object.entries(ws as Record<string, any>)
                .slice(skippedValues.length + range.e.c + 1, -1)
                .filter(([key, _]) => this.xlsx.utils.decode_cell(key).c === cellIdx.c)

              const maxCellIdx = vals.reduce((a: number, [v, _]) => {
                const newIdx = this.xlsx.utils.decode_cell(v).r
                return newIdx > a ? newIdx : a
              }, 0)

              if (maxCellIdx > this.data[tableName].length) {
                // prefill
                this.data[tableName].push(
                  ...Array(maxCellIdx - this.data[tableName].length + 1)
                    .fill(null)
                    .map(() => ({})),
                )
              }

              let columnName = ((this.config.firstRowAsHeaders && ws[cellChar]?.v?.toString().trim()) || `field_${cellIdx.c + 1}`)
                .replace(specialCharRegex, '_')
                .trim()

              while (columnName in columnNamePrefixRef) {
                columnName = `${columnName}${++columnNamePrefixRef[columnName]}`
              }
              columnNamePrefixRef[columnName] = 0
              const column: Record<string, any> = {
                column_name: columnName,
                ref_column_name: columnName,
                meta: {},
                uidt: UITypes.SingleLineText,
              }
              table.columns.push(column)

              if (!this.config.autoSelectFieldTypes) {
                this.addDataRows(tableName, columnName, vals, defaultRawFormater)
              }

              // parse each column
              column.uidt = excelTypeToUidt[vals[+this.config.firstRowAsHeaders][1].t] || UITypes.SingleLineText

              switch (column.uidt) {
                case UITypes.Number:
                  if (isDecimalVal(vals, +this.config.firstRowAsHeaders)) {
                    column.uidt = UITypes.Decimal
                    this.addDataRows(tableName, columnName, vals, defaultFormater)
                    break
                  }

                  if (isCurrencyVal(vals, +this.config.firstRowAsHeaders)) {
                    // TODO: more currency types!
                    column.uidt = UITypes.Currency
                    this.addDataRows(tableName, columnName, vals, currencyFormatter)
                    break
                  }

                  if (isPercentageVal(vals, +this.config.firstRowAsHeaders)) {
                    column.uidt = UITypes.Percent
                    this.addDataRows(tableName, columnName, vals, percentFormatter)
                    break
                  }

                  // fallback to SingleLineText -> i think this is not really required
                  if (!isNumberVal(vals, +this.config.firstRowAsHeaders)) {
                    column.uidt = UITypes.SingleLineText
                  }

                  column.uidt = UITypes.Number
                  this.addDataRows(tableName, columnName, vals, defaultFormater)

                  break

                case UITypes.DateTime:
                  // TODO(import): centralise
                  // hold the possible date format found in the date
                  for (const [_, cell] of vals) {
                    cell.v = this.fixImportedDate(cell.v)
                  }
                  column.date_formats = {}
                  if (isAllDate(vals, column.date_formats)) {
                    column.uidt = UITypes.Date
                    // take the date format with the max occurrence
                    column.date_format =
                      Object.keys(column.date_formats).reduce((x, y) =>
                        column.date_formats[x] > column.date_formats[y] ? x : y,
                      ) || 'YYYY/MM/DD'
                    this.addDataRows(tableName, columnName, vals, dateFormatter, column.meta.date_format)
                    break
                  }
                  column.uidt = UITypes.DateTime
                  this.addDataRows(tableName, columnName, vals, dateTimeFormatter)
                  break

                default:
                  if (isMultiLineTextVal(vals, +this.config.firstRowAsHeaders)) {
                    column.uidt = UITypes.LongText
                    this.addDataRows(tableName, columnName, vals, defaultFormater)
                    break
                  }
                  if (isEmailVal(vals, +this.config.firstRowAsHeaders)) {
                    column.uidt = UITypes.Email
                    this.addDataRows(tableName, columnName, vals, defaultFormater)
                    break
                  }
                  if (isUrlVal(vals, +this.config.firstRowAsHeaders)) {
                    column.uidt = UITypes.URL
                    this.addDataRows(tableName, columnName, vals, defaultFormater)
                    break
                  }
                  if (isCheckboxVal(vals, +this.config.firstRowAsHeaders)) {
                    column.uidt = UITypes.Checkbox
                    this.addDataRows(tableName, columnName, vals, checkBoxFormatter)
                    break
                  }
                  Object.assign(
                    column,
                    extractMultiOrSingleSelectProps(vals.slice(0, this.config.maxRowsToParse).map((v: any) => v[1].v) as []),
                  )
                  this.addDataRows(tableName, columnName, vals, defaultFormater)
                  break
              }
            }
            resolve(true)
          })
        })(sheetName),
      ),
    )
  }

  getTemplate() {
    return this.project
  }

  getData() {
    return this.data
  }

  getColumns() {
    return this.project.tables.map((t: Record<string, any>) => t.columns)
  }
}
