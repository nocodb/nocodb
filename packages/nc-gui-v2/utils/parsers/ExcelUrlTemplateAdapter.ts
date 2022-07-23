import ExcelTemplateAdapter from './ExcelTemplateAdapter'
const { $api } = useNuxtApp()

export default class ExcelUrlTemplateAdapter extends ExcelTemplateAdapter {
  url: string
  quickImportType: string
  excelData: any

  constructor(url: string, parserConfig: Record<string, any>, quickImportType: string) {
    const name = url.split('/').pop()
    super(name, parserConfig)
    this.url = url
    this.quickImportType = quickImportType
    this.excelData = null
  }

  async init() {
    const data: any = await $api.utils.axiosRequestMake({
      apiMeta: {
        url: this.url,
      },
    })
    this.excelData = data.data
    await super.init()
  }
}
