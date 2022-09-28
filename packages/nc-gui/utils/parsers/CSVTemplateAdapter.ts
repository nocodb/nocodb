import { parse } from 'papaparse'
import TemplateGenerator from './TemplateGenerator'

export default class CSVTemplateAdapter extends TemplateGenerator {
  fileName: string
  project: object
  data: object
  csv: any
  csvData: any
  columns: object

  constructor(name: string, data: object) {
    super()
    this.fileName = name
    this.csvData = data
    this.project = {
      title: this.fileName,
      tables: [],
    }
    this.data = {}
    this.csv = {}
    this.columns = {}
    this.csvData = {}
  }

  async init() {
    this.csv = parse(this.csvData, { header: true })
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
}
