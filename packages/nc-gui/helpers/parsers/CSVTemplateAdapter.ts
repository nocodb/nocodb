import { parse } from 'papaparse'
import type { UploadFile } from 'ant-design-vue'
import { UITypes, getDateFormat, validateDateWithUnknownFormat } from 'nocodb-sdk'
import {
  extractMultiOrSingleSelectProps,
  getCheckboxValue,
  isCheckboxType,
  isDecimalType,
  isEmailType,
  isMultiLineTextType,
  isUrlType,
} from './parserHelpers'

export default class CSVTemplateAdapter {
  config: Record<string, any>
  source: UploadFile[] | string
  detectedColumnTypes: Record<number, Record<string, number>>
  distinctValues: Record<number, Set<string>>
  headers: Record<number, string[]>
  tables: Record<number, any>
  base: {
    tables: Record<string, any>[]
  }

  data: Record<string, any> = {}
  columnValues: Record<number, []>

  private progressCallback?: (msg: string) => void

  constructor(source: UploadFile[] | string, parserConfig = {}, progressCallback?: (msg: string) => void) {
    this.config = parserConfig
    this.source = source
    this.base = {
      tables: [],
    }
    this.detectedColumnTypes = {}
    this.distinctValues = {}
    this.headers = {}
    this.columnValues = {}
    this.tables = {}
    this.progressCallback = progressCallback
  }

  async init() {}

  initTemplate(tableIdx: number, tn: string, columnNames: string[]) {
    const columnNameRowExist = +columnNames.every((v: any) => v === null || typeof v === 'string')
    const columnNamePrefixRef: Record<string, any> = { id: 0, Id: 0 }
    const titlePrefixRef: Record<string, any> = { id: 0, Id: 0 }

    const tableObj: Record<string, any> = {
      table_name: tn,
      ref_table_name: tn,
      columns: [],
    }

    this.headers[tableIdx] = []
    this.tables[tableIdx] = []

    for (const [columnIdx, columnName] of columnNames.entries()) {
      let title = ((columnNameRowExist && columnName.toString().trim()) || `Field ${columnIdx + 1}`).trim()
      let cn: string = ((columnNameRowExist && columnName.toString().trim()) || `field_${columnIdx + 1}`)
        .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_')
        .trim()

      while (cn in columnNamePrefixRef) {
        cn = `${cn}${++columnNamePrefixRef[cn]}`
      }

      while (title in titlePrefixRef) {
        title = `${title}${++titlePrefixRef[title]}`
      }

      columnNamePrefixRef[cn] = 0
      titlePrefixRef[title] = 0

      this.detectedColumnTypes[columnIdx] = {}
      this.distinctValues[columnIdx] = new Set<string>()
      this.columnValues[columnIdx] = []
      tableObj.columns.push({
        title,
        column_name: cn,
        ref_column_name: cn,
        meta: {},
        uidt: UITypes.SingleLineText,
        key: columnIdx,
      })

      this.headers[tableIdx].push(cn)
      this.tables[tableIdx] = tableObj
    }
  }

  detectInitialUidt(v: string) {
    if (!isNaN(Number(v)) && !isNaN(parseFloat(v))) return UITypes.Number
    if (validateDateWithUnknownFormat(v)) return UITypes.DateTime
    if (isCheckboxType(v)) return UITypes.Checkbox
    return UITypes.SingleLineText
  }

