import { parse } from 'papaparse'
import TemplateGenerator from './TemplateGenerator'
import { UploadFile } from 'ant-design-vue'
import { UITypes } from 'nocodb-sdk'
import {
  extractMultiOrSingleSelectProps,
  isCheckboxType,
  isDecimalType,
  isEmailType,
  isMultiLineTextType,
  isUrlType,
} from '#imports'

export default class CSVTemplateAdapter extends TemplateGenerator {
  config: Record<string, any>
  fileName: string
  files: UploadFile[]
  detectedColumnTypes: Record<number, Record<string, number>>
  distinctValues: Record<number, Set<string>>
  headers: Record<number, string[]>
  project: {
    title: string
    tables: Record<string, any>[]
  }
  columnValues: Record<number, []>

  constructor(fileName: string, files: UploadFile[], parserConfig = {}) {
    super()
    this.config = {
      maxRowsToParse: 500,
      ...parserConfig,
    }
    this.fileName = fileName // TODO: check usage
    this.files = files
    this.project = {
      title: this.fileName,
      tables: [],
    }
    this.detectedColumnTypes = {}
    this.distinctValues = {}
    this.headers = {}
    this.columnValues = {}
  }

  async init() {}

  initTemplate(tableIdx: number, fileName: string, columnNames: string[]) {
    const columnNameRowExist = +columnNames.every((v: any) => v === null || typeof v === 'string')
    const columnNamePrefixRef: Record<string, any> = { id: 0 }

    this.project.tables.push({
      table_name: fileName,
      ref_table_name: fileName,
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
    if (!isNaN(new Date(v).getDate())) return UITypes.DateTime
    if (['true', 'True', 'false', 'False', '1', '0', 'T', 'F', 'Y', 'N'].includes(v)) return UITypes.Checkbox
    return UITypes.SingleLineText
  }

  detectColumnType(data: []) {
    for (let columnIdx = 0; columnIdx < data.length; columnIdx++) {
      const colData: any = [data[columnIdx]]
      const colProps = { uidt: this.detectInitialUidt(data[columnIdx]) }
      // TODO: centralise
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
            if (columnIdx < this.config.maxRowsToParse) {
              this.columnValues[columnIdx].push(data[columnIdx])
            }
          }
        }
      } else if (colProps.uidt === UITypes.Number) {
        if (isDecimalType(colData)) {
          colProps.uidt = UITypes.Decimal
        }
      } else if (colProps.uidt === UITypes.DateTime) {
        if (columnIdx < this.config.maxRowsToParse) {
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

  getMaxPossibleUidt(columnIdx: number) {
    let mx = -1
    let key: string = UITypes.SingleLineText
    Object.entries(this.detectedColumnTypes[columnIdx]).forEach(([k, v]) => {
      if (v > mx) {
        mx = v
        key = k
      }
    })
    return key
  }

  updateTemplate(tableIdx: number) {
    for (let columnIdx = 0; columnIdx < this.headers[tableIdx].length; columnIdx++) {
      if (this.columnValues[columnIdx].length > 0) {
        if (this.project.tables[tableIdx].columns[columnIdx].uidt === UITypes.DateTime) {
          // TODO: handle DateTime
          // set meta
        }
        Object.assign(
          this.project.tables[tableIdx].columns[columnIdx],
          extractMultiOrSingleSelectProps(this.columnValues[columnIdx]),
        )
      } else {
        this.project.tables[tableIdx].columns[columnIdx].uidt = this.getMaxPossibleUidt(columnIdx)
      }
    }
  }

  parse() {
    const that = this
    for (const [tableIdx, file] of this.files.entries()) {
      let steppers = 0
      parse(file.originFileObj as File, {
        worker: true,
        step: function (row) {
          steppers += 1
          if (row) {
            if (steppers == 1) {
              that.initTemplate(tableIdx, file.name!, row.data as [])
            } else {
              that.detectColumnType(row.data as [])
            }
            // TODO: remove
            if (steppers <= 10) {
              console.log('Row:', row.data)
            }
          }
        },
        complete: function () {
          console.log('complete')
          console.log('steppers: ' + steppers)
          that.updateTemplate(tableIdx)
          console.log(that.project.tables)
          // TODO: enable import button
          // TODO: put info.file.originFileObj to list
        },
      })
    }
  }

  getColumns() {
    // return this.columns
  }

  getData() {
    // return this.data
  }

  getTemplate() {
    return this.project
  }
}
