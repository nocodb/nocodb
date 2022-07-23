import JSONTemplateAdapter from './JSONTemplateAdapter'
const { $api } = useNuxtApp()

export default class JSONUrlTemplateAdapter extends JSONTemplateAdapter {
  url: string
  constructor(url: string, parserConfig: Record<string, any>) {
    const name = url.split('/').pop()
    super(name, parserConfig)
    this.url = url
  }

  async init() {
    const data = await $api.utils.axiosRequestMake({
      apiMeta: {
        url: this.url,
      },
    })
    this._jsonData = data
    await super.init()
  }
}
