// workerVite.js
// import type { TableType } from 'nocodb-sdk'
import { CSVTemplateAdapter } from '~/utils/parsers'
import {ModelTypes} from "nocodb-sdk";


const state = {
  tables: any[],
}

function populateUniqueTableName(tn) {
  let c = 1
  while (
    state.tables.some((t) => {
      const s = t.table_name.split('___')
      let target = t.table_name
      if (s.length > 1) target = s[1]
      return target === `${tn}`
    })
  ) {
  tn = `${tn}_${c++}`
  }
  return tn
}

self.addEventListener(
  'message',
  async function (e) {

    const files = Array.isArray(e.data) ? e.data : [e.data]
    const data = []
    let templateData
    const importDataOnly = false
    let importColumns = false
    let importData = false

    try {
      const templateGenerator = new CSVTemplateAdapter(e.data, {
        importFromURL: false,
      })
      //
      await templateGenerator.init()

      console.log('parse')
      await templateGenerator.parse()
      //
      console.log('getTemplate')

      templateData = templateGenerator!.getTemplate()

      console.log(templateData)
      if (importDataOnly) importColumns = templateGenerator!.getColumns()
      else {
        // ensure the target table name not exist in current table list
        for (const table1 of templateData.tables) {
          table1.table_name = populateUniqueTableName(table1.table_name)
        }
      }
      importData = templateGenerator!.getData()

      console.log(importData)
    } catch (e: any) {
      console.log('error', e)
      // message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      // isParsingData.value = false
      // preImportLoading.value = false
    }

    postMessage({
      templateData,
      importColumns,
      importData,
    })
  },
  false,
)
