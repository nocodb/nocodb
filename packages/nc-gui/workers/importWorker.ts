import type { TableType } from 'nocodb-sdk'
import { Api, UITypes } from 'nocodb-sdk'
import * as xlsx from 'xlsx'
import type { ImportWorkerPayload } from '../lib/types'
import { ImportSource, ImportType, ImportWorkerOperations, ImportWorkerResponse } from '../lib/enums'
import type TemplateGenerator from '../helpers/parsers/TemplateGenerator'
import { extractSdkResponseErrorMsg } from '../utils/errorUtils'
import { extractSelectOptions } from '../helpers/parsers/parserHelpers'
import {
  CSVTemplateAdapter,
  ExcelTemplateAdapter,
  ExcelUrlTemplateAdapter,
  JSONTemplateAdapter,
  JSONUrlTemplateAdapter,
} from '../helpers/parsers'

const state: {
  tables: TableType[]
  templateGenerator:
    | TemplateGenerator
    | CSVTemplateAdapter
    | ExcelTemplateAdapter
    | ExcelUrlTemplateAdapter
    | JSONTemplateAdapter
    | JSONUrlTemplateAdapter
    | null
  config: any
  data?: {
    templateData: any
    importColumns: any
    importData: any
  }
  api?: Api<any>
} = {
  tables: [],
  config: {} as any,
  templateGenerator: null,
}

const progress = (msg: string) => {
  postMessage([ImportWorkerResponse.PROGRESS, msg])
}

async function readFileContent(val: any) {
  progress('Reading file content')
  const data = await new Promise<any>((resolve) => {
    const reader = new FileReader()
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target && e.target.result) {
        resolve(e.target.result)
      }
    }
    reader.readAsArrayBuffer(val[0].originFileObj!)
  })
  return data
}

async function getAdapter(importType: ImportType, sourceType: ImportSource, val: any, config) {
  if (importType === ImportType.CSV) {
    switch (sourceType) {
      case ImportSource.FILE:
        return new CSVTemplateAdapter(val, config, progress)
      case ImportSource.URL:
        return new CSVTemplateAdapter(val, config, progress)
    }
  } else if (importType === ImportType.EXCEL) {
    switch (sourceType) {
      case ImportSource.FILE: {
        const data = await readFileContent(val)

        return new ExcelTemplateAdapter(data, config, xlsx, progress)
      }
      case ImportSource.URL:
        return new ExcelUrlTemplateAdapter(val, config, state.api!, xlsx, progress)
    }
  } else if (importType === 'json') {
    switch (sourceType) {
      case ImportSource.FILE: {
        const data = await readFileContent(val)
        return new JSONTemplateAdapter(data, config, progress)
      }
      case ImportSource.URL:
        return new JSONUrlTemplateAdapter(val, config, state.api, progress)
      case ImportSource.STRING:
        return new JSONTemplateAdapter(val, config, progress)
    }
  }

  return null
}

function populateUniqueTableName(tn: string) {
  let c = 1
  while (
    state.tables.some((t: TableType) => {
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

const process = async (payload: ImportWorkerPayload) => {
  let templateData
  let importColumns = []
  let importData

  try {
    state.templateGenerator = await getAdapter(payload.importType, payload.importSource, payload.value, payload.config)

    if (!state.templateGenerator) {
      return postMessage([ImportWorkerResponse.ERROR, 'Invalid import type'])
    }

    progress('Initializing parser')
    await state.templateGenerator.init()

    progress('Parsing content and generating template')
    await state.templateGenerator.parse()

    templateData = state.templateGenerator!.getTemplate()

    if (state.config.importDataOnly) importColumns = state.templateGenerator!.getColumns()
    else {
      // ensure the target table name not exist in current table list
      for (const table1 of templateData.tables) {
        table1.table_name = populateUniqueTableName(table1.table_name)
      }
    }
    importData = state.templateGenerator!.getData()

    state.data = {
      templateData,
      importColumns,
      importData,
    }

    postMessage([
      ImportWorkerResponse.PROCESSED_DATA,
      {
        templateData,
        importColumns,
        importData,
      },
    ])
  } catch (e: any) {
    console.log('error', e)
    postMessage([ImportWorkerResponse.ERROR, await extractSdkResponseErrorMsg(e)])
  }
}

self.addEventListener(
  'message',
  async function (e) {
    const [operation, payload] = e.data

    switch (operation) {
      case ImportWorkerOperations.SET_TABLES:
        state.tables = payload
        break
      case ImportWorkerOperations.PROCESS:
        await process(payload)
        break
      case ImportWorkerOperations.SET_CONFIG:
        state.config = payload
        break
      case ImportWorkerOperations.INIT_SDK:
        state.api = new Api<any>({
          baseURL: payload.baseURL,
          headers: {
            'xc-auth': payload.token,
          },
        })
        break
      case ImportWorkerOperations.GET_SINGLE_SELECT_OPTIONS:
      case ImportWorkerOperations.GET_MULTI_SELECT_OPTIONS:
        {
          const { tableName, columnName } = payload
          const colOptions = extractSelectOptions(
            state.data?.importData?.[tableName]?.flatMap((row: any) => row[columnName] || []) ?? [],
            operation === ImportWorkerOperations.GET_MULTI_SELECT_OPTIONS ? UITypes.MultiSelect : UITypes.SingleSelect,
          )

          if (operation === ImportWorkerOperations.GET_MULTI_SELECT_OPTIONS) {
            postMessage([ImportWorkerResponse.MULTI_SELECT_OPTIONS, colOptions.dtxp])
          } else {
            postMessage([ImportWorkerResponse.SINGLE_SELECT_OPTIONS, colOptions.dtxp])
          }
        }
        break
    }
  },
  false,
)
