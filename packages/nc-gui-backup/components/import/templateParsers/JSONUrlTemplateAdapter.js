import JSONTemplateAdapter from '~/components/import/templateParsers/JSONTemplateAdapter'

export default class JSONUrlTemplateAdapter extends JSONTemplateAdapter {
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
        url: this.url
      }
    })
    this._jsonData = data
    await super.init()
  }
}
