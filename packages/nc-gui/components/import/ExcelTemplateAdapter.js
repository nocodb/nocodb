import XLSX from 'xlsx'
import TemplateGenerator from '~/components/import/TemplateGenerator'
import { UITypes } from '~/components/project/spreadsheet/helpers/uiTypes'

const excelTypeToUidt = {
  d: UITypes.DateTime,
  b: UITypes.Checkbox,
  n: UITypes.Number,
  s: UITypes.SingleLineText
}

export default class ExcelTemplateAdapter extends TemplateGenerator {
  constructor(name, ab) {
    super()
    this.name = name
    this.wb = XLSX.read(new Uint8Array(ab), { type: 'array' })
    this.project = {
      title: this.name,
      tables: []
    }
    this.data = {}
  }

  parse() {
    for (let i = 0; i < this.wb.SheetNames.length; i++) {
      const sheet = this.wb.SheetNames[i]
      const table = { tn: sheet, columns: [] }
      this.data[sheet] = []
      const ws = this.wb.Sheets[sheet]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

      for (let col = 0; col < rows[0].length; col++) {
        const column = {
          cn: rows[0][col]
        }

        const cellProps = ws[`${col.toString(26).split('').map(s => (parseInt(s, 26) + 10).toString(36).toUpperCase())}2`]

        column.uidt = excelTypeToUidt[cellProps.t] || UITypes.SingleLineText

        // todo: optimize
        if (column.uidt === UITypes.SingleLineText) {
          // check for long text
          if (rows.some(r => (r[col] || '').toString().length > 255)) {
            column.uidt = UITypes.LongText
          } else {
            const vals = rows.slice(1).map(r => r[col]).filter(v => v !== null && v !== undefined)

            // check column is multi or single select by comparing unique values
            if (vals.some(v => v && v.includes(','))) {
              const flattenedVals = vals.flatMap(v => v ? v.split(',') : [])
              const uniqueVals = new Set(flattenedVals)
              if (flattenedVals.length > uniqueVals.size && uniqueVals.size <= flattenedVals.length / 10) {
                column.uidt = UITypes.MultiSelect
                column.dtxp = [...uniqueVals].join(',')
              }
            } else {
              const uniqueVals = new Set(vals)
              if (vals.length > uniqueVals.size && uniqueVals.size <= vals.length / 10) {
                column.uidt = UITypes.SingleSelect
                column.dtxp = [...uniqueVals].join(',')
              }
            }
          }
        }

        table.columns.push(column)
      }

      for (const row of rows.slice(1)) {
        const rowData = {}
        for (let i = 0; i < table.columns.length; i++) {
          // toto: do parsing if necessary based on type
          rowData[table.columns[i].cn] = row[i]
        }
        this.data[sheet].push(rowData)
      }

      this.project.tables.push(table)
    }
  }

  getTemplate() {
    return this.project
  }

  getData() {
    return this.data
  }
}
