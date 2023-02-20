import ExcelTemplateAdapter from './ExcelTemplateAdapter'
import { useNuxtApp } from '#imports'

export default class ExcelUrlTemplateAdapter extends ExcelTemplateAdapter {
  url: string
  excelData: any
  $api: any

  constructor(url: string, parserConfig: Record<string, any>) {
    const { $api } = useNuxtApp()
    super({}, parserConfig)
    this.url = url
    this.excelData = null
    this.$api = $api
  }

  async init() {
    const data: any = await this.$api.utils.axiosRequestMake({
      apiMeta: {
        url: this.url,
      },
    })
    this.excelData = data.data
    await super.init()
  }
}
