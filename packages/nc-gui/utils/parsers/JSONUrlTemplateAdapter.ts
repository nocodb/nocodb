import JSONTemplateAdapter from './JSONTemplateAdapter'
import { useNuxtApp } from '#imports'

export default class JSONUrlTemplateAdapter extends JSONTemplateAdapter {
  url: string
  $api: any

  constructor(url: string, parserConfig: Record<string, any>) {
    const { $api } = useNuxtApp()
    super({}, parserConfig)
    this.url = url
    this.$api = $api
  }

  async init() {
    const data = await this.$api.utils.axiosRequestMake({
      apiMeta: {
        url: this.url,
      },
    })
    this._jsonData = data
    await super.init()
  }
}
