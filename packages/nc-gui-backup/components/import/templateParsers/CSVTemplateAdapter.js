import Papaparse from 'papaparse'
import TemplateGenerator from '~/components/import/templateParsers/TemplateGenerator'
export default class CSVTemplateAdapter extends TemplateGenerator {
  constructor(name, data) {
    super()
    this.name = name
    this.csvData = data
    this.project = {
      title: this.name,
      tables: []
    }
    this.data = {}
  }

  async init() {
    this.csv = Papaparse.parse(this.csvData, { header: true })
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
