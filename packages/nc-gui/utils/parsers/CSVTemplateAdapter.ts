import { parse } from 'papaparse'
import type { UploadFile } from 'ant-design-vue'
import { UITypes } from 'nocodb-sdk'
import {
  extractMultiOrSingleSelectProps,
  getCheckboxValue,
  getDateFormat,
  isCheckboxType,
  isDecimalType,
  isEmailType,
  isMultiLineTextType,
  isUrlType,
  validateDateWithUnknownFormat,
} from '#imports'

export default class CSVTemplateAdapter {
  config: Record<string, any>
  files: UploadFile[]
  detectedColumnTypes: Record<number, Record<string, number>>
  distinctValues: Record<number, Set<string>>
  headers: Record<number, string[]>
  project: {
    tables: Record<string, any>[]
  }

  data: Record<string, any> = {}
  columnValues: Record<number, []>

  constructor(files: UploadFile[], parserConfig = {}) {
    this.config = {
      maxRowsToParse: 500,
      ...parserConfig,
    }
    this.files = files
    this.project = {
      tables: [],
    }
    this.detectedColumnTypes = {}
    this.distinctValues = {}
    this.headers = {}
    this.columnValues = {}
  }

  async init() {}

  initTemplate(tableIdx: number, tn: string, columnNames: string[]) {
    const columnNameRowExist = +columnNames.every((v: any) => v === null || typeof v === 'string')
    const columnNamePrefixRef: Record<string, any> = { id: 0 }

    this.project.tables.push({
      table_name: tn,
      ref_table_name: tn,
      columns: [],
    })

    this.headers[tableIdx] = []

    for (const [columnIdx, columnName] of columnNames.entries()) {
      let cn: string = ((columnNameRowExist && columnName.toString().trim()) || `field_${columnIdx + 1}`)
        .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_')
        .trim()
      while (cn in columnNamePrefixRef) {
        cn = `${cn}${++columnNamePrefixRef[cn]}`
      }
      columnNamePrefixRef[cn] = 0

      this.detectedColumnTypes[columnIdx] = {}
      this.distinctValues[columnIdx] = new Set<string>()
      this.columnValues[columnIdx] = []

      this.project.tables[tableIdx].columns.push({
        column_name: cn,
        ref_column_name: cn,
        meta: {},
        uidt: UITypes.SingleLineText,
        key: columnIdx,
      })

      this.headers[tableIdx].push(cn)
    }
  }

  detectInitialUidt(v: string) {
    if (!isNaN(Number(v)) && !isNaN(parseFloat(v))) return UITypes.Number
    if (validateDateWithUnknownFormat(v)) return UITypes.DateTime
    if (['true', 'True', 'false', 'False', '1', '0', 'T', 'F', 'Y', 'N'].includes(v)) return UITypes.Checkbox
    return UITypes.SingleLineText
  }

