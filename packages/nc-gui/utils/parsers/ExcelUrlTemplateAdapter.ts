import type { Api } from 'nocodb-sdk'
import ExcelTemplateAdapter from './ExcelTemplateAdapter'

export default class ExcelUrlTemplateAdapter extends ExcelTemplateAdapter {
  url: string
  excelData: any
  $api: any

  constructor(
    url: string,
    parserConfig: Record<string, any>,
    api: Api<any>,
    xlsx: any = null,
    progressCallback?: (msg: string) => void,
  ) {
    super({}, parserConfig, xlsx, progressCallback)
    this.url = url
    this.excelData = null
    this.$api = api
  }

  async init() {
    this.progress('Downloading excel file')
    const data: any = await this.$api.utils.axiosRequestMake({
      apiMeta: {
        url: this.url,
      },
    })
    this.excelData = data.data
    await super.init()
  }
}
