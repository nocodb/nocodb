import XLSX from 'xlsx'
import { UITypes } from '~/components/project/spreadsheet/helpers/uiTypes'
import TemplateGenerator from '~/components/import/templateParsers/TemplateGenerator'
import { getCheckboxValue, isCheckboxType } from '~/components/import/templateParsers/parserHelpers'

const excelTypeToUidt = {
  d: UITypes.DateTime,
  b: UITypes.Checkbox,
  n: UITypes.Number,
  s: UITypes.SingleLineText
}

export default class ExcelTemplateAdapter extends TemplateGenerator {
  constructor(name, ab, parserConfig = {}) {
    super()
    this.config = {
      maxRowsToParse: 500,
      ...parserConfig
    }
    this.name = name
    this.excelData = ab
    this.project = {
      title: this.name,
      tables: []
    }
    this.data = {}
  }

  async init() {
    this.wb = XLSX.read(new Uint8Array(this.excelData), { type: 'array', cellText: true, cellDates: true })
  }

  parse() {
    const tableNamePrefixRef = {}
    for (let i = 0; i < this.wb.SheetNames.length; i++) {
      const columnNamePrefixRef = { id: 0 }
      const sheet = this.wb.SheetNames[i]
      let tn = (sheet || 'table').replace(/\W/g, '_').trim()

      while (tn in tableNamePrefixRef) {
        tn = `${tn}${++tableNamePrefixRef[tn]}`
      }
      tableNamePrefixRef[tn] = 0

      const table = { tn, refTn: tn, columns: [] }
      this.data[tn] = []
      const ws = this.wb.Sheets[sheet]
      const range = XLSX.utils.decode_range(ws['!ref'])
      const originalRows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, cellDates: true, defval: null })

      // fix precision bug & timezone offset issues introduced by xlsx
      const basedate = new Date(1899, 11, 30, 0, 0, 0)
      // number of milliseconds since base date
      const dnthresh = basedate.getTime() + (new Date().getTimezoneOffset() - basedate.getTimezoneOffset()) * 60000
      // number of milliseconds in a day
      const day_ms = 24 * 60 * 60 * 1000
      // handle date1904 property
      const fixImportedDate = (date) => {
        const parsed = XLSX.SSF.parse_date_code((date.getTime() - dnthresh) / day_ms, {
          date1904: this.wb.Workbook.WBProps.date1904
        })
        return new Date(parsed.y, parsed.m, parsed.d, parsed.H, parsed.M, parsed.S)
      }
      // fix imported date
      const rows = originalRows.map(r => r.map((v) => {
        return v instanceof Date ? fixImportedDate(v) : v
      }))

      const columnNameRowExist = +rows[0].every(v => v === null || typeof v === 'string')

      // const colLen = Math.max()
      for (let col = 0; col < rows[0].length; col++) {
        let cn = ((columnNameRowExist && rows[0] && rows[0][col] && rows[0][col].toString().trim()) ||
          `field_${col + 1}`).replace(/\W/g, '_').trim()

        while (cn in columnNamePrefixRef) {
          cn = `${cn}${++columnNamePrefixRef[cn]}`
        }
        columnNamePrefixRef[cn] = 0

        const column = {
          cn,
          refCn: cn
        }

        table.columns.push(column)

        // const cellId = `${col.toString(26).split('').map(s => (parseInt(s, 26) + 10).toString(36).toUpperCase())}2`;
        const cellId = XLSX.utils.encode_cell({
          c: range.s.c + col,
          r: columnNameRowExist
        })
        const cellProps = ws[cellId] || {}
        column.uidt = excelTypeToUidt[cellProps.t] || UITypes.SingleLineText

        // todo: optimize
        if (column.uidt === UITypes.SingleLineText) {
          // check for long text
          if (rows.some(r =>
            (r[col] || '').toString().match(/[\r\n]/) ||
            (r[col] || '').toString().length > 255)
          ) {
            column.uidt = UITypes.LongText
          } else {
            const vals = rows.slice(columnNameRowExist ? 1 : 0).map(r => r[col]).filter(v => v !== null && v !== undefined && v.toString().trim() !== '')

            const checkboxType = isCheckboxType(vals)
            if (checkboxType.length === 1) {
              column.uidt = UITypes.Checkbox
            } else {
              // todo: optimize
              // check column is multi or single select by comparing unique values
              // todo:
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
          if (rows.slice(1, this.config.maxRowsToParse).some((v) => {
            return v && v[col] && parseInt(+v[col]) !== +v[col]
          })) {
            column.uidt = UITypes.Decimal
          }
          if (rows.slice(1, this.config.maxRowsToParse).every((v, i) => {
            const cellId = XLSX.utils.encode_cell({
              c: range.s.c + col,
              r: i + (columnNameRowExist)
            })

            const cellObj = ws[cellId]

            return !cellObj || (cellObj.w && cellObj.w.startsWith('$'))
          })) {
            column.uidt = UITypes.Currency
          }
        } else if (column.uidt === UITypes.DateTime) {
          if (rows.slice(1, this.config.maxRowsToParse).every((v, i) => {
            const cellId = XLSX.utils.encode_cell({
              c: range.s.c + col,
              r: i + columnNameRowExist
            })

            const cellObj = ws[cellId]
            return !cellObj || (cellObj.w && cellObj.w.split(' ').length === 1)
          })) {
            column.uidt = UITypes.Date
          }
        }
      }

      let rowIndex = 0
      for (const row of rows.slice(1)) {
        const rowData = {}
        for (let i = 0; i < table.columns.length; i++) {
          if (table.columns[i].uidt === UITypes.Checkbox) {
            rowData[table.columns[i].column_name] = getCheckboxValue(row[i])
          } else if (table.columns[i].uidt === UITypes.Currency) {
            const cellId = XLSX.utils.encode_cell({
              c: range.s.c + i,
              r: rowIndex + columnNameRowExist
            })

            const cellObj = ws[cellId]
            rowData[table.columns[i].column_name] = (cellObj && cellObj.w && cellObj.w.replace(/[^\d.]+/g, '')) || row[i]
          } else if (table.columns[i].uidt === UITypes.SingleSelect || table.columns[i].uidt === UITypes.MultiSelect) {
            rowData[table.columns[i].column_name] = (row[i] || '').toString().trim() || null
          } else {
            // toto: do parsing if necessary based on type
            rowData[table.columns[i].column_name] = row[i]
          }
        }
        this.data[tn].push(rowData)
        rowIndex++
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
