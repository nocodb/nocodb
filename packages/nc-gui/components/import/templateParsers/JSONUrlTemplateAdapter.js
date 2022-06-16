import { TemplateGenerator } from 'nocodb-sdk'
import { UITypes } from '~/components/project/spreadsheet/helpers/uiTypes'
import { getCheckboxValue, isCheckboxType } from '~/components/import/templateParsers/parserHelpers'

const jsonTypeToUidt = {
  number: UITypes.Number,
  string: UITypes.SingleLineText,
  date: UITypes.DateTime,
  boolean: UITypes.Checkbox,
  object: UITypes.LongText
}

export default class JSONTemplateAdapter extends JSONTemplateAdapter {
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
    this.jsonData = data.data
    await super.init()
  }
}
