import type { Api, ColumnType } from 'nocodb-sdk'
import ExcelTemplateAdapter from './ExcelTemplateAdapter'
import type { ProgressMessageType } from './TemplateGenerator'

export default class ExcelUrlTemplateAdapter extends ExcelTemplateAdapter {
  url: string
  excelData: any
  $api: any

  constructor(
    url: string,
    parserConfig: Record<string, any>,
    api: Api<any>,
    xlsx: any = null,
    progressCallback?: (msg: ProgressMessageType) => void,
    existingColumns?: ColumnType[],
  ) {
    super({}, parserConfig, xlsx, progressCallback, existingColumns)
    this.url = url
    this.excelData = null
    this.$api = api
  }

  async init() {
    this.progress('Downloading excel file')
    this.excelData = await this.$api.utils.axiosRequestMake(
      {
        apiMeta: {
          url: this.url,
        },
      },
      { format: 'arraybuffer' },
    )
    await super.init()
  }
}
