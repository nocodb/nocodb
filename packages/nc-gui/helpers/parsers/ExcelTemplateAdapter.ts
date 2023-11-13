import { UITypes } from 'nocodb-sdk'
import TemplateGenerator from './TemplateGenerator'
import {
  checkBoxFormatter,
  currencyFormatter,
  dateFormatter,
  dateTimeFormatter,
  decimalFormatter,
  defaultFormatter,
  defaultRawFormatter,
  findMaxOccurrence,
  isAllDate,
  isCheckboxVal,
  isCurrencyVal,
  isDecimalVal,
  isEmailVal,
  isIsoDateVal,
  isMultiLineTextVal,
  isMultiOrSingleSelectVal,
  isNumberVal,
  isPercentageVal,
  isUrlVal,
  multiOrSingleSelectFormatter,
  numberFormatter,
  percentFormatter,
  specialCharRegex,
} from './parserHelpers'
import { isoToDate } from '@/utils/dateTimeUtils'

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

  base: {
    tables: Record<string, any>[]
  }

  data: Record<string, any> = {}

  wb: any

  xlsx: typeof import('xlsx')

  basedate: Date
  dnthresh: number
  day_ms: number
  maxSkippedCellCount: number

  constructor(
    data = {},
    parserConfig: ParserConfig = {
      firstRowAsHeaders: true,
      autoSelectFieldTypes: true,
      maxRowsToParse: 500,
      dynamicHeaders: true,
      skipEmptyColumns: true,
      shouldImportData: true,
      normalizedNested: false,
    },
    xlsx: any = null,
    progressCallback?: (msg: string) => void,
  ) {
    super(progressCallback)
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
    this.maxSkippedCellCount = 0
    this.excelData = data
    this.base = {
      tables: [],
    }
    this.xlsx = xlsx || ({} as any)
    // fix precision bug & timezone offset issues introduced by xlsx
    this.basedate = new Date(1899, 11, 30, 0, 0, 0)
    // number of milliseconds since base date
    this.dnthresh = this.basedate.getTime() + (new Date().getTimezoneOffset() - this.basedate.getTimezoneOffset()) * 60000

    // number of milliseconds in a day
    this.day_ms = 24 * 60 * 60 * 1000
  }

  async init() {
    this.progress('Initializing excel parser')
    this.xlsx = this.xlsx || (await import('xlsx'))

    const options = {
      cellText: true,
      cellDates: true,
    }

    this.wb = this.xlsx.read(new Uint8Array(this.excelData), {
      type: 'array',
      ...options,
    })
  }

  getCellRange = (ws: any) => {
    let start_range = { c: -1, r: -1 }
    let iter = 0
    while ((start_range.c === -1 && start_range.r === -1) || iter > Object.keys(ws).length) {
      start_range = this.xlsx.utils.decode_cell(Object.keys(ws).slice(iter, iter + 1)[0])
      iter++
    }

    let end_range = { c: -1, r: -1 }
    iter = 0
    while ((end_range.c === -1 && end_range.r === -1) || iter > Object.keys(ws).length) {
      end_range = this.xlsx.utils.decode_cell(Object.keys(ws).slice(-2 - iter, -1 - iter)[0])
      iter++
    }
    return { s: start_range, e: end_range }
  }

  // handle date1904 property
  // fixImportedDate = (date: any) => {
  //   if (!(date instanceof Date)) return date
  //   const parsed = this.xlsx.SSF.parse_date_code((date.getTime() - this.dnthresh) / this.day_ms, {
  //     date1904: this.wb.Workbook.WBProps.date1904,
  //   })
  //   return new Date(parsed.y, parsed.m, parsed.d, parsed.H, parsed.M, parsed.S)
  // }

  getCellObj = (ws: any, col: number, row: number) => {
    const cellId = this.xlsx.utils.encode_cell({
      c: col,
      r: row,
    })

    return ws[cellId] || {}
  }

  addDataRows = (tableName: string, columnName: string, vals: any[], formatter: any, ...args: any[]) => {
    for (const [key, cell] of vals) {
      const rowIdx = this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders - this.maxSkippedCellCount
      this.data[tableName][rowIdx][columnName] = formatter(cell, ...args)
    }
  }

  async parse() {
    this.progress('Parsing excel file')
    const tableNamePrefixRef: Record<string, any> = {}
    await Promise.all(
      this.wb.SheetNames.map((sheetName: string) =>
        (async (sheet) => {
          this.progress(`Parsing sheet ${sheetName}`)

          await new Promise((resolve) => {
            const columnNamePrefixRef: Record<string, any> = { id: 0 }
            let tableName: string = (sheet || 'table').replace(specialCharRegex, '_').trim()

            while (tableName in tableNamePrefixRef) {
              tableName = `${tableName}${++tableNamePrefixRef[tableName]}`
            }
            tableNamePrefixRef[tableName] = 0

            const table = { table_name: tableName, ref_table_name: tableName, columns: [] as any[] }
            this.base.tables.push(table)
            const ws: any = this.wb.Sheets[sheet]

            // sometimes the '!ref' is wrong (e.g. the max cell is much more than the actual max cell), so we need to calculate the range of the actual max cell
            const range = this.getCellRange(ws)

            const skippedCellCount: number[] = []
            if (this.config.dynamicHeaders) {
              // The dynamicHeaders property is likely used when the Excel file does not have a fixed header row, or when the location of the header row may vary.
              for (let col = 0; col < range.e.c; col++) {
                let skip = 0
                let cell
                while (true) {
                  cell = this.getCellObj(ws, range.s.c + col, skip)
                  if (Object.keys(cell).length || skip > this.config.maxRowsToParse) {
                    break
                  }
                  skip++
                }
                if (skip) {
                  skippedCellCount.push(skip)
                }
              }
            }

            // typescript code for maximal occurent value in array
            this.maxSkippedCellCount = findMaxOccurrence(skippedCellCount)

            this.data[tableName] = []
            const headerRanges: number[] = []

            Object.entries(ws as Record<string, any>)
              .filter(([key, _]) => this.xlsx.utils.decode_cell(key).r === this.maxSkippedCellCount)
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
                  .filter(([key, _]) => {
                    const range = this.xlsx.utils.decode_cell(key)
                    return range.c === cellIdx.c
                  })
                  .slice(+this.config.firstRowAsHeaders)

                const maxCellIdx = vals.reduce((a: number, [v, _]) => {
                  const newIdx = this.xlsx.utils.decode_cell(v).r
                  return newIdx > a ? newIdx : a
                }, 0)

                if (maxCellIdx > this.data[tableName].length) {
                  // prefill
                  this.data[tableName].push(
                    ...Array(
                      maxCellIdx - this.data[tableName].length - +!this.config.firstRowAsHeaders - this.maxSkippedCellCount,
                    )
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
                  this.addDataRows(tableName, columnName, vals, defaultRawFormatter)
                }

                // parse each column
                column.uidt = excelTypeToUidt[vals[0][1].t] || UITypes.SingleLineText

                switch (column.uidt) {
                  case UITypes.Number:
                    if (isDecimalVal(vals, this.config.maxRowsToParse)) {
                      column.uidt = UITypes.Decimal
                      this.addDataRows(tableName, columnName, vals, decimalFormatter)
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
                    this.addDataRows(tableName, columnName, vals, numberFormatter)

                    break

                  case UITypes.DateTime:
                    // TODO(import): centralise
                    // hold the possible date format found in the date
                    // for (const [_, cell] of vals) {
                    //   cell.v = this.fixImportedDate(cell.v)
                    // }
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
                      this.addDataRows(tableName, columnName, vals, defaultFormatter)
                      break
                    }
                    if (isEmailVal(vals, this.config.maxRowsToParse)) {
                      column.uidt = UITypes.Email
                      this.addDataRows(tableName, columnName, vals, defaultFormatter)
                      break
                    }
                    if (isUrlVal(vals, this.config.maxRowsToParse)) {
                      column.uidt = UITypes.URL
                      this.addDataRows(tableName, columnName, vals, defaultFormatter)
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
                        cell.v = isoToDate(cell.w)
                      }
                      if (isAllDate(vals, column)) {
                        this.addDataRows(tableName, columnName, vals, dateFormatter, column.meta.date_format)
                        break
                      }
                      this.addDataRows(tableName, columnName, vals, dateTimeFormatter)
                      break
                    }
                    this.addDataRows(tableName, columnName, vals, defaultFormatter)
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
    return this.base
  }

  getData() {
    return this.data
  }

  getColumns() {
    return this.base.tables.map((t: Record<string, any>) => t.columns)
  }
}