  detectColumnType(tableIdx: number, data: []) {
    for (let columnIdx = 0; columnIdx < data.length; columnIdx++) {
      // skip null data
      if (!data[columnIdx]) continue
      const colData: any = [data[columnIdx]]
      const colProps = { uidt: this.detectInitialUidt(data[columnIdx]) }
      // TODO(import): centralise
      if (isMultiLineTextType(colData)) {
        colProps.uidt = UITypes.LongText
      } else if (colProps.uidt === UITypes.SingleLineText) {
        if (isEmailType(colData)) {
          colProps.uidt = UITypes.Email
        } else if (isUrlType(colData)) {
          colProps.uidt = UITypes.URL
        } else if (isCheckboxType(colData)) {
          colProps.uidt = UITypes.Checkbox
        } else {
          if (data[columnIdx] && columnIdx < this.config.maxRowsToParse) {
            this.columnValues[columnIdx].push(data[columnIdx])
            colProps.uidt = UITypes.SingleSelect
          }
        }
      } else if (colProps.uidt === UITypes.Number) {
        if (isDecimalType(colData)) {
          colProps.uidt = UITypes.Decimal
        }
      } else if (colProps.uidt === UITypes.DateTime) {
        if (data[columnIdx] && columnIdx < this.config.maxRowsToParse) {
          this.columnValues[columnIdx].push(data[columnIdx])
        }
      }
      if (!(colProps.uidt in this.detectedColumnTypes[columnIdx])) {
        this.detectedColumnTypes[columnIdx] = {
          ...this.detectedColumnTypes[columnIdx],
          [colProps.uidt]: 0,
        }
      }
      this.detectedColumnTypes[columnIdx][colProps.uidt] += 1

      if (data[columnIdx]) {
        this.distinctValues[columnIdx].add(data[columnIdx])
      }
    }
  }

  getPossibleUidt(columnIdx: number) {
    const detectedColTypes = this.detectedColumnTypes[columnIdx]
    const len = Object.keys(detectedColTypes).length
    // all records are null
    if (len === 0) {
      return UITypes.SingleLineText
    }
    // handle numeric case
    if (len === 2 && UITypes.Number in detectedColTypes && UITypes.Decimal in detectedColTypes) {
      return UITypes.Decimal
    }
    // if there are multiple detected column types
    // then return either LongText or SingleLineText
    if (len > 1) {
      if (UITypes.LongText in detectedColTypes) {
        return UITypes.LongText
      }
      return UITypes.SingleLineText
    }
    // otherwise, all records have the same column type
    return Object.keys(detectedColTypes)[0]
  }

  updateTemplate(tableIdx: number) {
    for (let columnIdx = 0; columnIdx < this.headers[tableIdx].length; columnIdx++) {
      const uidt = this.getPossibleUidt(columnIdx)
      if (this.columnValues[columnIdx].length > 0) {
        if (uidt === UITypes.DateTime) {
          const dateFormat: Record<string, number> = {}
          if (
            this.columnValues[columnIdx].slice(1, this.config.maxRowsToParse).every((v: any) => {
              const isDate = v.split(' ').length === 1
              if (isDate) {
                dateFormat[getDateFormat(v)] = (dateFormat[getDateFormat(v)] || 0) + 1
              }
              return isDate
            })
          ) {
            this.tables[tableIdx].columns[columnIdx].uidt = UITypes.Date
            // take the date format with the max occurrence
            const objKeys = Object.keys(dateFormat)
            this.tables[tableIdx].columns[columnIdx].meta.date_format = objKeys.length
              ? objKeys.reduce((x, y) => (dateFormat[x] > dateFormat[y] ? x : y))
              : 'YYYY/MM/DD'
          } else {
            // Datetime
            this.tables[tableIdx].columns[columnIdx].uidt = uidt
          }
        } else if (uidt === UITypes.SingleSelect || uidt === UITypes.MultiSelect) {
          // assume it is a SingleLineText first
          this.tables[tableIdx].columns[columnIdx].uidt = UITypes.SingleLineText
          // override with UITypes.SingleSelect or UITypes.MultiSelect if applicable
          Object.assign(this.tables[tableIdx].columns[columnIdx], extractMultiOrSingleSelectProps(this.columnValues[columnIdx]))
        } else {
          this.tables[tableIdx].columns[columnIdx].uidt = uidt
        }
        delete this.columnValues[columnIdx]
      } else {
        this.tables[tableIdx].columns[columnIdx].uidt = uidt
      }
    }
  }

