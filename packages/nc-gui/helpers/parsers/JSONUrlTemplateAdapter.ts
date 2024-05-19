import type { Api } from 'nocodb-sdk'
import JSONTemplateAdapter from './JSONTemplateAdapter'

export default class JSONUrlTemplateAdapter extends JSONTemplateAdapter {
  url: string
  $api: any

  constructor(url: string, parserConfig: Record<string, any>, api: Api<any>, progressCallback?: (msg: string) => void) {
    // const { $api } = useNuxtApp()
    super({}, parserConfig, progressCallback)
    this.url = url
    this.$api = api
  }

  async init() {
    this.progress('Downloading json file')
    const data = await this.$api.utils.axiosRequestMake({
      apiMeta: {
        url: this.url,
      },
    })
    this._jsonData = data
    await super.init()
  }
}
