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
  dateFormat?: string
  timeFormat?: string
  dateTimeFormat?: string
  decimalSeparator?: string
  thousandsSeparator?: string
  decimalPlaces?: number
  currencySymbol?: string
  currencySymbolOnLeft?: boolean
  currencyThousandsSeparator?: string
  currencyDecimalSeparator?: string
  currencyDecimalPlaces?: number
  showCurrencySymbol?: boolean
  nullValue?: string
  trueValue?: string
  falseValue?: string
  defaultType?: string
  defaultTypeForEmpty?: string
  defaultTypeForNull?: string
  defaultTypeForTrue?: string
  defaultTypeForFalse?: string
  defaultTypeForNumber?: string
  defaultTypeForDate?: string
  defaultTypeForTime?: string
  defaultTypeForDateTime?: string
  defaultTypeForEmail?: string
  defaultTypeForUrl?: string
  defaultTypeForMultiLineText?: string
  defaultTypeForSingleSelect?: string
  defaultTypeForMultiSelect?: string
  defaultTypeForCheckbox?: string
  defaultTypeForLongText?: string
  defaultTypeForCurrency?: string
  defaultTypeForImage?: string
  defaultTypeForFile?: string
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

  addDataRows = (table_name: string, column_name: string, values: any[]) => {
    values.forEach((value, idx) => {
      this.data[table_name][idx][column_name] = value
    })
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

  async parse() {
    const tableNamePrefixRef: Record<string, any> = {}
    await Promise.all(
      this.wb.SheetNames.map((sheetName: string) =>
        (async (sheet) => {
          await new Promise((resolve) => {
            const columnNamePrefixRef: Record<string, any> = { id: 0 }
            let tableName: string = (sheet || 'table').replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_').trim()

            while (tableName in tableNamePrefixRef) {
              tableName = `${tableName}${++tableNamePrefixRef[tableName]}`
            }
            tableNamePrefixRef[tableName] = 0

            const table = { table_name: tableName, ref_table_name: tableName, columns: [] as any[] }
            this.project.tables.push(table)
            const ws: any = this.wb.Sheets[sheet]
            const range = this.xlsx.utils.decode_range(ws['!ref'])

            // const skiped_cols: number[] = []
            // const skippedCells: number[] = []
            const skippedValues: any[] = []
            // let cellRowsToSkip = 0

            if (this.config.dynamicHeaders) {
              for (let col = 0; col < range.e.c; col++) {
                let skip = 0
                let cell
                while (true) {
                  cell = this.getCellObj(ws, range.s.c + col, skip)
                  if (cell || skip > this.config.maxRowsToParse) {
                    // if (skip > this.config.maxRowsToParse){
                    // skiped_cols.push(col)
                    // }
                    break
                  }
                  skip++
                }
                if (skip) {
                  skippedValues.push(cell)
                  // skippedCells.push(skip)
                }
              }
              // cellRowsToSkip =
              //   skippedCells
              //     .sort((a: any, b) => skippedCells.filter((v) => v === a).length - skippedCells.filter((v) => v === b).length)
              //     .pop()! || 0
            }

            // const rows: any = this.xlsx.utils.sheet_to_json(ws, {
            //   // header has to be 1 disregarding this.config.firstRowAsHeaders
            //   // so that it generates an array of arrays
            //   header: 1,
            //   range: { s: { c: 0, r: cellRowsToSkip }, e: { c: range.e.c, r: range.e.r } },
            //   blankrows: false,
            //   defval: null,
            // })

            this.data[tableName] = []

            Object.entries(ws as Record<string, any>)
              .slice(skippedValues.length + 1, skippedValues.length + range.e.c + 1)
              .forEach(([cellChar, headerCell]) => {
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

                let columnName = ((this.config.firstRowAsHeaders && headerCell?.v?.toString().trim()) || `field_${cellIdx.c + 1}`)
                  .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_')
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
                  vals.forEach(([key, cell]) => {
                    this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] =
                      cell?.w || null
                  })
                }

                // parse each column
                column.uidt = excelTypeToUidt[vals[+this.config.firstRowAsHeaders][1].t] || UITypes.SingleLineText
                if (column.uidt === UITypes.Number) {
                  if (vals.slice(0, this.config.maxRowsToParse).some((v) => !v[1].w || v[1].v?.toString().includes('.'))) {
                    column.uidt = UITypes.Decimal
                    vals.forEach(([key, cell]) => {
                      this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] =
                        cell?.v || null
                    })
                  } else if (
                    vals.slice(0, this.config.maxRowsToParse).every((v) => !v[1].w || v[1].w?.toString().includes('$'))
                  ) {
                    // TODO: more currency types!
                    column.uidt = UITypes.Currency
                    vals.forEach(([key, cell]) => {
                      this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] =
                        cell.w.replace(/[^\d.]+/g, '') || null
                    })
                  } else if (
                    vals.slice(0, this.config.maxRowsToParse).every((v) => !v[1].w || v[1].w?.toString().includes('%'))
                  ) {
                    column.uidt = UITypes.Percent
                    vals.forEach(([key, cell]) => {
                      this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] =
                        parseFloat(cell.w.slice(0, -1)) / 100 || null
                    })
                  } else {
                    column.uidt = UITypes.Number
                    vals.forEach(([key, cell]) => {
                      this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] =
                        cell.v || null
                    })
                  }
                } else if (column.uidt === UITypes.DateTime) {
                  const dateFormat: Record<string, number> = {}
                  if (
                    vals.every((v: any) => {
                      const onlyDate = !v[1].w || v[1].w?.split(' ').length === 1
                      if (onlyDate) {
                        const format = getDateFormat(v[1].w)
                        dateFormat[format] = (dateFormat[format] || 0) + 1
                      }
                      return isDateTime
                    })
                  ) {
                    column.uidt = UITypes.Date
                    column.date_format =
                      Object.keys(dateFormat).reduce((x, y) => (dateFormat[x] > dateFormat[y] ? x : y)) || 'YYYY/MM/DD'
                    vals.forEach(([key, cell]) => {
                      this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] = cell
                        ? dayjs(this.fixImportedDate(cell.v)).format(column.meta.date_format)
                        : null
                    })
                  } else {
                    column.uidt = UITypes.DateTime
                    vals.forEach(([key, cell]) => {
                      this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] =
                        this.fixImportedDate(cell.v) || null
                    })
                  }
                } else if (column.uidt === UITypes.SingleLineText || column.uidt === UITypes.Checkbox) {
                  if (isMultiLineTextType(vals.slice(0, this.config.maxRowsToParse).map((v: any) => v[1].v) as [])) {
                    column.uidt = UITypes.LongText
                    vals.forEach(([key, cell]) => {
                      this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] =
                        cell.v || null
                    })
                  } else if (isEmailType(vals.slice(0, this.config.maxRowsToParse).map((v: any) => v[1].v) as [])) {
                    column.uidt = UITypes.Email
                    vals.forEach(([key, cell]) => {
                      this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] =
                        cell.v || null
                    })
                  } else if (isUrlType(vals.slice(0, this.config.maxRowsToParse).map((v: any) => v[1].v) as [])) {
                    column.uidt = UITypes.URL
                    vals.forEach(([key, cell]) => {
                      this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] =
                        cell.v || null
                    })
                  } else {
                    const checkboxType = isCheckboxType(vals)
                    if (checkboxType.length === 1) {
                      column.uidt = UITypes.Checkbox
                      this.addDataRows(tableName, columnName, vals.map((v: any) => v[1].v).map(getCheckboxValue))
                    } else {
                      Object.assign(
                        column,
                        extractMultiOrSingleSelectProps(vals.slice(0, this.config.maxRowsToParse).map((v: any) => v[1].v) as []),
                      )
                      vals.forEach(([key, cell]) => {
                        this.data[tableName][this.xlsx.utils.decode_cell(key).r - +this.config.firstRowAsHeaders][columnName] =
                          cell.v || null
                      })
                    }
                  }
                }
              }, [])

            // if (column.uidt === UITypes.SingleLineText) {
            //   // check for long text
            //   if (isMultiLineTextType(vals.map((v: any) => v[1].v) as [])) {
            //     column.uidt = UITypes.LongText
            //   }
            //
            //   if (isEmailType(rows, col)) {
            //     column.uidt = UITypes.Email
            //   }
            //
            //   if (isUrlType(rows, col)) {
            //     column.uidt = UITypes.URL
            //   } else {
            //     const vals = rows
            //       .slice(+this.config.firstRowAsHeaders)
            //       .map((r: any) => r[col])
            //       .filter((v: any) => v !== null && v !== undefined && v.toString().trim() !== '')
            //
            //     const checkboxType = isCheckboxType(vals)
            //     if (checkboxType.length === 1) {
            //       column.uidt = UITypes.Checkbox
            //     } else {
            //       // Single Select / Multi Select
            //       Object.assign(column, extractMultiOrSingleSelectProps(vals))
            //     }
            //   }
            // } else if (column.uidt === UITypes.Number) {
            //   if (
            //     rows.slice(1, this.config.maxRowsToParse).some((v: any) => {
            //       return v && v[col] && parseInt(v[col]) !== +v[col]
            //     })
            //   ) {
            //     column.uidt = UITypes.Decimal
            //   }
            //   if (
            //     rows.slice(1, this.config.maxRowsToParse).every((v: any, i: any) => {
            //       const cellId = this.xlsx.utils.encode_cell({
            //         c: range.s.c + col,
            //         r: i + +this.config.firstRowAsHeaders,
            //       })
            //
            //       const cellObj = ws[cellId]
            //
            //       return !cellObj || (cellObj.w && cellObj.w.startsWith('$'))
            //     })
            //   ) {
            //     column.uidt = UITypes.Currency
            //   }
            //   if (
            //     rows.slice(1, this.config.maxRowsToParse).some((v: any, i: any) => {
            //       const cellId = this.xlsx.utils.encode_cell({
            //         c: range.s.c + col,
            //         r: i + +this.config.firstRowAsHeaders,
            //       })
            //
            //       const cellObj = ws[cellId]
            //       return !(isNaN(cellObj) || !(cellObj.w && !(!isNaN(Number(cellObj.w)) && !isNaN(parseFloat(cellObj.w)))))
            //     })
            //   ) {
            //     // fallback to SingleLineText
            //     column.uidt = UITypes.SingleLineText
            //   }
            // } else if (column.uidt === UITypes.DateTime) {
            //   // TODO(import): centralise
            //   // hold the possible date format found in the date
            //   const dateFormat: Record<string, number> = {}
            //   if (
            //     rows.slice(1, this.config.maxRowsToParse).every((v: any, i: any) => {
            //       const cellId = this.xlsx.utils.encode_cell({
            //         c: range.s.c + col,
            //         r: i + +this.config.firstRowAsHeaders,
            //       })
            //
            //       const cellObj = ws[cellId]
            //       const isDate = !cellObj || (cellObj.w && cellObj.w.split(' ').length === 1)
            //       if (isDate && cellObj) {
            //         dateFormat[getDateFormat(cellObj.w)] = (dateFormat[getDateFormat(cellObj.w)] || 0) + 1
            //       }
            //       return isDate
            //     })
            //   ) {
            //     column.uidt = UITypes.Date
            //     // take the date format with the max occurrence
            //     column.meta.date_format =
            //       Object.keys(dateFormat).reduce((x, y) => (dateFormat[x] > dateFormat[y] ? x : y)) || 'YYYY/MM/DD'
            //   }
            // }
            // }

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
