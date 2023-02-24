import { UITypes } from 'nocodb-sdk'
import TemplateGenerator from './TemplateGenerator'
import {
  checkBoxFormatter,
  currencyFormatter,
  dateFormatter,
  dateTimeFormatter,
  defaultFormater,
  defaultRawFormater,
  isAllDate,
  isCheckboxVal,
  isEmailVal,
  isIsoDateVal,
  isMultiLineTextVal,
  isMultiOrSingleSelectVal,
  isNumberVal,
  isUrlVal,
  isoToDate,
  multiOrSingleSelectFormatter,
  percentFormatter,
  specialCharRegex,
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
  dynamicHeaders?: boolean // TODO: not passed from Editor.vue
  skipEmptyColumns?: boolean // TODO: not passed from Editor.vue
  decimalSeparator?: string // TODO: not used
  thousandsSeparator?: string // TODO: not used
}

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
      skipEmptyColumns: false,
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
      const rowIdx = this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders
      this.data[tableName][rowIdx][columnName] = formatter(cell, ...args)
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
            const headerRanges: number[] = []
            const firstEntryIsRef = Object.keys(ws)[0] === '!ref'

            Object.entries(ws as Record<string, any>)
              .slice(skippedValues.length + +firstEntryIsRef, skippedValues.length + range.e.c + 1 + +firstEntryIsRef)
              .forEach(([cellChar, headerCell]) => {
                const cellIdx = this.xlsx.utils.decode_cell(cellChar)
                if (headerRanges.includes(cellIdx.c)) {
                  return
                }
                headerRanges.push(cellIdx.c)
                if (cellIdx.r < 0) {
                  return
                }
                const vals = Object.entries(ws as Record<string, any>)
                  .slice(
                    +firstEntryIsRef + skippedValues.length + +this.config.firstRowAsHeaders + range.e.c + cellIdx.c,
                    -1 - +!firstEntryIsRef,
                  )
                  .filter(([key, _]) => this.xlsx.utils.decode_cell(key).c === cellIdx.c)

                const maxCellIdx = vals.reduce((a: number, [v, _]) => {
                  const newIdx = this.xlsx.utils.decode_cell(v).r
                  return newIdx > a ? newIdx : a
                }, 0)

                if (maxCellIdx > this.data[tableName].length) {
                  // prefill
                  this.data[tableName].push(
                    ...Array(maxCellIdx - this.data[tableName].length)
                      .fill(null)
                      .map(() => ({})),
                  )
                }

                let columnName = ((this.config.firstRowAsHeaders && headerCell.v?.toString().trim()) || `field_${cellIdx.c + 1}`)
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

                if (vals.length === 0) {
                  if (!this.config.skipEmptyColumns) table.columns.push(column)
                  return
                }

                table.columns.push(column)

                if (!this.config.autoSelectFieldTypes) {
                  this.addDataRows(tableName, columnName, vals, defaultRawFormater)
                }

                // parse each column
                column.uidt = excelTypeToUidt[vals[0][1].t] || UITypes.SingleLineText

                switch (column.uidt) {
                  case UITypes.Number:
                    if (isDecimalVal(vals, this.config.maxRowsToParse)) {
                      column.uidt = UITypes.Decimal
                      this.addDataRows(tableName, columnName, vals, defaultFormater)
                      break
                    }

                    if (isCurrencyVal(vals, this.config.maxRowsToParse)) {
                      // TODO: more currency types!
                      column.uidt = UITypes.Currency
                      this.addDataRows(tableName, columnName, vals, currencyFormatter)
                      break
                    }

                    if (isPercentageVal(vals, this.config.maxRowsToParse)) {
                      column.uidt = UITypes.Percent
                      this.addDataRows(tableName, columnName, vals, percentFormatter)
                      break
                    }

                    // fallback to SingleLineText -> i think this is not really required
                    if (!isNumberVal(vals, this.config.maxRowsToParse)) {
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
                    column.dateFormats = {}
                    if (isAllDate(vals, column)) {
                      this.addDataRows(tableName, columnName, vals, dateFormatter, column.meta.date_format)
                      break
                    }
                    column.uidt = UITypes.DateTime
                    this.addDataRows(tableName, columnName, vals, dateTimeFormatter)
                    break

                  default:
                    if (isMultiLineTextVal(vals, this.config.maxRowsToParse)) {
                      column.uidt = UITypes.LongText
                      this.addDataRows(tableName, columnName, vals, defaultFormater)
                      break
                    }
                    if (isEmailVal(vals, this.config.maxRowsToParse)) {
                      column.uidt = UITypes.Email
                      this.addDataRows(tableName, columnName, vals, defaultFormater)
                      break
                    }
                    if (isUrlVal(vals, this.config.maxRowsToParse)) {
                      column.uidt = UITypes.URL
                      this.addDataRows(tableName, columnName, vals, defaultFormater)
                      break
                    }
                    if (isCheckboxVal(vals, this.config.maxRowsToParse)) {
                      column.uidt = UITypes.Checkbox
                      this.addDataRows(tableName, columnName, vals, checkBoxFormatter)
                      break
                    }
                    if (isMultiOrSingleSelectVal(vals, this.config.maxRowsToParse, column)) {
                      this.addDataRows(tableName, columnName, vals, multiOrSingleSelectFormatter)
                      break
                    }
                    if (isIsoDateVal(vals, this.config.maxRowsToParse)) {
                      for (const [_, cell] of vals) {
                        cell.v = this.fixImportedDate(isoToDate(cell.w) as Date)
                      }
                      column.date_formats = {}
                      if (isAllDate(vals, column)) {
                        this.addDataRows(tableName, columnName, vals, dateFormatter, column.meta.date_format)
                        break
                      }
                      this.addDataRows(tableName, columnName, vals, dateTimeFormatter)
                      break
                    }
                    this.addDataRows(tableName, columnName, vals, defaultFormater)
                    break
                }
              })
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
