import ExcelTemplateAdapter from '~/components/import/templateParsers/ExcelTemplateAdapter'

export default class ExcelUrlTemplateAdapter extends ExcelTemplateAdapter {
  constructor(url, $store, parserConfig, $api, quickImportType) {
    const name = url.split('/').pop()
    super(name, null, parserConfig)
    this.url = url
    this.$api = $api
    this.$store = $store
    this.quickImportType = quickImportType
  }

  async init() {
    const data = await this.$api.utils.axiosRequestMake({
      apiMeta: {
        url: this.url
      }
    })
    this.excelData = data.data
    await super.init()
  }
}
