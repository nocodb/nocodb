import Papaparse from 'papaparse'
import TemplateGenerator from '~/components/import/TemplateGenerator'

export default class CSVTemplateAdapter extends TemplateGenerator {
  constructor(name, data) {
    super()
    this.name = name
    this.csv = Papaparse.parse(data, { header: true })
    this.project = {
      title: this.name,
      tables: []
    }
    this.data = {}
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