  detectColumnType(tableIdx: number, data: []) {
    for (let columnIdx = 0; columnIdx < data.length; columnIdx++) {
      // skip null data
      if (!data[columnIdx]) continue
      const colData: any = [data[columnIdx]]
      const colProps = { uidt: this.detectInitialUidt(data[columnIdx]) }
      // TODO(import): centralise
      if (colProps.uidt === UITypes.SingleLineText) {
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
            if (data[columnIdx] && columnIdx < this.config.maxRowsToParse) {
              this.columnValues[columnIdx].push(data[columnIdx])
              colProps.uidt = UITypes.SingleSelect
            }
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
    const len = Object.keys(this.detectedColumnTypes[columnIdx]).length
    // all records are null
    if (len == 0) {
      return UITypes.SingleLineText
    }
    // handle numeric case
    if (
      Object.keys(this.detectedColumnTypes[columnIdx]).length == 2 &&
      UITypes.Number in this.detectedColumnTypes[columnIdx] &&
      UITypes.Decimal in this.detectedColumnTypes[columnIdx]
    ) {
      if (this.detectedColumnTypes[columnIdx][UITypes.Number] > this.detectedColumnTypes[columnIdx][UITypes.Decimal]) {
        return UITypes.Number
      }
      return UITypes.Decimal
    }
    // if there are multiple detected column types
    // then return either LongText or SingleLineText
    if (Object.keys(this.detectedColumnTypes[columnIdx]).length > 1) {
      if (UITypes.LongText in this.detectedColumnTypes[columnIdx]) {
        return UITypes.LongText
      }
      return UITypes.SingleLineText
    }
    // otherwise, all records have the same column type
    return Object.keys(this.detectedColumnTypes[columnIdx])[0]
  }

  updateTemplate(tableIdx: number) {
    for (let columnIdx = 0; columnIdx < this.headers[tableIdx].length; columnIdx++) {
      const uidt = this.getPossibleUidt(columnIdx)
      if (this.columnValues[columnIdx].length > 0) {
        if (uidt === UITypes.DateTime) {
          const dateFormat: Record<string, number> = {}
          if (
            this.columnValues[columnIdx].slice(1, this.config.maxRowsToParse).every((v: any, i: any) => {
              const isDate = v.split(' ').length === 1
              if (isDate) {
                dateFormat[getDateFormat(v)] = (dateFormat[getDateFormat(v)] || 0) + 1
              }
              return isDate
            })
          ) {
            this.project.tables[tableIdx].columns[columnIdx].uidt = UITypes.Date
            // take the date format with the max occurrence
            this.project.tables[tableIdx].columns[columnIdx].meta.date_format =
              Object.keys(dateFormat).reduce((x, y) => (dateFormat[x] > dateFormat[y] ? x : y)) || 'YYYY/MM/DD'
          } else {
            // Datetime
            this.project.tables[tableIdx].columns[columnIdx].uidt = uidt
          }
        } else if (uidt === UITypes.SingleSelect || uidt === UITypes.MultiSelect) {
          // assume it is a SingleLineText first
          this.project.tables[tableIdx].columns[columnIdx].uidt = UITypes.SingleLineText
          // override with UITypes.SingleSelect or UITypes.MultiSelect if applicable
          Object.assign(
            this.project.tables[tableIdx].columns[columnIdx],
            extractMultiOrSingleSelectProps(this.columnValues[columnIdx]),
          )
        }
        delete this.columnValues[columnIdx]
      } else {
        this.project.tables[tableIdx].columns[columnIdx].uidt = uidt
      }
    }
  }

  parse(callback: Function) {
    const that = this
    for (const [tableIdx, file] of this.files.entries()) {
      let steppers = 0
      const tn = file.name.replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_').trim()
      parse(file.originFileObj as File, {
        worker: true,
        step(row) {
          steppers += 1
          if (row) {
            if (steppers === 1) {
              that.initTemplate(tableIdx, tn, row.data as [])
            } else {
              that.detectColumnType(tableIdx, row.data as [])
            }
          }
        },
        complete() {
          console.log('complete')
          console.log(`steppers: ${steppers}`)
          that.updateTemplate(tableIdx)
          callback()
        },
      })
    }
  }

  getColumns() {
    // return this.columns
  }

  getData() {
    const that = this
    for (const [tableIdx, file] of this.files.entries()) {
      let steppers = 0
      const tn = file.name.replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_').trim()
      this.data[tn] = []
      parse(file.originFileObj as File, {
        worker: true,
        step(row) {
          steppers += 1
          if (row && steppers >= 2) {
            const rowData: Record<string, any> = {}
            for (let columnIdx = 0; columnIdx < that.headers[tableIdx].length; columnIdx++) {
              const column = that.project.tables[tableIdx].columns[columnIdx]
              const data = (row.data as [])[columnIdx] === '' ? null : (row.data as [])[columnIdx]
              if (column.uidt === UITypes.Checkbox) {
                rowData[column.column_name] = getCheckboxValue(data)
                rowData[column.column_name] = data
              } else if (column.uidt === UITypes.Currency) {
                rowData[column.column_name] = data
              } else if (column.uidt === UITypes.SingleSelect || column.uidt === UITypes.MultiSelect) {
                rowData[column.column_name] = (data || '').toString().trim() || null
              } else if (column.uidt === UITypes.Date) {
                // TODO(import): check format
                rowData[column.column_name] = data
              } else {
                // TODO(import): do parsing if necessary based on type
                rowData[column.column_name] = data
              }
            }
            that.data[tn].push(rowData)
          }
        },
        complete() {
          console.log('getData(): complete')
          console.log(`getData(): steppers: ${steppers}`)
        },
      })
    }
    return this.data
  }

  getTemplate() {
    return this.project
  }
}
