import { TemplateGenerator } from 'nocodb-sdk'
import { UITypes } from '~/components/project/spreadsheet/helpers/uiTypes'
import { getCheckboxValue, isCheckboxType } from '~/components/import/templateParsers/parserHelpers'

const jsonTypeToUidt = {
  number: UITypes.Number,
  string: UITypes.SingleLineText,
  date: UITypes.DateTime,
  boolean: UITypes.Checkbox,
  object: UITypes.LongText
}

export default class JSONTemplateAdapter extends TemplateGenerator {
  constructor(name = 'test', data, parserConfig = {}) {
    super()
    this.config = {
      maxRowsToParse: 500,
      ...parserConfig
    }
    this.name = name
    this.jsonData = typeof data === 'string' ? JSON.parse(data) : data
    this.project = {
      title: this.name,
      tables: []
    }
    this.data = {}
  }

  async init() {
  }

  parseData() {
    this.columns = this.csv.meta.fields
    this.data = this.csv.data
  }

  getColumns() {
    return this.columns
  }

  getData() {
    return this.data
  }

  parse() {
    const jsonData = Array.isArray(this.this.jsonData) ? this.this.jsonData : [this.jsonData]

    // for (let i = 0; i < this.wb.SheetNames.length; i++) {
    // const columnNamePrefixRef = { id: 0 }

    const tn = 'table'

    const table = { table_name: tn, ref_table_name: tn, columns: [] }

    this.data[tn] = []

    // const ws = this.wb.Sheets[sheet]
    // const range = XLSX.utils.decode_range(ws['!ref'])
    // const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, cellDates: true, defval: null })

    const objKeys = Object.keys(jsonData[0])

    for (let col = 0; col < objKeys.length; col++) {
      const key = objKeys[col]
      const cn = objKeys[col].replace(/\W/g, '_').trim()

      const column = {
        column_name: cn,
        ref_column_name: cn
      }

      table.columns.push(column)

      column.uidt = jsonTypeToUidt[typeof jsonData[0][key]] || UITypes.SingleLineText

      // todo: optimize
      if (column.uidt === UITypes.SingleLineText) {
        // check for long text
        if (jsonData.some(r =>
          (r[key] || '').toString().match(/[\r\n]/) ||
          (r[key] || '').toString().length > 255)
        ) {
          column.uidt = UITypes.LongText
        } else {
          const vals = jsonData
            .map(r => r[key])
            .filter(v => v !== null && v !== undefined && v.toString().trim() !== '')

          const checkboxType = isCheckboxType(vals)
          if (checkboxType.length === 1) {
            column.uidt = UITypes.Checkbox
          } else {
            // todo: optimize
            // check column is multi or single select by comparing unique values
            // todo:
            // eslint-disable-next-line no-lonely-if
            if (vals.some(v => v && v.toString().includes(','))) {
              let flattenedVals = vals.flatMap(v => v ? v.toString().trim().split(/\s*,\s*/) : [])
              const uniqueVals = flattenedVals = flattenedVals
                .filter((v, i, arr) => i === arr.findIndex(v1 => v.toLowerCase() === v1.toLowerCase()))
              if (flattenedVals.length > uniqueVals.length && uniqueVals.length <= Math.ceil(flattenedVals.length / 2)) {
                column.uidt = UITypes.MultiSelect
                column.dtxp = `'${uniqueVals.join("','")}'`
              }
            } else {
              const uniqueVals = vals.map(v => v.toString().trim()).filter((v, i, arr) => i === arr.findIndex(v1 => v.toLowerCase() === v1.toLowerCase()))
              if (vals.length > uniqueVals.length && uniqueVals.length <= Math.ceil(vals.length / 2)) {
                column.uidt = UITypes.SingleSelect
                column.dtxp = `'${uniqueVals.join("','")}'`
              }
            }
          }
        }
      } else if (column.uidt === UITypes.Number) {
        if (jsonData.slice(1, this.config.maxRowsToParse).some((v) => {
          return v && v[key] && parseInt(+v[key]) !== +v[key]
        })) {
          column.uidt = UITypes.Decimal
        }
        if (jsonData.every((v, i) => {
          return v[key] && v[key].toString().startsWith('$')
        })) {
          column.uidt = UITypes.Currency
        }
      } else if (column.uidt === UITypes.DateTime) {
        if (jsonData.every((v, i) => {
          return v[key] && v[key].toString().split(' ').length === 1
        })) {
          column.uidt = UITypes.Date
        }
      }
    }

    // let rowIndex = 0
    for (const row of jsonData) {
      const rowData = {}
      for (let i = 0; i < table.columns.length; i++) {
        if (table.columns[i].uidt === UITypes.Checkbox) {
          rowData[table.columns[i].column_name] = getCheckboxValue(row[i])
        } else if (table.columns[i].uidt === UITypes.Currency) {
          rowData[table.columns[i].column_name] = (row[table.columns[i].ref_column_name].replace(/[^\d.]+/g, '')) || row[i]
        } else if (table.columns[i].uidt === UITypes.SingleSelect || table.columns[i].uidt === UITypes.MultiSelect) {
          rowData[table.columns[i].column_name] = (row[table.columns[i].ref_column_name] || '').toString().trim() || null
        } else {
          // toto: do parsing if necessary based on type
          rowData[table.columns[i].column_name] = row[table.columns[i].ref_column_name]
        }
      }
      this.data[tn].push(rowData)
      // rowIndex++
    }
    this.project.tables.push(table)
  }

  getTemplate() {
    return this.project
  }
}
