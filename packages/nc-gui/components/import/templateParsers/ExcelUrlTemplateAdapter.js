import ExcelTemplateAdapter from '~/components/import/templateParsers/ExcelTemplateAdapter'

export default class ExcelUrlTemplateAdapter extends ExcelTemplateAdapter {
  constructor(url, $store, parserConfig, $api) {
    const name = url.split('/').pop()
    super(name, null, parserConfig)
    this.url = url
    this.$api = $api
    this.$store = $store
  }

  async init() {
    const data = await this.$api.utils.axiosRequestMake({
      apiMeta: {
        url: this.url,
        responseType: 'arraybuffer'
      }
    })
    this.excelData = data.data
    await super.init()
  }
}