  async _parseTableData(tableIdx: number, source: (UploadFile & { encoding?: string }) | string, tn: string) {
    return new Promise((resolve, reject) => {
      const that = this
      let steppers = 0
      if (that.config.shouldImportData) {
        that.progress(`Processing ${tn} data`)

        steppers = 0
        const parseSource = (this.config.importFromURL ? (source as string) : (source as UploadFile).originFileObj)!
        parse(parseSource, {
          download: that.config.importFromURL,
          // worker: true,
          skipEmptyLines: 'greedy',
          encoding: (source as { encoding?: string })?.encoding,
          step(row) {
            steppers += 1
            if (row && steppers >= +that.config.firstRowAsHeaders + 1) {
              const rowData: Record<string, any> = {}
              for (let columnIdx = 0; columnIdx < that.headers[tableIdx].length; columnIdx++) {
                const column = that.tables[tableIdx].columns[columnIdx]
                const data = (row.data as [])[columnIdx] === '' ? null : (row.data as [])[columnIdx]
                if (column.uidt === UITypes.Checkbox) {
                  rowData[column.column_name] = getCheckboxValue(data)
                } else if (column.uidt === UITypes.SingleSelect || column.uidt === UITypes.MultiSelect) {
                  rowData[column.column_name] = (data || '').toString().trim() || null
                } else {
                  // TODO(import): do parsing if necessary based on type
                  rowData[column.column_name] = data
                }
              }
              that.data[tn].push(rowData)
            }

            if (steppers % 1000 === 0) {
              that.progress(`Processed ${steppers} rows of ${tn}`)
            }
          },
          complete() {
            that.progress(`Processed ${tn} data`)
            resolve(true)
          },
          error(e: Error) {
            reject(e)
          },
        })
      } else {
        resolve(true)
      }
    })
  }

  async _parseTableMeta(tableIdx: number, source: UploadFile | string) {
    return new Promise((resolve, reject) => {
      const that = this
      let steppers = 0
      const tn = ((this.config.importFromURL ? (source as string).split('/').pop() : (source as UploadFile).name) as string)
        .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_')
        .trim()!
      this.data[tn] = []
      const parseSource = (this.config.importFromURL ? (source as string) : (source as UploadFile).originFileObj)!
      parse(parseSource, {
        download: that.config.importFromURL,
        skipEmptyLines: 'greedy',
        step(row) {
          steppers += 1
          if (row) {
            if (steppers === 1) {
              if (that.config.firstRowAsHeaders) {
                // row.data is header
                that.initTemplate(tableIdx, tn, row.data as [])
              } else {
                // use dummy column names as header
                that.initTemplate(
                  tableIdx,
                  tn,
                  [...Array((row.data as []).length)].map((_, i) => `field_${i + 1}`),
                )
                if (that.config.autoSelectFieldTypes) {
                  // row.data is data
                  that.detectColumnType(tableIdx, row.data as [])
                }
              }
            } else {
              if (that.config.autoSelectFieldTypes) {
                // row.data is data
                that.detectColumnType(tableIdx, row.data as [])
              }
            }
          }
        },
        async complete() {
          that.updateTemplate(tableIdx)
          that.base.tables.push(that.tables[tableIdx])
          that.progress(`Processed ${tn} metadata`)
          await that._parseTableData(tableIdx, source, tn)
          resolve(true)
        },
        error(e: Error) {
          reject(e)
        },
      })
    })
  }

  async parse() {
    if (this.config.importFromURL) {
      await this._parseTableMeta(0, this.source as string)
    } else {
      await Promise.all(
        (this.source as UploadFile[]).map((file: UploadFile, tableIdx: number) =>
          (async (f, idx) => {
            this.progress(`Parsing ${f.name}`)
            await this._parseTableMeta(idx, f)
          })(file, tableIdx),
        ),
      )
    }
  }

  getColumns() {
    return this.base.tables.map((t: Record<string, any>) => t.columns)
  }

  getData() {
    return this.data
  }

  getTemplate() {
    return this.base
  }

  progress(msg: string) {
    this.progressCallback?.(msg)
  }
}
