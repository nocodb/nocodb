import type { TableType } from 'nocodb-sdk'
import { ColumnType, UITypes, isSystemColumn } from 'nocodb-sdk'
import { CSVTemplateAdapter } from '~/utils/parsers'
import { ImportWorkerOperations, ImportWorkerResponse, TabType } from '~/lib'

const state: {
  tables: TableType[]
  templateGenerator: CSVTemplateAdapter | null
  config: any
} = {
  tables: [],
  config: {} as any,
  templateGenerator: null,
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

const progress = (msg: string) => {
  postMessage([ImportWorkerResponse.PROGRESS, msg])
}

const process = async (payload, config) => {
  let templateData
  let importColumns = []
  let importData

  try {
    state.templateGenerator = new CSVTemplateAdapter(payload, config, progress)

    await state.templateGenerator.init()

    console.log('parse')
    await state.templateGenerator.parse()
    //
    console.log('getTemplate')

    templateData = state.templateGenerator!.getTemplate()

    console.log(templateData)
    if (state.config.importDataOnly) importColumns = state.templateGenerator!.getColumns()
    else {
      // ensure the target table name not exist in current table list
      for (const table1 of templateData.tables) {
        table1.table_name = populateUniqueTableName(table1.table_name)
      }
    }
    importData = state.templateGenerator!.getData()

    console.log(importData)
  } catch (e: any) {
    console.log('error', e)
    // message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    // isParsingData.value = false
    // preImportLoading.value = false
  }

  postMessage([
    ImportWorkerResponse.PROCESSED_DATA,
    {
      templateData,
      importColumns,
      importData,
    },
  ])
}

/*

async function importTemplate({tables} ) {
  if (state.config.importDataOnly) {
    for (const table of tables) {
      // validate required columns
      if (!missingRequiredColumnsValidation(table.table_name)) return

      // validate at least one column needs to be selected
      if (!atLeastOneEnabledValidation(table.table_name)) return
    }

    try {
      isImporting.value = true

      const tableId = meta.value?.id
      const projectName = project.value.title!
      const table_names = data.tables.map((t: Record<string, any>) => t.table_name)

      await Promise.all(
        Object.keys(importData).map((key: string) =>
          (async (k) => {
            if (!table_names.includes(k)) {
              return
            }
            const data = importData[k]
            const total = data.length

            for (let i = 0, progress = 0; i < total; i += maxRowsToParse) {
              const batchData = data.slice(i, i + maxRowsToParse).map((row: Record<string, any>) =>
                srcDestMapping.value[k].reduce((res: Record<string, any>, col: Record<string, any>) => {
                  if (col.enabled && col.destCn) {
                    const v = columns.value.find((c: Record<string, any>) => c.title === col.destCn) as Record<string, any>
                    let input = row[col.srcCn]
                    // parse potential boolean values
                    if (v.uidt === UITypes.Checkbox) {
                      input = input.replace(/["']/g, '').toLowerCase().trim()
                      if (input === 'false' || input === 'no' || input === 'n') {
                        input = '0'
                      } else if (input === 'true' || input === 'yes' || input === 'y') {
                        input = '1'
                      }
                    } else if (v.uidt === UITypes.Number) {
                      if (input === '') {
                        input = null
                      }
                    } else if (v.uidt === UITypes.SingleSelect || v.uidt === UITypes.MultiSelect) {
                      if (input === '') {
                        input = null
                      }
                    } else if (v.uidt === UITypes.Date) {
                      if (input) {
                        input = parseStringDate(input, v.meta.date_format)
                      }
                    }
                    res[col.destCn] = input
                  }
                  return res
                }, {}),
              )
              await $api.dbTableRow.bulkCreate('noco', projectName, tableId!, batchData)
              updateImportTips(projectName, tableId!, progress, total)
              progress += batchData.length
            }
          })(key),
        ),
      )

      // reload table
      reloadHook.trigger()

      // Successfully imported table data
      message.success(t('msg.success.tableDataImported'))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isImporting.value = false
    }
  } else {
    // check if form is valid
    try {
      await validate()
    } catch (errorInfo) {
      isImporting.value = false
      throw new Error('Please fill all the required values')
    }

    try {
      isImporting.value = true
      // tab info to be used to show the tab after successful import
      const tab = {
        id: '',
        title: '',
        projectId: '',
      }

      // create tables
      for (const table of data.tables) {
        // enrich system fields if not provided
        // e.g. id, created_at, updated_at
        const systemColumns = sqlUi?.value.getNewTableColumns().filter((c: ColumnType) => c.column_name !== 'title')
        for (const systemColumn of systemColumns) {
          if (!table.columns?.some((c) => c.column_name?.toLowerCase() === systemColumn.column_name.toLowerCase())) {
            table.columns?.push(systemColumn)
          }
        }

        if (table.columns) {
          for (const column of table.columns) {
            // set pk & rqd if ID is provided
            if (column.column_name?.toLowerCase() === 'id' && !('pk' in column)) {
              column.pk = true
              column.rqd = true
            }
            if (!isSystemColumn(column) && column.uidt !== UITypes.SingleSelect && column.uidt !== UITypes.MultiSelect) {
              // delete dtxp if the final data type is not single & multi select
              // e.g. import -> detect as single / multi select -> switch to SingleLineText
              // the correct dtxp will be generated during column creation
              delete column.dtxp
            }
          }
        }
        const createdTable = await $api.base.tableCreate(project.value?.id as string, (baseId || project.value?.bases?.[0].id)!, {
          table_name: table.table_name,
          // leave title empty to get a generated one based on table_name
          title: '',
          columns: table.columns || [],
        })
        table.id = createdTable.id
        table.title = createdTable.title

        // open the first table after import
        if (tab.id === '' && tab.title === '' && tab.projectId === '') {
          tab.id = createdTable.id as string
          tab.title = createdTable.title as string
          tab.projectId = project.value.id as string
        }

        // set display value
        if (createdTable?.columns?.[0]?.id) {
          await $api.dbTableColumn.primaryColumnSet(createdTable.columns[0].id as string)
        }
      }
      // bulk insert data
      if (importData) {
        const offset = maxRowsToParse
        const projectName = project.value.title as string
        await Promise.all(
          data.tables.map((table: Record<string, any>) =>
            (async (tableMeta) => {
              let progress = 0
              let total = 0
              // use ref_table_name here instead of table_name
              // since importData[talbeMeta.table_name] would be empty after renaming
              const data = importData[tableMeta.ref_table_name]
              if (data) {
                total += data.length
                for (let i = 0; i < data.length; i += offset) {
                  updateImportTips(projectName, tableMeta.title, progress, total)
                  const batchData = remapColNames(data.slice(i, i + offset), tableMeta.columns)
                  await $api.dbTableRow.bulkCreate('noco', project.value.id, tableMeta.id, batchData)
                  progress += batchData.length
                }
                updateImportTips(projectName, tableMeta.title, total, total)
              }
            })(table),
          ),
        )
      }
      // reload table list
      await loadTables()

      addTab({
        ...tab,
        type: TabType.TABLE,
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isImporting.value = false
    }
  }
}

*/

self.addEventListener(
  'message',
  async function (e) {
    const [operation, payload, extra] = e.data

    switch (operation) {
      case ImportWorkerOperations.SET_TABLES:
        state.tables = payload
        break
      case ImportWorkerOperations.PROCESS:
        await process(payload, extra)
        break
      case ImportWorkerOperations.SET_CONFIG:
        state.config = payload
        break
      case ImportWorkerOperations.GET_SINGLE_SELECT_OPTIONS:
      case ImportWorkerOperations.GET_MULTI_SELECT_OPTIONS: {
        const {table, column, record} = payload

        console.log('table', table)
        console.log('column', column)
        console.log('record', record)
      }
        break
    }
  },
  false,
)
